-- Personal schedule changes ("Adjust week" in the Athlete hub).
--
-- athlete_day_overrides(athlete_id, date, ...) says "on this calendar date,
-- this athlete does X instead of what their program says". Keyed by date,
-- not by program cell, so an override survives a program change or a shifted
-- start date. A row with day_type 'rest' and no workout is a personal rest
-- day. Removing the row puts the athlete back on the program.
--
-- Everything that decides "what is due on a date" (src/lib/streaks.js and its
-- callers) reads these rows, so the coach views and the athlete portal can't
-- disagree.
--
-- Access
--   - Coaches manage overrides for their own athletes only.
--   - Athletes read their own.
--   - An athlete must be able to see (and complete) a workout a coach swapped
--     in even when it is not in their program or assignments. The workouts /
--     workout_exercises / workout_prehab "athletes can view ..." policies and
--     submit_athlete_workout_feedback gain an OR through a SECURITY DEFINER
--     helper. The helper is the only cross-table hop, so it can't recurse
--     (the 42P17 cycle fixed in 0006).
--
-- Writes go through set_athlete_day_overrides / reset_athlete_day_overrides
-- (SECURITY INVOKER, search_path '', so every statement still runs through the
-- caller's RLS). p_today comes from the client because "today" is the
-- coach's local date; it must be within a day of the server's date.

create table if not exists public.athlete_day_overrides (
  id uuid primary key default extensions.uuid_generate_v4(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  date date not null,
  day_type public.day_type not null,
  workout_id uuid references public.workouts(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (athlete_id, date)
);

create index if not exists athlete_day_overrides_workout_idx
  on public.athlete_day_overrides (workout_id) where workout_id is not null;

alter table public.athlete_day_overrides enable row level security;

-- New tables here get no default grants; RLS below does the row filtering.
grant select, insert, update, delete on public.athlete_day_overrides to authenticated;

create policy "Coaches manage own overrides" on public.athlete_day_overrides
  for all to authenticated
  using ((select auth.uid()) = coach_id)
  with check (
    (select auth.uid()) = coach_id
    and exists (select 1 from public.athletes a where a.id = athlete_id and a.coach_id = (select auth.uid()))
    and (workout_id is null or public.workout_owned_by_coach(workout_id, (select auth.uid())))
  );

create policy "athletes can read own overrides" on public.athlete_day_overrides
  for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = athlete_id and a.user_id = auth.uid()));

create or replace function public.athlete_override_workout_visible(p_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
      from public.athlete_day_overrides o
      join public.athletes a on a.id = o.athlete_id
     where o.workout_id = p_workout_id
       and a.user_id = auth.uid()
  )
$function$;

revoke execute on function public.athlete_override_workout_visible(uuid) from public, anon;
grant execute on function public.athlete_override_workout_visible(uuid) to authenticated;

-- Athlete visibility of a swapped-in workout and its exercises. ALTER POLICY
-- (not drop/create) keeps the roles and name and doesn't stall on the table lock.
alter policy "athletes can view assigned or scheduled workouts" on public.workouts
  using (
    exists (select 1 from public.workout_assignments wa join public.athletes ath on ath.id = wa.athlete_id
             where wa.workout_id = workouts.id and ath.user_id = auth.uid())
    or exists (select 1 from public.program_days pd join public.athletes ath on ath.active_program_id = pd.program_id
                where pd.workout_id = workouts.id and ath.user_id = auth.uid())
    or public.athlete_override_workout_visible(workouts.id)
  );

alter policy "athletes can view exercises for visible workouts" on public.workout_exercises
  using (exists (
    select 1 from public.workouts w
     where w.id = workout_exercises.workout_id
       and (
         exists (select 1 from public.workout_assignments wa join public.athletes ath on ath.id = wa.athlete_id
                  where wa.workout_id = w.id and ath.user_id = auth.uid())
         or exists (select 1 from public.program_days pd join public.athletes ath on ath.active_program_id = pd.program_id
                     where pd.workout_id = w.id and ath.user_id = auth.uid())
         or public.athlete_override_workout_visible(w.id)
       )
  ));

alter policy "athletes can view prehab for visible workouts" on public.workout_prehab
  using (exists (
    select 1 from public.workouts w
     where w.id = workout_prehab.workout_id
       and (
         exists (select 1 from public.workout_assignments wa join public.athletes ath on ath.id = wa.athlete_id
                  where wa.workout_id = w.id and ath.user_id = auth.uid())
         or exists (select 1 from public.program_days pd join public.athletes ath on ath.active_program_id = pd.program_id
                     where pd.workout_id = w.id and ath.user_id = auth.uid())
         or public.athlete_override_workout_visible(w.id)
       )
  ));

-- Completing a swapped-in workout: same authorization as the policies above.
create or replace function public.submit_athlete_workout_feedback(
  p_workout_id uuid,
  p_emoji_rating text default null,
  p_rpe integer default null,
  p_notes text default null,
  p_exercises_completed integer default 0,
  p_completed_date date default null
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_athlete_id uuid;
  v_athlete_name text;
  v_total integer;
  v_completed_date date;
  v_feedback_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id, full_name into v_athlete_id, v_athlete_name
  from public.athletes where user_id = auth.uid();

  if v_athlete_id is null then
    raise exception 'No athlete profile linked to this account';
  end if;

  -- Mirror the "athletes can view assigned or scheduled workouts" RLS
  -- policy's authorization exactly: the workout must be assigned to this
  -- athlete, scheduled via their active program, or swapped in by their
  -- coach for a day (athlete_day_overrides).
  if not exists (
    select 1 from public.workout_assignments wa
    where wa.workout_id = p_workout_id and wa.athlete_id = v_athlete_id
  ) and not exists (
    select 1 from public.program_days pd
    join public.athletes a on a.active_program_id = pd.program_id
    where pd.workout_id = p_workout_id and a.id = v_athlete_id
  ) and not exists (
    select 1 from public.athlete_day_overrides o
    where o.workout_id = p_workout_id and o.athlete_id = v_athlete_id
  ) then
    raise exception 'Workout not found';
  end if;

  select count(*)::integer into v_total from public.workout_exercises where workout_id = p_workout_id;

  if p_emoji_rating is not null and p_emoji_rating not in ('easy', 'good', 'hard', 'veryhard') then
    raise exception 'Invalid rating';
  end if;
  if p_rpe is not null and (p_rpe < 1 or p_rpe > 10) then
    raise exception 'RPE must be between 1 and 10';
  end if;
  if length(coalesce(p_notes, '')) > 1000 then
    raise exception 'Feedback is too long';
  end if;
  if p_exercises_completed < 0 or p_exercises_completed > v_total then
    raise exception 'Invalid completed exercise count';
  end if;

  v_completed_date := coalesce(p_completed_date, current_date);
  if v_completed_date < current_date - 2 or v_completed_date > current_date + 1 then
    raise exception 'Invalid completion date';
  end if;

  insert into public.workout_feedback (
    workout_id, athlete_id, athlete_name, completed_date,
    emoji_rating, rpe, notes, exercises_completed, exercises_total
  ) values (
    p_workout_id, v_athlete_id, v_athlete_name, v_completed_date,
    p_emoji_rating, p_rpe, nullif(btrim(coalesce(p_notes, '')), ''),
    p_exercises_completed, v_total
  ) returning id into v_feedback_id;

  return v_feedback_id;
end;
$function$;

-- p_changes: [{ "date": "2026-10-16", "day_type": "training"|"rest"|"recovery"|"competition"|null,
--               "workout_id": uuid|null, "notes": text|null }]
-- A null day_type puts that date back on the program (deletes the override).
-- Days from p_today on only, and never a day the athlete already logged.
create or replace function public.set_athlete_day_overrides(p_athlete_id uuid, p_today date, p_changes jsonb)
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_date date;
  v_type public.day_type;
  v_workout uuid;
  v_notes text;
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_today is null or abs(p_today - current_date) > 1 then
    raise exception 'Invalid date';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 62 then
    raise exception 'Invalid changes';
  end if;
  if not exists (select 1 from public.athletes a where a.id = p_athlete_id and a.coach_id = v_uid) then
    raise exception 'Athlete not found';
  end if;

  for v_item in select * from jsonb_array_elements(p_changes) loop
    v_date := (v_item ->> 'date')::date;
    if v_date < p_today or v_date > p_today + 62 then
      raise exception 'Only upcoming days can be changed';
    end if;
    if exists (select 1 from public.workout_feedback f where f.athlete_id = p_athlete_id and f.completed_date = v_date) then
      raise exception 'That day is already logged and can''t change';
    end if;

    if nullif(v_item ->> 'day_type', '') is null then
      delete from public.athlete_day_overrides where athlete_id = p_athlete_id and date = v_date;
    else
      v_type := (v_item ->> 'day_type')::public.day_type;
      v_workout := nullif(v_item ->> 'workout_id', '')::uuid;
      v_notes := nullif(btrim(coalesce(v_item ->> 'notes', '')), '');
      if v_type = 'training' and v_workout is null then
        raise exception 'Pick a workout for a training day';
      end if;
      if v_type in ('rest', 'competition') then
        v_workout := null;
      end if;
      if v_workout is not null and not public.workout_owned_by_coach(v_workout, v_uid) then
        raise exception 'Workout not found';
      end if;

      insert into public.athlete_day_overrides (athlete_id, coach_id, date, day_type, workout_id, notes)
      values (p_athlete_id, v_uid, v_date, v_type, v_workout, v_notes)
      on conflict (athlete_id, date)
      do update set day_type = excluded.day_type, workout_id = excluded.workout_id, notes = excluded.notes;
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke execute on function public.set_athlete_day_overrides(uuid, date, jsonb) from public, anon;
grant execute on function public.set_athlete_day_overrides(uuid, date, jsonb) to authenticated;

create or replace function public.reset_athlete_day_overrides(p_athlete_id uuid, p_from date)
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.athletes a where a.id = p_athlete_id and a.coach_id = auth.uid()) then
    raise exception 'Athlete not found';
  end if;
  with d as (delete from public.athlete_day_overrides where athlete_id = p_athlete_id and date >= p_from returning 1)
  select count(*) into v_count from d;
  return v_count;
end;
$function$;

revoke execute on function public.reset_athlete_day_overrides(uuid, date) from public, anon;
grant execute on function public.reset_athlete_day_overrides(uuid, date) to authenticated;
