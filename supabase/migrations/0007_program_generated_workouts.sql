-- Foundation for Program Tools (docs/handoffs/program-tools.md, Phase 1).
--
-- 1. Program-generated workouts. Workouts created by a program's tools are
--    flagged program_generated and linked back to their program through
--    source_program_id, so the coach's Home list can hide them and a program
--    can clean up the ones it no longer uses. Two columns, not one: when a
--    program is deleted, a generated workout that an athlete already
--    completed must survive (deleting it would cascade-delete their
--    workout_feedback), so it keeps program_generated = true while
--    source_program_id falls back to null. duplicate_workout copies neither
--    column, so a duplicate is automatically an ordinary hand-built workout.
--
-- 2. save_program replaces ProgramBuilder's client-side save, which updated
--    the program, deleted every program_days row and re-inserted them in
--    three unchecked requests. A failed insert silently wiped the schedule;
--    that is what hid the RLS recursion fixed in 0006. Everything now happens
--    in one transaction: any error rolls the whole save back and reaches the
--    builder as a readable message.
--
-- 3. delete_program deletes a program together with the generated workouts
--    it owns, except ones with athlete history.
--
-- Both RPCs are SECURITY INVOKER, so every statement still runs through the
-- caller's RLS. No policy changes: the existing workouts policies already
-- cover the new columns. Policies on workouts must not query program_days /
-- workout_assignments inline or the reverse (42P17, see 0006).
--
-- Orphan cleanup must never delete a workout with workout_feedback or
-- workout_assignments rows, because both cascade on workout delete. The
-- existence checks below run under the coach's RLS, and they see every such
-- row for the coach's own workouts:
--   - "Coaches can read own workout feedback" exposes all feedback on
--     workouts where coach_id = auth.uid().
--   - "Coaches manage own assignments" exposes rows where coach_id =
--     auth.uid(), and its WITH CHECK only lets an assignment be created with
--     the workout owner's coach_id.
-- Cleanup only ever targets workouts with coach_id = auth.uid().

alter table public.workouts
  add column program_generated boolean not null default false,
  add column source_program_id uuid references public.programs(id) on delete set null;

create index workouts_source_program_id_idx
  on public.workouts (source_program_id) where source_program_id is not null;

create or replace function public.save_program(
  p_program_id uuid,
  p_name text,
  p_description text,
  p_weeks integer,
  p_workouts jsonb default '[]'::jsonb,
  p_days jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_day_names constant text[] := array['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_workouts jsonb := coalesce(p_workouts, '[]'::jsonb);
  v_days jsonb := coalesce(p_days, '[]'::jsonb);
  v_program_id uuid;
  v_item jsonb;
  v_ref text;
  v_refs jsonb := '{}'::jsonb;     -- ref -> new or updated workout id
  v_ids uuid[] := '{}';
  v_seen text[] := '{}';
  v_week numeric;
  v_day numeric;
  v_label text;
  v_workout_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- 1. Validate everything before writing anything.
  if v_name = '' then
    raise exception 'Program name is required';
  end if;
  if char_length(v_name) > 160 then
    raise exception 'Program name must be 160 characters or fewer';
  end if;
  if char_length(coalesce(v_description, '')) > 5000 then
    raise exception 'Description must be 5000 characters or fewer';
  end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 12 then
    raise exception 'A program must be between 1 and 12 weeks long';
  end if;
  if jsonb_typeof(v_workouts) <> 'array' or jsonb_typeof(v_days) <> 'array' then
    raise exception 'Invalid program payload';
  end if;
  if jsonb_array_length(v_days) > 84 then
    raise exception 'A program can schedule at most 84 days';
  end if;
  if jsonb_array_length(v_workouts) > 84 then
    raise exception 'A program can save at most 84 generated workouts at once';
  end if;

  for v_item in select value from jsonb_array_elements(v_workouts) loop
    v_ref := v_item->>'ref';
    if jsonb_typeof(v_item) is distinct from 'object' or nullif(btrim(coalesce(v_ref, '')), '') is null then
      raise exception 'Every generated workout needs a ref';
    end if;
    if v_refs ? v_ref then
      raise exception 'Generated workout ref "%" is used twice', v_ref;
    end if;
    v_refs := v_refs || jsonb_build_object(v_ref, null);
    if v_item->>'id' is not null then
      if (v_item->>'id')::uuid = any (v_ids) then
        raise exception 'Generated workout % is sent twice', v_item->>'id';
      end if;
      v_ids := v_ids || (v_item->>'id')::uuid;
    end if;
    if nullif(btrim(coalesce(v_item->>'name', '')), '') is null then
      raise exception 'Every generated workout needs a name';
    end if;
    if char_length(btrim(v_item->>'name')) > 160 then
      raise exception 'Workout name "%" is longer than 160 characters', left(btrim(v_item->>'name'), 40) || '…';
    end if;
    if jsonb_typeof(v_item->'exercises') is distinct from 'array' or jsonb_array_length(v_item->'exercises') = 0 then
      raise exception 'Workout "%" needs at least one exercise', btrim(v_item->>'name');
    end if;
    if jsonb_array_length(v_item->'exercises') > 20 then
      raise exception 'Workout "%" has more than 20 exercises', btrim(v_item->>'name');
    end if;
    if v_item->'prehab' is not null and jsonb_typeof(v_item->'prehab') <> 'null' then
      if jsonb_typeof(v_item->'prehab') <> 'array' then
        raise exception 'Workout "%" has an invalid prehab list', btrim(v_item->>'name');
      end if;
      if jsonb_array_length(v_item->'prehab') > 20 then
        raise exception 'Workout "%" has more than 20 prehab exercises', btrim(v_item->>'name');
      end if;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(v_days) loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or jsonb_typeof(v_item->'week') is distinct from 'number'
       or jsonb_typeof(v_item->'day') is distinct from 'number' then
      raise exception 'Every scheduled day needs a numeric week and day';
    end if;
    v_week := (v_item->>'week')::numeric;
    v_day := (v_item->>'day')::numeric;
    if v_day <> trunc(v_day) or v_day < 0 or v_day > 6 then
      raise exception 'Day % is not a day of the week (0-6)', v_item->>'day';
    end if;
    if v_week <> trunc(v_week) or v_week < 1 or v_week > p_weeks then
      raise exception 'Week % is outside this %-week program', v_item->>'week', p_weeks;
    end if;
    v_label := format('Week %s · %s', v_week::integer, v_day_names[v_day::integer + 1]);
    if v_label = any (v_seen) then
      raise exception '% is scheduled twice', v_label;
    end if;
    v_seen := v_seen || v_label;
    if coalesce(v_item->>'day_type', '') <> all (enum_range(null::public.day_type)::text[]) then
      raise exception '% has an invalid day type "%"', v_label, coalesce(v_item->>'day_type', '');
    end if;
    if v_item->>'workout_id' is not null and v_item->>'workout_ref' is not null then
      raise exception '% points at both a saved and a generated workout', v_label;
    end if;
    if v_item->>'workout_ref' is not null and not (v_refs ? (v_item->>'workout_ref')) then
      raise exception '% points at a generated workout that was not sent', v_label;
    end if;
    if v_item->>'workout_id' is not null
       and not public.workout_owned_by_coach((v_item->>'workout_id')::uuid, v_uid) then
      raise exception '% uses a workout that does not exist or is not yours', v_label;
    end if;
    if char_length(coalesce(v_item->>'notes', '')) > 1000 then
      raise exception '% has a note longer than 1000 characters', v_label;
    end if;
  end loop;

  -- 2. The program itself.
  if p_program_id is null then
    insert into public.programs (coach_id, name, description, duration_weeks)
    values (v_uid, v_name, v_description, p_weeks)
    returning id into v_program_id;
  else
    update public.programs
       set name = v_name,
           description = v_description,
           duration_weeks = p_weeks
     where id = p_program_id
       and coach_id = v_uid
    returning id into v_program_id;

    if v_program_id is null then
      raise exception 'Program not found or access denied';
    end if;
  end if;

  -- 3. New and changed program-generated workouts, same shape as save_workout.
  v_refs := '{}'::jsonb;
  for v_item in select value from jsonb_array_elements(v_workouts) loop
    if v_item->>'id' is null then
      insert into public.workouts (coach_id, name, is_ai_generated, program_generated, source_program_id)
      values (v_uid, btrim(v_item->>'name'), false, true, v_program_id)
      returning id into v_workout_id;
    else
      update public.workouts
         set name = btrim(v_item->>'name')
       where id = (v_item->>'id')::uuid
         and coach_id = v_uid
         and source_program_id = v_program_id
      returning id into v_workout_id;

      if v_workout_id is null then
        raise exception 'Workout "%" is not one of this program''s generated workouts', btrim(v_item->>'name');
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
    from jsonb_array_elements(v_item->'exercises') item;

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
    from jsonb_array_elements(
      case when jsonb_typeof(v_item->'prehab') = 'array' then v_item->'prehab' else '[]'::jsonb end
    ) item;

    v_refs := v_refs || jsonb_build_object(v_item->>'ref', v_workout_id);
  end loop;

  -- 4 + 5. Replace the schedule, resolving draft refs to the ids created above.
  delete from public.program_days where program_id = v_program_id;

  insert into public.program_days (program_id, week_number, day_of_week, day_type, workout_id, notes)
  select
    v_program_id,
    (d->>'week')::numeric::integer,
    (d->>'day')::numeric::integer,
    (d->>'day_type')::public.day_type,
    coalesce((v_refs->>(d->>'workout_ref'))::uuid, (d->>'workout_id')::uuid),
    nullif(btrim(coalesce(d->>'notes', '')), '')
  from jsonb_array_elements(v_days) d;

  -- 6. Orphan cleanup. A generated workout survives if any program still
  -- schedules it, or if it has athlete feedback or assignments (both cascade
  -- on delete). See the header for why these checks see every row.
  delete from public.workouts w
   where w.source_program_id = v_program_id
     and w.coach_id = v_uid
     and not exists (select 1 from public.program_days pd where pd.workout_id = w.id)
     and not exists (select 1 from public.workout_feedback f where f.workout_id = w.id)
     and not exists (select 1 from public.workout_assignments wa where wa.workout_id = w.id);

  return v_program_id;
end;
$function$;

revoke execute on function public.save_program(uuid, text, text, integer, jsonb, jsonb) from public, anon;
grant execute on function public.save_program(uuid, text, text, integer, jsonb, jsonb) to authenticated;

create or replace function public.delete_program(p_program_id uuid)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_program_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select id into v_program_id
    from public.programs
   where id = p_program_id
     and coach_id = v_uid;

  if v_program_id is null then
    raise exception 'Program not found or access denied';
  end if;

  -- Generated workouts go with their program unless an athlete has history
  -- on them or another program still schedules them. The survivors keep
  -- program_generated = true, and source_program_id becomes null through
  -- the foreign key when the program row goes.
  delete from public.workouts w
   where w.source_program_id = v_program_id
     and w.coach_id = v_uid
     and not exists (
       select 1 from public.program_days pd
        where pd.workout_id = w.id and pd.program_id <> v_program_id
     )
     and not exists (select 1 from public.workout_feedback f where f.workout_id = w.id)
     and not exists (select 1 from public.workout_assignments wa where wa.workout_id = w.id);

  -- program_days cascade; athletes.active_program_id is set to null.
  delete from public.programs where id = v_program_id and coach_id = v_uid;
end;
$function$;

revoke execute on function public.delete_program(uuid) from public, anon;
grant execute on function public.delete_program(uuid) to authenticated;
