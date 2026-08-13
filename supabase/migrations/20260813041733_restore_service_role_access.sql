-- Keep privileged server integrations functional after removing PUBLIC grants.
grant select, insert, update, delete on table public.coaches, public.exercises,
  public.workouts, public.workout_exercises, public.workout_prehab,
  public.workout_feedback, public.athletes, public.workout_assignments,
  public.programs, public.program_days to service_role;
grant execute on function public.get_shared_workout(text) to service_role;
grant execute on function public.submit_workout_feedback(text, text, integer, text, text, integer)
  to service_role;
grant execute on function public.save_workout(uuid, text, boolean, jsonb, jsonb)
  to service_role;

-- Separate custom-exercise mutation policies so SELECT has one policy only.
drop policy if exists "Coaches manage own custom exercises" on public.exercises;
create policy "Coaches insert own custom exercises"
on public.exercises for insert to authenticated
with check (coach_id = (select auth.uid()) and is_custom = true);
create policy "Coaches update own custom exercises"
on public.exercises for update to authenticated
using (coach_id = (select auth.uid()))
with check (coach_id = (select auth.uid()) and is_custom = true);
create policy "Coaches delete own custom exercises"
on public.exercises for delete to authenticated
using (coach_id = (select auth.uid()));
