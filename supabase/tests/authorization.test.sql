begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

-- Two independent tenants. The signup trigger creates the matching coach rows.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'coach-a@example.test', '{"full_name":"Coach A"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'coach-b@example.test', '{"full_name":"Coach B"}'::jsonb);

insert into public.workouts (id, coach_id, name)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Coach A workout'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Coach B workout');

insert into public.athletes (id, coach_id, full_name)
values
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Athlete Valid'),
  ('a2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Athlete Expired'),
  ('a3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Athlete Revoked'),
  ('b1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Athlete B');

insert into public.workout_assignments (
  id, workout_id, athlete_id, coach_id, assignment_token, expires_at, revoked_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a1111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    repeat('a', 64), now() + interval '1 day', null
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a2222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    repeat('b', 64), now() - interval '1 second', null
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a3333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    repeat('c', 64), now() + interval '1 day', now()
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'b1111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    repeat('d', 64), now() + interval '1 day', null
  );

select ok(
  not has_table_privilege('anon', 'public.workouts', 'select'),
  'anonymous callers cannot read workouts directly'
);
select ok(
  not has_table_privilege('anon', 'public.workout_feedback', 'insert'),
  'anonymous callers cannot insert feedback directly'
);
select ok(
  has_function_privilege('anon', 'public.get_shared_workout(text)', 'execute'),
  'anonymous callers can use the shaped shared-workout RPC'
);
select ok(
  has_function_privilege(
    'anon',
    'public.submit_workout_feedback(text,text,integer,text,integer)',
    'execute'
  ),
  'anonymous callers can use the validated feedback RPC'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select count(*) from public.workouts),
  1::bigint,
  'coach A sees only their workout'
);
select is(
  (select count(*) from public.athletes where id = 'b1111111-1111-4111-8111-111111111111'),
  0::bigint,
  'coach A cannot read coach B athletes'
);
select is(
  (select count(*) from public.workout_assignments where id = '40000000-0000-4000-8000-000000000004'),
  0::bigint,
  'coach A cannot read coach B assignments'
);
select is_empty(
  $$
    update public.workouts
    set name = 'Cross-tenant overwrite'
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    returning id
  $$,
  'coach A cannot update coach B workout'
);
select throws_ok(
  $$
    insert into public.workouts (coach_id, name)
    values ('22222222-2222-4222-8222-222222222222', 'Cross-tenant insert')
  $$,
  '42501',
  'new row violates row-level security policy for table "workouts"',
  'coach A cannot insert a workout owned by coach B'
);
select throws_ok(
  $$
    insert into public.workout_assignments (
      workout_id, athlete_id, coach_id, assignment_token, expires_at
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'b1111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111',
      repeat('e', 64),
      now() + interval '1 day'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "workout_assignments"',
  'coach A cannot assign coach B athlete'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select is(
  (select count(*) from public.workouts),
  1::bigint,
  'coach B sees only their workout'
);

reset role;
reset request.jwt.claim.sub;
reset request.jwt.claim.role;
set local role anon;

select is(
  public.get_shared_workout(repeat('a', 64))->'workout'->>'athlete_name',
  'Athlete Valid',
  'active link returns only its assigned athlete'
);
select ok(
  public.get_shared_workout(repeat('b', 64)) is null,
  'expired link returns no workout'
);
select ok(
  public.get_shared_workout(repeat('c', 64)) is null,
  'revoked link returns no workout'
);
select throws_ok(
  $$select public.submit_workout_feedback(repeat('b', 64), 'good', 5, null, 0)$$,
  'P0001',
  'Assignment not found or expired',
  'expired link cannot submit feedback'
);
select throws_ok(
  $$select public.submit_workout_feedback(repeat('c', 64), 'good', 5, null, 0)$$,
  'P0001',
  'Assignment not found or expired',
  'revoked link cannot submit feedback'
);
select lives_ok(
  $$select public.submit_workout_feedback(repeat('a', 64), 'good', 5, 'Completed', 0)$$,
  'active assignment can submit feedback once'
);
select throws_ok(
  $$select public.submit_workout_feedback(repeat('a', 64), 'hard', 7, null, 0)$$,
  'P0001',
  'Feedback has already been submitted for this assignment',
  'duplicate feedback is rejected'
);

reset role;
select is(
  (
    select count(*) from public.workout_feedback
    where assignment_id = '10000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'exactly one feedback row exists for the assignment'
);
select is(
  (
    select athlete_name from public.workout_feedback
    where assignment_id = '10000000-0000-4000-8000-000000000001'
  ),
  'Athlete Valid',
  'feedback identity comes from the assignment'
);

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
set local request.jwt.claim.role = 'authenticated';
select is(
  (select count(*) from public.workout_feedback),
  0::bigint,
  'coach B cannot read coach A feedback'
);

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select is(
  (select count(*) from public.workout_feedback),
  1::bigint,
  'coach A can read feedback for their workout'
);

select * from finish();
rollback;
