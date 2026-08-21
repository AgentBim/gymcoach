
-- ── ATHLETES ─────────────────────────────────────────────────────
create table public.athletes (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  full_name text not null,
  group_name text,
  level text,
  notes text,
  created_at timestamptz default now() not null
);

alter table public.athletes enable row level security;

create policy "Coaches manage own athletes"
  on public.athletes for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create index idx_athletes_coach_id on public.athletes(coach_id);

-- ── WORKOUT ASSIGNMENTS ──────────────────────────────────────────
create table public.workout_assignments (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  assigned_at timestamptz default now() not null,
  unique(workout_id, athlete_id)
);

alter table public.workout_assignments enable row level security;

create policy "Coaches manage own assignments"
  on public.workout_assignments for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create index idx_assignments_coach_id on public.workout_assignments(coach_id);
create index idx_assignments_athlete_id on public.workout_assignments(athlete_id);
create index idx_assignments_workout_id on public.workout_assignments(workout_id);
