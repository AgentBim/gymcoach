alter table public.workouts add column if not exists is_ai_generated boolean not null default false;
