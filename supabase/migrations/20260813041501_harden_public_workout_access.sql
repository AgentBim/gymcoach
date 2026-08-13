-- Replace anonymous table access with token-scoped RPCs and harden ownership.

drop policy if exists "Public can view workout by share token" on public.workouts;
drop policy if exists "Public can view workout exercises by share" on public.workout_exercises;
drop policy if exists "Public can view workout prehab" on public.workout_prehab;
drop policy if exists "Anyone can submit feedback" on public.workout_feedback;
drop policy if exists "Anyone can view exercises" on public.exercises;

-- Scope coach policies to signed-in users and use init-plan-friendly auth checks.
alter policy "Coaches can view own workouts" on public.workouts
  to authenticated using ((select auth.uid()) = coach_id);
alter policy "Coaches can insert own workouts" on public.workouts
  to authenticated with check ((select auth.uid()) = coach_id);
alter policy "Coaches can update own workouts" on public.workouts
  to authenticated using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);
alter policy "Coaches can delete own workouts" on public.workouts
  to authenticated using ((select auth.uid()) = coach_id);

alter policy "Coaches can manage own workout exercises" on public.workout_exercises
  to authenticated
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.coach_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workouts w
    join public.exercises e on e.id = workout_exercises.exercise_id
    where w.id = workout_exercises.workout_id
      and w.coach_id = (select auth.uid())
      and (e.coach_id is null or e.coach_id = (select auth.uid()))
  ));

alter policy "Coaches manage own workout prehab" on public.workout_prehab
  to authenticated
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_prehab.workout_id
      and w.coach_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workouts w
    join public.exercises e on e.id = workout_prehab.exercise_id
    where w.id = workout_prehab.workout_id
      and w.coach_id = (select auth.uid())
      and (e.coach_id is null or e.coach_id = (select auth.uid()))
  ));

create policy "Authenticated coaches can view exercise library"
on public.exercises for select to authenticated
using (coach_id is null or coach_id = (select auth.uid()));

alter policy "Coaches manage own custom exercises" on public.exercises
  to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()) and is_custom = true);

alter policy "Coaches can read own workout feedback" on public.workout_feedback
  to authenticated
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_feedback.workout_id
      and w.coach_id = (select auth.uid())
  ));

alter policy "Coaches manage own athletes" on public.athletes
  to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);

alter policy "Coaches manage own programs" on public.programs
  to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);

alter policy "Coaches manage own assignments" on public.workout_assignments
  to authenticated
  using ((select auth.uid()) = coach_id)
  with check (
    (select auth.uid()) = coach_id
    and exists (
      select 1 from public.workouts w
      where w.id = workout_assignments.workout_id and w.coach_id = (select auth.uid())
    )
    and exists (
      select 1 from public.athletes a
      where a.id = workout_assignments.athlete_id and a.coach_id = (select auth.uid())
    )
  );

alter policy "Coaches manage own program days" on public.program_days
  to authenticated
  using (exists (
    select 1 from public.programs p
    where p.id = program_days.program_id and p.coach_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.programs p
      where p.id = program_days.program_id and p.coach_id = (select auth.uid())
    )
    and (
      workout_id is null or exists (
        select 1 from public.workouts w
        where w.id = program_days.workout_id and w.coach_id = (select auth.uid())
      )
    )
  );

alter policy "Coaches can view own profile" on public.coaches
  to authenticated using ((select auth.uid()) = id);
alter policy "Coaches can update own profile" on public.coaches
  to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Reject malformed values even when requests bypass the UI.
alter table public.workouts
  add constraint workouts_name_length check (char_length(btrim(name)) between 1 and 160);
alter table public.athletes
  add constraint athletes_name_length check (char_length(btrim(full_name)) between 1 and 120),
  add constraint athletes_notes_length check (notes is null or char_length(notes) <= 5000);
alter table public.programs
  add constraint programs_name_length check (char_length(btrim(name)) between 1 and 160),
  add constraint programs_description_length check (description is null or char_length(description) <= 5000),
  add constraint programs_duration_weeks_range check (duration_weeks between 1 and 104);
alter table public.workout_feedback
  add constraint feedback_emoji_valid check (emoji_rating is null or emoji_rating in ('easy', 'good', 'hard', 'veryhard')),
  add constraint feedback_notes_length check (notes is null or char_length(notes) <= 1000),
  add constraint feedback_athlete_name_length check (athlete_name is null or char_length(athlete_name) <= 120),
  add constraint feedback_completion_valid check (
    exercises_completed >= 0 and exercises_total >= 0 and exercises_completed <= exercises_total
  );
alter table public.workout_exercises
  add constraint workout_exercises_values_valid check (
    position >= 0 and sets between 1 and 100
    and (reps is null or reps between 1 and 10000)
    and (duration_seconds is null or duration_seconds between 1 and 86400)
    and rest_seconds between 0 and 86400
  );
alter table public.workout_prehab
  add constraint workout_prehab_values_valid check (
    position >= 0 and sets between 1 and 100
    and (reps is null or reps between 1 and 10000)
    and (duration_seconds is null or duration_seconds between 1 and 86400)
    and rest_seconds between 0 and 86400
  );

-- Return only the workout addressed by an unguessable share token. This
-- function deliberately bypasses RLS, so its output is explicitly shaped.
create or replace function public.get_shared_workout(p_share_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'workout', jsonb_build_object(
      'id', w.id,
      'name', w.name,
      'created_at', w.created_at,
      'coaches', jsonb_build_object('full_name', c.full_name)
    ),
    'exercises', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', we.id,
          'position', we.position,
          'sets', we.sets,
          'reps', we.reps,
          'duration_seconds', we.duration_seconds,
          'rest_seconds', we.rest_seconds,
          'exercises', jsonb_build_object(
            'id', e.id,
            'name', e.name,
            'description', e.description,
            'muscle_group', e.muscle_group,
            'difficulty', e.difficulty
          )
        ) order by we.position
      )
      from public.workout_exercises we
      join public.exercises e on e.id = we.exercise_id
      where we.workout_id = w.id
    ), '[]'::jsonb),
    'prehab', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', wp.id,
          'position', wp.position,
          'sets', wp.sets,
          'reps', wp.reps,
          'duration_seconds', wp.duration_seconds,
          'rest_seconds', wp.rest_seconds,
          'exercises', jsonb_build_object(
            'id', e.id,
            'name', e.name,
            'description', e.description,
            'muscle_group', e.muscle_group,
            'difficulty', e.difficulty,
            'prehab_focus', e.prehab_focus
          )
        ) order by wp.position
      )
      from public.workout_prehab wp
      join public.exercises e on e.id = wp.exercise_id
      where wp.workout_id = w.id
    ), '[]'::jsonb)
  )
  from public.workouts w
  join public.coaches c on c.id = w.coach_id
  where length(p_share_token) = 24
    and p_share_token ~ '^[0-9a-f]+$'
    and w.share_token = p_share_token;
$$;

create or replace function public.submit_workout_feedback(
  p_share_token text,
  p_emoji_rating text default null,
  p_rpe integer default null,
  p_notes text default null,
  p_athlete_name text default null,
  p_exercises_completed integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workout_id uuid;
  v_total integer;
  v_feedback_id uuid;
begin
  if p_share_token is null or length(p_share_token) <> 24
     or p_share_token !~ '^[0-9a-f]+$' then
    raise exception 'Invalid share token';
  end if;

  select w.id,
         (select count(*)::integer from public.workout_exercises we where we.workout_id = w.id)
    into v_workout_id, v_total
  from public.workouts w
  where w.share_token = p_share_token;

  if v_workout_id is null then
    raise exception 'Workout not found';
  end if;
  if p_emoji_rating is not null and p_emoji_rating not in ('easy', 'good', 'hard', 'veryhard') then
    raise exception 'Invalid rating';
  end if;
  if p_rpe is not null and (p_rpe < 1 or p_rpe > 10) then
    raise exception 'RPE must be between 1 and 10';
  end if;
  if length(coalesce(p_notes, '')) > 1000 or length(coalesce(p_athlete_name, '')) > 120 then
    raise exception 'Feedback is too long';
  end if;
  if p_exercises_completed < 0 or p_exercises_completed > v_total then
    raise exception 'Invalid completed exercise count';
  end if;
  if (select count(*) from public.workout_feedback f
      where f.share_token = p_share_token
        and f.submitted_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many recent feedback submissions';
  end if;

  insert into public.workout_feedback (
    workout_id, share_token, emoji_rating, rpe, notes,
    exercises_completed, exercises_total, athlete_name
  ) values (
    v_workout_id, p_share_token, p_emoji_rating, p_rpe,
    nullif(btrim(p_notes), ''), p_exercises_completed, v_total,
    nullif(btrim(p_athlete_name), '')
  ) returning id into v_feedback_id;

  return v_feedback_id;
end;
$$;

-- Trigger helpers are not API endpoints.
alter function public.handle_new_user() set search_path = '';
alter function public.set_updated_at() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Anonymous callers receive only the two deliberately exposed operations.
revoke all on table public.coaches, public.exercises, public.workouts,
  public.workout_exercises, public.workout_prehab, public.workout_feedback,
  public.athletes, public.workout_assignments, public.programs,
  public.program_days from public, anon;

revoke all on function public.get_shared_workout(text) from public, anon, authenticated;
revoke all on function public.submit_workout_feedback(text, text, integer, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.get_shared_workout(text) to anon, authenticated;
grant execute on function public.submit_workout_feedback(text, text, integer, text, text, integer)
  to anon, authenticated;

-- Restore the application privileges for signed-in coaches.
grant select, insert, update, delete on table public.coaches, public.exercises,
  public.workouts, public.workout_exercises, public.workout_prehab,
  public.workout_feedback, public.athletes, public.workout_assignments,
  public.programs, public.program_days to authenticated;

create index if not exists idx_program_days_workout_id on public.program_days(workout_id);
create index if not exists idx_workout_exercises_exercise_id on public.workout_exercises(exercise_id);
create index if not exists idx_workout_prehab_exercise_id on public.workout_prehab(exercise_id);
drop index if exists public.idx_workouts_share_token;
