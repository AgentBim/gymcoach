
-- Add category and prehab_focus to exercises
create type exercise_category as enum ('strength', 'prehab', 'mobility');
create type prehab_focus as enum ('activation', 'stability', 'mobility', 'strength');

alter table public.exercises
  add column if not exists category exercise_category not null default 'strength',
  add column if not exists prehab_focus prehab_focus;

create index idx_exercises_category on public.exercises(category);

-- workout_prehab join table
create table public.workout_prehab (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position int not null default 0,
  sets int not null default 2,
  reps int,
  duration_seconds int,
  rest_seconds int not null default 20,
  created_at timestamptz default now() not null
);

alter table public.workout_prehab enable row level security;

create policy "Coaches manage own workout prehab"
  on public.workout_prehab for all
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.coach_id = auth.uid()
    )
  );

create policy "Public can view workout prehab"
  on public.workout_prehab for select
  using (true);

create index idx_workout_prehab_workout_id on public.workout_prehab(workout_id);
