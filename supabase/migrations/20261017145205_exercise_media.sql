-- Verified against project nqrlhotrwyrphwumxtty, 2026-10-17.
-- This adds metadata only. It neither creates a public bucket nor publishes files.
begin;

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null check (length(asset_key) between 1 and 160),
  title text not null check (length(btrim(title)) between 1 and 200),
  owner_coach_id uuid references public.coaches(id) on delete restrict,
  published_version_id uuid,
  publication_revision integer not null default 0 check (publication_revision >= 0),
  publication_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint media_system_library_only check (owner_coach_id is null),
  unique nulls not distinct (owner_coach_id, asset_key)
);

create table public.media_asset_versions (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  storage_bucket text not null default 'exercise-library' check (storage_bucket = 'exercise-library'),
  video_path text not null,
  poster_path text not null,
  gif_path text check (gif_path is null), -- source GIF downloads are deferred
  width integer not null check (width > 0 and width <= 8192),
  height integer not null check (height > 0 and height <= 8192),
  duration_ms integer not null check (duration_ms > 0 and duration_ms <= 86400000),
  video_bytes bigint not null check (video_bytes > 0),
  poster_bytes bigint not null check (poster_bytes > 0),
  video_sha256 text not null check (video_sha256 ~ '^[0-9a-f]{64}$'),
  poster_sha256 text not null check (poster_sha256 ~ '^[0-9a-f]{64}$'),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  encoding_profile text not null,
  demonstration_note text check (length(demonstration_note) <= 2000),
  technical_status text not null default 'pending' check (technical_status in ('pending','passed','failed')),
  technical_report jsonb not null default '{}'::jsonb,
  content_review_status text not null default 'pending' check (content_review_status in ('pending','approved','rejected')),
  approved_by text,
  approved_at timestamptz,
  files_verified_at timestamptz,
  created_at timestamptz not null default now(),
  first_published_at timestamptz,
  unique (media_asset_id, version_number),
  unique (media_asset_id, id),
  check (video_path = 'library/animations/' || video_sha256 || '.mp4'),
  check (poster_path = 'library/posters/' || poster_sha256 || '.webp'),
  check (content_review_status <> 'approved' or
         (approved_at is not null and length(btrim(approved_by)) > 0 and approved_by is not null))
);

alter table public.media_assets add constraint media_published_version_same_asset
  foreign key (id, published_version_id)
  references public.media_asset_versions(media_asset_id, id) on delete restrict;
create index media_assets_owner_idx on public.media_assets(owner_coach_id);
create index media_assets_published_version_idx on public.media_assets(published_version_id);

alter table public.exercises
  add column default_media_asset_id uuid references public.media_assets(id) on delete restrict,
  add column media_demonstration_note text check (length(media_demonstration_note) <= 2000);
create index exercises_default_media_asset_idx on public.exercises(default_media_asset_id);
comment on column public.exercises.media_demonstration_note is
  'Entry-specific coaching cue retained when two exercise names share one demonstration. Separate from the version-wide variation note.';

alter table public.media_assets enable row level security;
alter table public.media_asset_versions enable row level security;
revoke all on public.media_assets, public.media_asset_versions from public, anon, authenticated;
grant all on public.media_assets, public.media_asset_versions to service_role;

-- Public files are generic system demonstrations. Metadata is available to
-- signed-in users, with unpublished versions and internal review fields hidden.
grant select (id, title, owner_coach_id, published_version_id, publication_revision, archived_at)
  on public.media_assets to authenticated;
grant select (id, media_asset_id, storage_bucket, video_path, poster_path, width, height,
              duration_ms, demonstration_note, technical_status, content_review_status, files_verified_at)
  on public.media_asset_versions to authenticated;
create policy media_read_published_assets on public.media_assets for select to authenticated
  using (owner_coach_id is null and archived_at is null and published_version_id is not null);
create policy media_read_current_version on public.media_asset_versions for select to authenticated
  using (technical_status = 'passed' and content_review_status = 'approved' and files_verified_at is not null
    and exists (select 1 from public.media_assets a
                where a.id = media_asset_id and a.published_version_id = media_asset_versions.id
                  and a.owner_coach_id is null and a.archived_at is null));

create function public.guard_media_version_immutability() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (old.files_verified_at is not null or old.content_review_status = 'approved' or old.first_published_at is not null)
     and (to_jsonb(new) - array['technical_status','content_review_status','approved_by','approved_at','files_verified_at','first_published_at'])
         is distinct from
         (to_jsonb(old) - array['technical_status','content_review_status','approved_by','approved_at','files_verified_at','first_published_at']) then
    raise exception 'Verified or approved media is immutable; create a new version';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_media_version_immutability() from public, anon, authenticated;
create trigger media_version_immutable before update on public.media_asset_versions
  for each row execute function public.guard_media_version_immutability();

create function public.guard_media_publication() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.published_version_id is not null and not exists (
    select 1 from public.media_asset_versions v
    where v.id = new.published_version_id and v.media_asset_id = new.id
      and v.technical_status = 'passed' and v.content_review_status = 'approved'
      and v.files_verified_at is not null
  ) then
    raise exception 'Publication requires an approved, technically valid, uploaded and verified version of the same asset';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_media_publication() from public, anon, authenticated;
create trigger media_publication_guard before insert or update of published_version_id on public.media_assets
  for each row execute function public.guard_media_publication();

-- Server-only publisher. Expected pointer prevents stale imports or reviewers
-- overwriting another release. Passing NULL as the next pointer unpublishes.
create function public.publish_media_asset(p_asset_id uuid, p_version_id uuid, p_expected_version_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  asset public.media_assets%rowtype;
begin
  select * into asset from public.media_assets where id = p_asset_id for update;
  if not found or asset.owner_coach_id is not null or asset.archived_at is not null then
    raise exception 'System media asset unavailable';
  end if;
  if asset.published_version_id is distinct from p_expected_version_id then
    raise exception 'Published version changed; reload before publishing';
  end if;
  if p_version_id is not null then
    perform 1 from public.media_asset_versions
      where id = p_version_id and media_asset_id = p_asset_id
        and technical_status = 'passed' and content_review_status = 'approved' and files_verified_at is not null
      for update;
    if not found then raise exception 'Version is not approved and verified for this asset'; end if;
  end if;
  if asset.published_version_id is not distinct from p_version_id then return; end if;
  update public.media_assets set
    published_version_id = p_version_id,
    publication_revision = publication_revision + 1,
    publication_history = publication_history || jsonb_build_array(jsonb_build_object(
      'previous_version_id', asset.published_version_id, 'next_version_id', p_version_id,
      'at', now(), 'database_role', current_user))
    where id = p_asset_id;
  update public.media_asset_versions set first_published_at = coalesce(first_published_at, now())
    where id = p_version_id;
end;
$$;
revoke all on function public.publish_media_asset(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.publish_media_asset(uuid,uuid,uuid) to service_role;

-- One batchable metadata query. Exercise RLS remains in force for authenticated
-- callers; shared links reach this only inside the existing token-checked RPC.
create view public.exercise_media with (security_invoker = true) as
select e.id as exercise_id, a.id as media_asset_id, v.id as version_id, a.publication_revision,
       v.storage_bucket, v.video_path, v.poster_path, v.width, v.height, v.duration_ms,
       v.demonstration_note, e.media_demonstration_note as exercise_note
from public.exercises e
join public.media_assets a on a.id = e.default_media_asset_id
join public.media_asset_versions v on v.id = a.published_version_id and v.media_asset_id = a.id
where a.owner_coach_id is null and a.archived_at is null
  and v.technical_status = 'passed' and v.content_review_status = 'approved'
  and v.files_verified_at is not null;
revoke all on public.exercise_media from public, anon, authenticated;
grant select on public.exercise_media to authenticated, service_role;

-- The only anonymous metadata route retains the exact assignment-token,
-- revocation and expiry checks of the inspected live function.
CREATE OR REPLACE FUNCTION public.get_shared_workout(p_share_token text)
 RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $function$
  select jsonb_build_object(
    'workout', jsonb_build_object(
      'id', w.id, 'name', w.name,
      'coaches', jsonb_build_object('full_name', c.full_name),
      'athlete_name', a.full_name, 'assignment_expires_at', wa.expires_at
    ),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', we.id, 'position', we.position, 'sets', we.sets,
        'reps', we.reps, 'duration_seconds', we.duration_seconds, 'rest_seconds', we.rest_seconds,
        'exercises', jsonb_build_object(
          'id', e.id, 'name', e.name, 'description', e.description,
          'muscle_group', e.muscle_group, 'difficulty', e.difficulty, 'category', e.category,
          'media', (select to_jsonb(m) - 'exercise_id' from public.exercise_media m where m.exercise_id = e.id)
        )
      ) order by we.position)
      from public.workout_exercises we join public.exercises e on e.id = we.exercise_id
      where we.workout_id = w.id
    ), '[]'::jsonb),
    'prehab', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', wp.id, 'position', wp.position, 'sets', wp.sets,
        'reps', wp.reps, 'duration_seconds', wp.duration_seconds, 'rest_seconds', wp.rest_seconds,
        'exercises', jsonb_build_object(
          'id', e.id, 'name', e.name, 'description', e.description,
          'muscle_group', e.muscle_group, 'difficulty', e.difficulty,
          'category', e.category, 'prehab_focus', e.prehab_focus,
          'media', (select to_jsonb(m) - 'exercise_id' from public.exercise_media m where m.exercise_id = e.id)
        )
      ) order by wp.position)
      from public.workout_prehab wp join public.exercises e on e.id = wp.exercise_id
      where wp.workout_id = w.id
    ), '[]'::jsonb)
  )
  from public.workout_assignments wa
  join public.workouts w on w.id = wa.workout_id
  join public.athletes a on a.id = wa.athlete_id
  left join public.coaches c on c.id = w.coach_id
  where length(p_share_token) = 64 and p_share_token ~ '^[0-9a-f]+$'
    and wa.assignment_token = p_share_token
    and wa.revoked_at is null and wa.expires_at > now();
$function$;
revoke all on function public.get_shared_workout(text) from public;
grant execute on function public.get_shared_workout(text) to anon, authenticated, service_role;

commit;
