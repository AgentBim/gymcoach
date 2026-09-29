-- Program Tools Phase 4: "Save to library" for program-generated workouts.
--
-- duplicate_workout gains an optional p_name. Without it the copy is still
-- named "<name> (copy)", so Dashboard's Copy is unchanged. With it, the copy
-- takes that name, so Save to library can make a hand-built copy of a
-- generated workout under its own name in one call. The copy never carries
-- program_generated or source_program_id (both keep their defaults), so it
-- is an ordinary workout in the coach's list.
--
-- The old one-argument function is dropped in the same transaction: keeping
-- it next to a (uuid, text default null) version would make every existing
-- call with only p_workout_id ambiguous. Body otherwise unchanged; still
-- SECURITY INVOKER with search_path ''.

drop function if exists public.duplicate_workout(uuid);

create function public.duplicate_workout(p_workout_id uuid, p_name text default null)
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

revoke execute on function public.duplicate_workout(uuid, text) from public, anon;
grant execute on function public.duplicate_workout(uuid, text) to authenticated;
