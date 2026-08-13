-- Assignment-scoped sharing and atomic program/duplication writes.

alter table public.workout_assignments
  add column if not exists assignment_token text,
  add column if not exists expires_at timestamptz,
  add column if not exists revoked_at timestamptz;

update public.workout_assignments
set assignment_token = encode(extensions.gen_random_bytes(32), 'hex'),
    expires_at = coalesce(expires_at, now() + interval '180 days')
where assignment_token is null;

alter table public.workout_assignments
  alter column assignment_token set default encode(extensions.gen_random_bytes(32), 'hex'),
  alter column assignment_token set not null,
  alter column expires_at set default (now() + interval '180 days'),
  alter column expires_at set not null;

create unique index if not exists workout_assignments_assignment_token_key
  on public.workout_assignments (assignment_token);
create index if not exists idx_workout_assignments_active_token
  on public.workout_assignments (assignment_token, expires_at)
  where revoked_at is null;

alter table public.workout_feedback add column if not exists assignment_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workout_feedback_assignment_id_fkey'
      and conrelid = 'public.workout_feedback'::regclass
  ) then
    alter table public.workout_feedback
      add constraint workout_feedback_assignment_id_fkey
      foreign key (assignment_id) references public.workout_assignments(id) on delete set null;
  end if;
end $$;
create unique index if not exists workout_feedback_assignment_once_key
  on public.workout_feedback (assignment_id) where assignment_id is not null;

drop function if exists public.submit_workout_feedback(text, text, integer, text, text, integer);

create or replace function public.get_shared_workout(p_share_token text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'workout', jsonb_build_object(
      'id', w.id,
      'name', w.name,
      'coaches', jsonb_build_object('full_name', c.full_name),
      'athlete_name', a.full_name,
      'assignment_expires_at', wa.expires_at
    ),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', we.id, 'position', we.position, 'sets', we.sets,
        'reps', we.reps, 'duration_seconds', we.duration_seconds,
        'rest_seconds', we.rest_seconds,
        'exercises', jsonb_build_object(
          'name', e.name, 'description', e.description,
          'muscle_group', e.muscle_group, 'difficulty', e.difficulty
        )
      ) order by we.position)
      from public.workout_exercises we
      join public.exercises e on e.id = we.exercise_id
      where we.workout_id = w.id
    ), '[]'::jsonb),
    'prehab', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', wp.id, 'position', wp.position, 'sets', wp.sets,
        'reps', wp.reps, 'duration_seconds', wp.duration_seconds,
        'rest_seconds', wp.rest_seconds,
        'exercises', jsonb_build_object(
          'name', e.name, 'description', e.description,
          'muscle_group', e.muscle_group, 'difficulty', e.difficulty,
          'category', e.category, 'prehab_focus', e.prehab_focus
        )
      ) order by wp.position)
      from public.workout_prehab wp
      join public.exercises e on e.id = wp.exercise_id
      where wp.workout_id = w.id
    ), '[]'::jsonb)
  )
  from public.workout_assignments wa
  join public.workouts w on w.id = wa.workout_id
  join public.athletes a on a.id = wa.athlete_id
  left join public.coaches c on c.id = w.coach_id
  where length(p_share_token) = 64
    and p_share_token ~ '^[0-9a-f]+$'
    and wa.assignment_token = p_share_token
    and wa.revoked_at is null
    and wa.expires_at > now();
$$;

create or replace function public.submit_workout_feedback(
  p_share_token text,
  p_emoji_rating text default null,
  p_rpe integer default null,
  p_notes text default null,
  p_exercises_completed integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment_id uuid;
  v_workout_id uuid;
  v_athlete_name text;
  v_total integer;
  v_feedback_id uuid;
begin
  if p_share_token is null or length(p_share_token) <> 64
     or p_share_token !~ '^[0-9a-f]+$' then
    raise exception 'Invalid assignment token';
  end if;

  select wa.id, wa.workout_id, a.full_name
    into v_assignment_id, v_workout_id, v_athlete_name
  from public.workout_assignments wa
  join public.athletes a on a.id = wa.athlete_id
  where wa.assignment_token = p_share_token
    and wa.revoked_at is null
    and wa.expires_at > now()
  for update of wa;

  if v_assignment_id is null then raise exception 'Assignment not found or expired'; end if;
  select count(*)::integer into v_total from public.workout_exercises where workout_id = v_workout_id;
  if p_emoji_rating is not null and p_emoji_rating not in ('easy', 'good', 'hard', 'veryhard') then raise exception 'Invalid rating'; end if;
  if p_rpe is not null and (p_rpe < 1 or p_rpe > 10) then raise exception 'RPE must be between 1 and 10'; end if;
  if length(coalesce(p_notes, '')) > 1000 then raise exception 'Feedback is too long'; end if;
  if p_exercises_completed < 0 or p_exercises_completed > v_total then raise exception 'Invalid completed exercise count'; end if;

  insert into public.workout_feedback (
    workout_id, assignment_id, share_token, emoji_rating, rpe, notes,
    exercises_completed, exercises_total, athlete_name
  ) values (
    v_workout_id, v_assignment_id, p_share_token,
    p_emoji_rating, p_rpe, nullif(btrim(p_notes), ''),
    p_exercises_completed, v_total, v_athlete_name
  ) returning id into v_feedback_id;
  return v_feedback_id;
exception
  when unique_violation then raise exception 'Feedback has already been submitted for this assignment';
end;
$$;

create or replace function public.save_program(
  p_program_id uuid,
  p_name text,
  p_description text,
  p_duration_weeks integer,
  p_days jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_program_id uuid; v_day jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 160 then raise exception 'Invalid program name'; end if;
  if p_duration_weeks not between 1 and 104 then raise exception 'Invalid program duration'; end if;
  if jsonb_typeof(coalesce(p_days, '[]'::jsonb)) <> 'array' then raise exception 'Invalid program days'; end if;

  if p_program_id is null then
    insert into public.programs (coach_id, name, description, duration_weeks)
    values (auth.uid(), btrim(p_name), nullif(btrim(p_description), ''), p_duration_weeks)
    returning id into v_program_id;
  else
    update public.programs set name=btrim(p_name), description=nullif(btrim(p_description), ''),
      duration_weeks=p_duration_weeks, updated_at=now()
    where id=p_program_id and coach_id=auth.uid() returning id into v_program_id;
    if v_program_id is null then raise exception 'Program not found'; end if;
    delete from public.program_days where program_id=v_program_id;
  end if;

  for v_day in select value from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) loop
    if (v_day->>'week_number')::integer not between 1 and p_duration_weeks
       or (v_day->>'day_of_week')::integer not between 0 and 6 then raise exception 'Invalid program day'; end if;
    if nullif(v_day->>'workout_id','') is not null and not exists (
      select 1 from public.workouts where id=(v_day->>'workout_id')::uuid and coach_id=auth.uid()
    ) then raise exception 'Invalid workout in program'; end if;
    insert into public.program_days(program_id,week_number,day_of_week,day_type,workout_id,notes)
    values(v_program_id,(v_day->>'week_number')::integer,(v_day->>'day_of_week')::integer,
      (v_day->>'day_type')::public.day_type,nullif(v_day->>'workout_id','')::uuid,nullif(btrim(v_day->>'notes'),''));
  end loop;
  return v_program_id;
end;
$$;

create or replace function public.duplicate_workout(p_workout_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.workouts(coach_id,name,is_ai_generated)
  select auth.uid(), left(name || ' (copy)',160), false from public.workouts
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
$$;

create or replace function public.rotate_assignment_link(p_assignment_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_token text;
begin
  update public.workout_assignments
  set assignment_token=encode(extensions.gen_random_bytes(32),'hex'), expires_at=now()+interval '180 days', revoked_at=null
  where id=p_assignment_id and coach_id=auth.uid() returning assignment_token into v_token;
  if v_token is null then raise exception 'Assignment not found'; end if;
  return v_token;
end;
$$;

revoke all on function public.get_shared_workout(text) from public, anon, authenticated;
revoke all on function public.submit_workout_feedback(text,text,integer,text,integer) from public, anon, authenticated;
revoke all on function public.save_program(uuid,text,text,integer,jsonb) from public, anon, authenticated;
revoke all on function public.duplicate_workout(uuid) from public, anon, authenticated;
revoke all on function public.rotate_assignment_link(uuid) from public, anon, authenticated;
grant execute on function public.get_shared_workout(text) to anon, authenticated, service_role;
grant execute on function public.submit_workout_feedback(text,text,integer,text,integer) to anon, authenticated, service_role;
grant execute on function public.save_program(uuid,text,text,integer,jsonb) to authenticated, service_role;
grant execute on function public.duplicate_workout(uuid) to authenticated, service_role;
grant execute on function public.rotate_assignment_link(uuid) to authenticated, service_role;
