-- Save the workout and both child collections atomically. The function runs
-- with the caller's privileges so existing RLS policies remain authoritative.
create or replace function public.save_workout(
  p_workout_id uuid,
  p_name text,
  p_is_ai_generated boolean,
  p_exercises jsonb,
  p_prehab jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;

revoke all on function public.save_workout(uuid, text, boolean, jsonb, jsonb) from public;
revoke all on function public.save_workout(uuid, text, boolean, jsonb, jsonb) from anon;
grant execute on function public.save_workout(uuid, text, boolean, jsonb, jsonb) to authenticated;
