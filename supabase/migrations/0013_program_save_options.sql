-- Save options for the program editor (docs/plans/mockup-parity.md, Phase 3):
-- "When does this change reach athletes?" and "what happens to personal
-- adjustments?".
--
-- 1. Orphan cleanup must respect overrides. save_program and delete_program
--    delete a program's generated workouts that nothing references. An
--    athlete_day_overrides row now counts as a reference (otherwise "leave
--    this week" would point an override at a workout the same save deletes,
--    and the FK would null it). Patched in place from the live definitions
--    (0007/0009) so everything else about the two functions is unchanged.
--
-- 2. save_program_with_options(..., p_today, p_apply, p_adjustments) wraps
--    save_program in one transaction:
--      p_apply 'now'   the change is live for everyone straight away (today's
--                      behaviour).
--      p_apply 'next'  "leave this week": every athlete already inside the
--                      program keeps the OLD plan for the days still ahead of
--                      them this week, written as personal overrides, so the
--                      change shows from their next pass. Personal changes
--                      they already have win (on conflict do nothing); days
--                      they already logged are skipped.
--      p_adjustments 'keep'   personal adjustments stay.
--                    'reset'  personal adjustments from today on are deleted
--                             for athletes on this program, before the
--                             leave-this-week rows are written.
--    p_today is the coach's local date (within a day of the server's).
--    SECURITY INVOKER with search_path '', as save_program.

do $patch$
declare
  v_name text;
  v_def text;
  v_old constant text := 'and not exists (select 1 from public.workout_assignments wa where wa.workout_id = w.id)';
  v_new constant text := E'and not exists (select 1 from public.workout_assignments wa where wa.workout_id = w.id)\n     and not exists (select 1 from public.athlete_day_overrides o where o.workout_id = w.id)';
begin
  foreach v_name in array array['save_program', 'delete_program'] loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_name;
    if position(v_old in v_def) = 0 then
      raise exception 'cleanup clause not found in %', v_name;
    end if;
    if position('athlete_day_overrides' in v_def) > 0 then
      continue;
    end if;
    execute replace(v_def, v_old, v_new);
  end loop;
end
$patch$;

create or replace function public.save_program_with_options(
  p_program_id uuid,
  p_name text,
  p_description text,
  p_weeks integer,
  p_workouts jsonb,
  p_days jsonb,
  p_today date,
  p_apply text default 'now',
  p_adjustments text default 'keep'
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_old_weeks integer;
  v_old jsonb := '[]'::jsonb;
  v_a record;
  v_diff integer;
  v_old_week integer;
  v_new_week integer;
  v_monday date;
  v_date date;
  v_d integer;
  v_oc jsonb;
  v_nc jsonb;
  v_changed boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_apply not in ('now', 'next') then
    raise exception 'Invalid apply option';
  end if;
  if p_adjustments not in ('keep', 'reset') then
    raise exception 'Invalid adjustments option';
  end if;
  if p_today is null or abs(p_today - current_date) > 1 then
    raise exception 'Invalid date';
  end if;

  if p_program_id is not null then
    select duration_weeks into v_old_weeks from public.programs where id = p_program_id and coach_id = v_uid;
    if v_old_weeks is null then
      raise exception 'Program not found or access denied';
    end if;
    select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_old from public.program_days d where d.program_id = p_program_id;

    -- Reset: drop every personal change from today on, for athletes on this program.
    if p_adjustments = 'reset' then
      delete from public.athlete_day_overrides o
       using public.athletes a
       where o.athlete_id = a.id
         and a.active_program_id = p_program_id
         and a.coach_id = v_uid
         and o.date >= p_today;
    end if;

    -- Leave this week: athletes already mid-week keep the OLD plan for the
    -- days still ahead of them this week, as personal overrides. Anything
    -- they were already given personally stays (on conflict do nothing).
    if p_apply = 'next' then
      v_monday := date_trunc('week', p_today)::date;
      for v_a in
        select a.id, a.program_started_on
          from public.athletes a
         where a.active_program_id = p_program_id
           and a.coach_id = v_uid
           and a.program_started_on is not null
           and a.program_started_on <= p_today
      loop
        v_diff := (v_monday - date_trunc('week', v_a.program_started_on)::date) / 7;
        v_old_week := (((v_diff % v_old_weeks) + v_old_weeks) % v_old_weeks) + 1;
        v_new_week := (((v_diff % p_weeks) + p_weeks) % p_weeks) + 1;
        for v_d in 0..6 loop
          v_date := v_monday + v_d;
          continue when v_date < p_today;
          continue when exists (select 1 from public.workout_feedback f where f.athlete_id = v_a.id and f.completed_date = v_date);

          select c into v_oc from jsonb_array_elements(v_old) c
           where (c ->> 'week_number')::integer = v_old_week and (c ->> 'day_of_week')::integer = v_d limit 1;
          select c into v_nc from jsonb_array_elements(p_days) c
           where (c ->> 'week')::integer = v_new_week and (c ->> 'day')::integer = v_d limit 1;

          v_changed :=
            coalesce(v_oc ->> 'day_type', 'rest') is distinct from coalesce(v_nc ->> 'day_type', 'rest')
            or (v_oc ->> 'workout_id') is distinct from (v_nc ->> 'workout_id')
            or (v_nc ->> 'workout_ref') is not null
            or nullif(btrim(coalesce(v_oc ->> 'notes', '')), '') is distinct from nullif(btrim(coalesce(v_nc ->> 'notes', '')), '');

          if v_changed then
            insert into public.athlete_day_overrides (athlete_id, coach_id, date, day_type, workout_id, notes)
            values (
              v_a.id, v_uid, v_date,
              coalesce(v_oc ->> 'day_type', 'rest')::public.day_type,
              (v_oc ->> 'workout_id')::uuid,
              nullif(btrim(coalesce(v_oc ->> 'notes', '')), '')
            )
            on conflict (athlete_id, date) do nothing;
          end if;
        end loop;
      end loop;
    end if;
  end if;

  return public.save_program(p_program_id, p_name, p_description, p_weeks, p_workouts, p_days);
end;
$function$;

revoke execute on function public.save_program_with_options(uuid, text, text, integer, jsonb, jsonb, date, text, text) from public, anon;
grant execute on function public.save_program_with_options(uuid, text, text, integer, jsonb, jsonb, date, text, text) to authenticated;
