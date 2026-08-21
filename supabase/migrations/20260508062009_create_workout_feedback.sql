
create table public.workout_feedback (
  id uuid primary key default uuid_generate_v4(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  share_token text not null,
  emoji_rating text,
  rpe int check (rpe >= 1 and rpe <= 10),
  notes text,
  exercises_completed int not null default 0,
  exercises_total int not null default 0,
  submitted_at timestamptz default now() not null
);

alter table public.workout_feedback enable row level security;

-- Anyone can insert feedback (no auth needed — athlete share link)
create policy "Anyone can submit feedback"
  on public.workout_feedback for insert
  with check (true);

-- Only the coach who owns the workout can read feedback
create policy "Coaches can read own workout feedback"
  on public.workout_feedback for select
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.coach_id = auth.uid()
    )
  );

create index idx_feedback_workout_id on public.workout_feedback(workout_id);
create index idx_feedback_share_token on public.workout_feedback(share_token);
