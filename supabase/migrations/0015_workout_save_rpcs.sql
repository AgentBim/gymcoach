-- Captures save_workout and duplicate_workout in the repo.
--
-- Both functions were created directly on the live project and used by the
-- workout builder / Workouts list (docs/plans/mockup-parity.md, Phase 2) but
-- never landed in a migration, so a database built from this folder lacked
-- them. The definitions below are copied from the live database, so applying
-- this file there is a no-op (create or replace with the same body).
--
-- Both are SECURITY INVOKER with search_path '', scoped to the caller's own
-- workouts (coach_id = auth.uid()), like save_program.

create or replace function public.save_workout(
  p_workout_id uuid,
  p_name text,
  p_is_ai_generated boolean,
  p_exercises jsonb,
  p_prehab jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_workout_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'Workout name is required';
  end if;

  if jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one exercise is required';
  end if;

  if p_workout_id is null then
    insert into public.workouts (coach_id, name, is_ai_generated)
    values (auth.uid(), btrim(p_name), coalesce(p_is_ai_generated, false))
    returning id into v_workout_id;
  else
    update public.workouts
       set name = btrim(p_name),
           is_ai_generated = coalesce(p_is_ai_generated, false)
     where id = p_workout_id
       and coach_id = auth.uid()
    returning id into v_workout_id;

    if v_workout_id is null then
      raise exception 'Workout not found or access denied';
    end if;

    delete from public.workout_exercises where workout_id = v_workout_id;
    delete from public.workout_prehab where workout_id = v_workout_id;
  end if;

  insert into public.workout_exercises (
    workout_id, exercise_id, position, sets, reps, duration_seconds, rest_seconds
  )
  select
    v_workout_id,
    (item->>'exercise_id')::uuid,
    (item->>'position')::integer,
    (item->>'sets')::integer,
    nullif(item->>'reps', '')::integer,
    nullif(item->>'duration_seconds', '')::integer,
    (item->>'rest_seconds')::integer
  from jsonb_array_elements(p_exercises) item;

  insert into public.workout_prehab (
    workout_id, exercise_id, position, sets, reps, duration_seconds, rest_seconds
  )
  select
    v_workout_id,
    (item->>'exercise_id')::uuid,
    (item->>'position')::integer,
    (item->>'sets')::integer,
    nullif(item->>'reps', '')::integer,
    nullif(item->>'duration_seconds', '')::integer,
    (item->>'rest_seconds')::integer
  from jsonb_array_elements(coalesce(p_prehab, '[]'::jsonb)) item;

  return v_workout_id;
end;
$function$;

create or replace function public.duplicate_workout(
  p_workout_id uuid,
  p_name text default null
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare v_new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.workouts(coach_id,name,is_ai_generated)
  select auth.uid(), left(coalesce(nullif(btrim(p_name), ''), name || ' (copy)'),160), false from public.workouts
  where id=p_workout_id and coach_id=auth.uid() returning id into v_new_id;
  if v_new_id is null then raise exception 'Workout not found'; end if;
  insert into public.workout_exercises(workout_id,exercise_id,position,sets,reps,duration_seconds,rest_seconds)
  select v_new_id,exercise_id,position,sets,reps,duration_seconds,rest_seconds
  from public.workout_exercises where workout_id=p_workout_id order by position;
  insert into public.workout_prehab(workout_id,exercise_id,position,sets,reps,duration_seconds,rest_seconds)
  select v_new_id,exercise_id,position,sets,reps,duration_seconds,rest_seconds
  from public.workout_prehab where workout_id=p_workout_id order by position;
  return v_new_id;
end;
$function$;

revoke execute on function public.save_workout(uuid, text, boolean, jsonb, jsonb) from public, anon;
grant execute on function public.save_workout(uuid, text, boolean, jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.duplicate_workout(uuid, text) from public, anon;
grant execute on function public.duplicate_workout(uuid, text) to authenticated;
