
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- COACHES (extends Supabase Auth)
-- ============================================================
create table public.coaches (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  created_at timestamptz default now() not null
);

alter table public.coaches enable row level security;

create policy "Coaches can view own profile"
  on public.coaches for select
  using (auth.uid() = id);

create policy "Coaches can update own profile"
  on public.coaches for update
  using (auth.uid() = id);

-- Auto-create coach profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.coaches (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- EXERCISES (global library, readable by all authenticated users)
-- ============================================================
create type muscle_group as enum ('Arms', 'Back', 'Legs', 'Core', 'Shoulders');
create type difficulty_level as enum ('Easy', 'Medium', 'Hard');

create table public.exercises (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text not null,
  muscle_group muscle_group not null,
  difficulty difficulty_level not null,
  default_sets int not null default 3,
  default_reps int,
  default_duration_seconds int,
  default_rest_seconds int not null default 30,
  created_at timestamptz default now() not null
);

alter table public.exercises enable row level security;

create policy "Anyone authenticated can view exercises"
  on public.exercises for select
  using (auth.role() = 'authenticated');

create index idx_exercises_muscle_group on public.exercises(muscle_group);
create index idx_exercises_difficulty on public.exercises(difficulty);

-- ============================================================
-- WORKOUTS (owned by a coach)
-- ============================================================
create table public.workouts (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  name text not null,
  share_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.workouts enable row level security;

create policy "Coaches can view own workouts"
  on public.workouts for select
  using (auth.uid() = coach_id);

create policy "Coaches can insert own workouts"
  on public.workouts for insert
  with check (auth.uid() = coach_id);

create policy "Coaches can update own workouts"
  on public.workouts for update
  using (auth.uid() = coach_id);

create policy "Coaches can delete own workouts"
  on public.workouts for delete
  using (auth.uid() = coach_id);

create policy "Public can view workout by share token"
  on public.workouts for select
  using (true);

create index idx_workouts_coach_id on public.workouts(coach_id);
create index idx_workouts_share_token on public.workouts(share_token);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workouts_updated_at
  before update on public.workouts
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- WORKOUT EXERCISES (join table with order + overrides)
-- ============================================================
create table public.workout_exercises (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position int not null default 0,
  sets int not null,
  reps int,
  duration_seconds int,
  rest_seconds int not null,
  created_at timestamptz default now() not null
);

alter table public.workout_exercises enable row level security;

create policy "Coaches can manage own workout exercises"
  on public.workout_exercises for all
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.coach_id = auth.uid()
    )
  );

create policy "Public can view workout exercises by share"
  on public.workout_exercises for select
  using (true);

create index idx_workout_exercises_workout_id on public.workout_exercises(workout_id);
create index idx_workout_exercises_position on public.workout_exercises(workout_id, position);
