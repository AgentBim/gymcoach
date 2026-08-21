
-- ── Custom exercises: add coach_id + is_custom ───────────────────
alter table public.exercises
  add column if not exists coach_id uuid references public.coaches(id) on delete cascade,
  add column if not exists is_custom boolean not null default false;

-- Custom exercises: coaches can insert/update/delete their own
create policy "Coaches manage own custom exercises"
  on public.exercises for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

create index idx_exercises_coach_id on public.exercises(coach_id);

-- ── Athlete name on feedback ─────────────────────────────────────
alter table public.workout_feedback
  add column if not exists athlete_name text;

-- ── Programs ─────────────────────────────────────────────────────
create table public.programs (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  name text not null,
  description text,
  duration_weeks int not null default 1,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.programs enable row level security;

create policy "Coaches manage own programs"
  on public.programs for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create index idx_programs_coach_id on public.programs(coach_id);

create trigger programs_updated_at
  before update on public.programs
  for each row execute procedure public.set_updated_at();

-- ── Program days ─────────────────────────────────────────────────
create type day_type as enum ('training', 'rest', 'recovery', 'competition');

create table public.program_days (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references public.programs(id) on delete cascade,
  week_number int not null default 1,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Mon 6=Sun
  workout_id uuid references public.workouts(id) on delete set null,
  day_type day_type not null default 'training',
  notes text,
  created_at timestamptz default now() not null,
  unique(program_id, week_number, day_of_week)
);

alter table public.program_days enable row level security;

create policy "Coaches manage own program days"
  on public.program_days for all
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_id and p.coach_id = auth.uid()
    )
  );

create index idx_program_days_program_id on public.program_days(program_id);
