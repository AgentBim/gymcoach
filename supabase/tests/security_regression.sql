-- Read-only security assertions. Run after migrations in CI or the SQL editor.
do $$
begin
  if has_table_privilege('anon', 'public.workouts', 'select') then
    raise exception 'anon must not select workouts directly';
  end if;
  if has_table_privilege('anon', 'public.workout_exercises', 'select') then
    raise exception 'anon must not select workout exercises directly';
  end if;
  if has_table_privilege('anon', 'public.workout_prehab', 'select') then
    raise exception 'anon must not select workout prehab directly';
  end if;
  if has_table_privilege('anon', 'public.workout_feedback', 'insert') then
    raise exception 'anon must not insert feedback directly';
  end if;
  if not has_function_privilege('anon', 'public.get_shared_workout(text)', 'execute') then
    raise exception 'anon must be able to execute get_shared_workout';
  end if;
  if not has_function_privilege(
    'anon',
    'public.submit_workout_feedback(text,text,integer,text,integer)',
    'execute'
  ) then
    raise exception 'anon must be able to execute submit_workout_feedback';
  end if;
  if has_function_privilege('anon', 'public.handle_new_user()', 'execute') then
    raise exception 'auth trigger helper must not be publicly executable';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.save_workout(uuid,text,boolean,jsonb,jsonb)',
    'execute'
  ) then
    raise exception 'authenticated users must be able to save workouts';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.save_program(uuid,text,text,integer,jsonb)',
    'execute'
  ) then
    raise exception 'authenticated users must be able to save programs';
  end if;
  if not has_function_privilege('authenticated', 'public.duplicate_workout(uuid)', 'execute') then
    raise exception 'authenticated users must be able to duplicate workouts';
  end if;
  if has_function_privilege('anon', 'public.save_program(uuid,text,text,integer,jsonb)', 'execute') then
    raise exception 'anon must not be able to save programs';
  end if;
  if has_function_privilege('anon', 'public.duplicate_workout(uuid)', 'execute') then
    raise exception 'anon must not be able to duplicate workouts';
  end if;
end;
$$;
