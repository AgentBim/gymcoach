-- Plan section of the redesign (docs/plans/mockup-parity.md, Phase 2).
--
-- 1. workouts.archived_at: "Archive, keep history" in the Workouts list.
--    An archived workout is hidden from the coach's lists and pickers and
--    from athletes' direct assignments, but its workout_feedback stays, so
--    History and streaks are untouched. Deleting a workout still cascades its
--    feedback, which is why archive exists.
--
-- 2. archive_workouts(ids): sets archived_at and revokes the workouts'
--    assignments (workout_assignments.revoked_at). Workouts a program owns
--    (source_program_id not null) are skipped; they're managed in the program.
--    SECURITY INVOKER with search_path '', so every statement runs through
--    the caller's RLS. No policy changes.
--
-- 3. duplicate_program(id): copies a program for the same coach. Hand-built
--    workouts used by its days are shared with the copy; program-generated
--    workouts are cloned (with their exercises and prehab) and owned by the
--    copy, because a generated workout must belong to exactly one program
--    (delete_program / save_program clean up by source_program_id).

alter table public.workouts add column if not exists archived_at timestamptz;

create index if not exists workouts_archived_at_idx
  on public.workouts (coach_id) where archived_at is not null;

create or replace function public.archive_workouts(p_workout_ids uuid[])
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_workout_ids is null or cardinality(p_workout_ids) = 0 then
    raise exception 'Pick at least one workout';
  end if;
  if cardinality(p_workout_ids) > 200 then
    raise exception 'You can archive at most 200 workouts at once';
  end if;

  select coalesce(array_agg(w.id), '{}') into v_ids
    from public.workouts w
   where w.id = any (p_workout_ids)
     and w.coach_id = v_uid
     and w.source_program_id is null
     and w.archived_at is null;

  update public.workouts set archived_at = now() where id = any (v_ids);

  update public.workout_assignments
     set revoked_at = now()
   where workout_id = any (v_ids)
     and revoked_at is null;

  return cardinality(v_ids);
end;
$function$;

revoke execute on function public.archive_workouts(uuid[]) from public, anon;
grant execute on function public.archive_workouts(uuid[]) to authenticated;

create or replace function public.duplicate_program(p_program_id uuid)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_src public.programs%rowtype;
  v_new uuid;
  v_old_w uuid;
  v_new_w uuid;
  v_map jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_src from public.programs where id = p_program_id and coach_id = v_uid;
  if not found then
    raise exception 'Program not found';
  end if;

  insert into public.programs (coach_id, name, description, duration_weeks)
  values (v_uid, left(v_src.name || ' (copy)', 160), v_src.description, v_src.duration_weeks)
  returning id into v_new;

  -- Clone the generated workouts this program owns that its days use.
  for v_old_w in
    select distinct w.id
      from public.program_days d
      join public.workouts w on w.id = d.workout_id
     where d.program_id = p_program_id
       and w.coach_id = v_uid
       and w.source_program_id = p_program_id
  loop
    insert into public.workouts (coach_id, name, is_ai_generated, program_generated, source_program_id)
    select v_uid, w.name, w.is_ai_generated, true, v_new
      from public.workouts w where w.id = v_old_w
    returning id into v_new_w;

    insert into public.workout_exercises (workout_id, exercise_id, position, sets, reps, duration_seconds, rest_seconds)
    select v_new_w, e.exercise_id, e.position, e.sets, e.reps, e.duration_seconds, e.rest_seconds
      from public.workout_exercises e where e.workout_id = v_old_w;

    insert into public.workout_prehab (workout_id, exercise_id, position, sets, reps, duration_seconds, rest_seconds)
    select v_new_w, e.exercise_id, e.position, e.sets, e.reps, e.duration_seconds, e.rest_seconds
      from public.workout_prehab e where e.workout_id = v_old_w;

    v_map := v_map || jsonb_build_object(v_old_w::text, v_new_w::text);
  end loop;

  insert into public.program_days (program_id, week_number, day_of_week, workout_id, day_type, notes)
  select v_new, d.week_number, d.day_of_week,
         case when d.workout_id is null then null
              when v_map ? d.workout_id::text then (v_map ->> d.workout_id::text)::uuid
              else d.workout_id end,
         d.day_type, d.notes
    from public.program_days d
   where d.program_id = p_program_id;

  return v_new;
end;
$function$;

revoke execute on function public.duplicate_program(uuid) from public, anon;
grant execute on function public.duplicate_program(uuid) to authenticated;
