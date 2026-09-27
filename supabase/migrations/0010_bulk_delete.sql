-- Bulk delete for the coach's Home (workouts) and Programs lists. Both RPCs
-- are SECURITY INVOKER with search_path '', so every statement still runs
-- through the caller's RLS; no policy changes.
--
-- delete_workouts(p_workout_ids, p_keep_history default true)
--   Deletes the caller's workouts in one transaction. Returns
--   {"deleted": n, "kept": [ids], "skipped": n}.
--   - While p_keep_history is true, workouts with athlete history (any
--     workout_feedback row) are kept: deleting a workout cascade-deletes its
--     feedback, which is the athlete's History and streaks. The confirmation
--     sheet starts with this on.
--   - Workouts a program still owns (source_program_id not null) are never
--     deleted here; they're managed inside their program. Generated workouts
--     kept for history after their program was deleted (source is null) are
--     deletable: Home's "Kept for athlete history" section calls this with
--     p_keep_history = false after its own confirmation.
--   - Assignments cascade. Program days that used a deleted workout are left
--     without one (program_days.workout_id is ON DELETE SET NULL).
--   - Ids that aren't the caller's, or that a program owns, are skipped.
--   - The candidates are locked FOR UPDATE in their own statement first (as
--     in 0009), so a completion committing at the same moment is seen by the
--     history check instead of being cascade-deleted.
--
-- delete_programs(p_program_ids)
--   Runs delete_program (0007, locked in 0009) for each id in one
--   transaction, so if any id isn't the caller's program, nothing is
--   deleted. Returns the number of programs deleted.

create or replace function public.delete_workouts(p_workout_ids uuid[], p_keep_history boolean default true)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_kept uuid[] := '{}';
  v_deleted integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_workout_ids is null or cardinality(p_workout_ids) = 0 then
    raise exception 'Pick at least one workout';
  end if;
  if cardinality(p_workout_ids) > 200 then
    raise exception 'You can delete at most 200 workouts at once';
  end if;

  select coalesce(array_agg(c.id), '{}') into v_ids
    from (
      select w.id
        from public.workouts w
       where w.id = any (p_workout_ids)
         and w.coach_id = v_uid
         and w.source_program_id is null
         for update
    ) c;

  if coalesce(p_keep_history, true) then
    select coalesce(array_agg(t.id), '{}') into v_kept
      from unnest(v_ids) as t(id)
     where exists (select 1 from public.workout_feedback f where f.workout_id = t.id);
  end if;

  delete from public.workouts w
   where w.id = any (v_ids)
     and not (w.id = any (v_kept));
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'deleted', v_deleted,
    'kept', to_jsonb(v_kept),
    'skipped', (select count(distinct x) from unnest(p_workout_ids) x) - cardinality(v_ids)
  );
end;
$function$;

revoke execute on function public.delete_workouts(uuid[], boolean) from public, anon;
grant execute on function public.delete_workouts(uuid[], boolean) to authenticated;

create or replace function public.delete_programs(p_program_ids uuid[])
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  v_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_program_ids is null or cardinality(p_program_ids) = 0 then
    raise exception 'Pick at least one program';
  end if;
  if cardinality(p_program_ids) > 100 then
    raise exception 'You can delete at most 100 programs at once';
  end if;

  for v_id in select distinct x from unnest(p_program_ids) x loop
    perform public.delete_program(v_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke execute on function public.delete_programs(uuid[]) from public, anon;
grant execute on function public.delete_programs(uuid[]) to authenticated;
