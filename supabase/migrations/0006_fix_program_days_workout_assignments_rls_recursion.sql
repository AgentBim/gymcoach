-- Fixes a critical regression found while auditing a user report that
-- generated program workouts weren't saving. The bug was NOT in the
-- newly-shipped "Generate program" feature — it was a structural RLS
-- policy cycle introduced by the athlete_streaks migration (0001), silently
-- breaking every write to program_days AND workout_assignments for anyone
-- since then.
--
-- The cycle: program_days' and workout_assignments' write-check policies
-- each queried workouts (to verify the coach owns the workout being
-- scheduled/assigned). Once 0001 added "athletes can view assigned or
-- scheduled workouts" to workouts, that policy queries back into
-- program_days and workout_assignments to determine athlete visibility.
-- Postgres' RLS query-rewriter detects this at planning time regardless of
-- actual row values, and fails the whole statement with
-- "infinite recursion detected in policy for relation ..." (42P17).
--
-- Fixed by moving the workout-ownership check into a SECURITY DEFINER
-- helper that reads workouts while bypassing its RLS entirely, breaking
-- the cycle at its one shared edge without changing the authorization
-- logic itself. EXECUTE is restricted to authenticated only.

create or replace function public.workout_owned_by_coach(p_workout_id uuid, p_coach_id uuid)
returns boolean
language sql
security definer
stable
set search_path to ''
as $function$
  select exists (
    select 1 from public.workouts where id = p_workout_id and coach_id = p_coach_id
  )
$function$;

revoke execute on function public.workout_owned_by_coach(uuid, uuid) from public, anon;
grant execute on function public.workout_owned_by_coach(uuid, uuid) to authenticated;

drop policy if exists "Coaches manage own program days" on public.program_days;
create policy "Coaches manage own program days" on public.program_days for all
  using (exists (select 1 from public.programs p where p.id = program_days.program_id and p.coach_id = (select auth.uid())))
  with check (
    exists (select 1 from public.programs p where p.id = program_days.program_id and p.coach_id = (select auth.uid()))
    and (workout_id is null or public.workout_owned_by_coach(workout_id, (select auth.uid())))
  );

drop policy if exists "Coaches manage own assignments" on public.workout_assignments;
create policy "Coaches manage own assignments" on public.workout_assignments for all
  using ((select auth.uid()) = coach_id)
  with check (
    (select auth.uid()) = coach_id
    and public.workout_owned_by_coach(workout_id, (select auth.uid()))
    and exists (select 1 from public.athletes a where a.id = workout_assignments.athlete_id and a.coach_id = (select auth.uid()))
  );
