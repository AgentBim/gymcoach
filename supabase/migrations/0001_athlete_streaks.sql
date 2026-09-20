-- Athlete streaks feature: portal accounts, program assignment, and streak cache.
--
-- IMPORTANT: this was written without direct access to the live database (no
-- Supabase project connection available in the session that authored it), so
-- it could not be validated against your actual schema, existing RLS
-- policies, or naming conventions. Read it over before running it — in
-- particular check the RLS section at the bottom against however you already
-- scope `coaches`/`athletes` policies, since guessing that wrong either
-- locks athletes out or over-shares data.
--
-- Run this once against your Supabase project (SQL editor or `supabase db
-- push` if you have migrations wired up locally).

begin;

-- ── Athlete portal accounts ────────────────────────────────────────
-- Athletes get their own Supabase auth user (separate from coaches), linked
-- back to their roster row so completions/streaks can be attributed reliably
-- instead of the old free-text athlete_name on workout_feedback.
alter table athletes add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table athletes add column if not exists email text;
alter table athletes add column if not exists invite_token uuid;
alter table athletes add column if not exists invite_sent_at timestamptz;

create unique index if not exists athletes_user_id_key on athletes(user_id);
create unique index if not exists athletes_invite_token_key on athletes(invite_token);

-- ── Program assignment ──────────────────────────────────────────────
-- Programs (program_days) already exist but were never linked to an athlete.
-- `program_started_on` anchors the program's week/day grid to real calendar
-- dates: the athlete's "week 1" begins on the Monday of the week containing
-- this date, and the schedule repeats (cycles through duration_weeks) after
-- that. A NULL active_program_id means "no active program" -> every day is
-- a due day (plain daily streak), per the product rule.
alter table athletes add column if not exists active_program_id uuid references programs(id) on delete set null;
alter table athletes add column if not exists program_started_on date;

-- ── Streak cache ─────────────────────────────────────────────────────
-- current_streak / streak_last_computed_date cache the walk-backward
-- computation so we don't replay an athlete's whole history on every page
-- load. streak_last_computed_date means "current_streak is correct as of
-- the end of this calendar date" (a fully-elapsed day); "today" is layered
-- on top at read time by the app, never persisted until it, too, has fully
-- elapsed. See src/lib/streaks.js for the single source of truth on this.
alter table athletes add column if not exists current_streak integer not null default 0;
alter table athletes add column if not exists streak_last_computed_date date;

-- ── Attribute completions to athletes with an explicit calendar date ───
-- athlete_id is nullable: the old anonymous /share/:token flow (no athlete
-- account) still works and simply won't count toward a streak.
-- completed_date is the athlete's own local calendar day at the moment they
-- submitted (computed client-side), stored explicitly rather than derived
-- from submitted_at, so it can't shift depending on which timezone later
-- reads it back.
alter table workout_feedback add column if not exists athlete_id uuid references athletes(id) on delete set null;
alter table workout_feedback add column if not exists completed_date date;

create index if not exists workout_feedback_athlete_date_idx on workout_feedback(athlete_id, completed_date);

-- ── Invite acceptance ───────────────────────────────────────────────
-- Linking an athlete row to a freshly-created auth user can't go through a
-- plain RLS update policy: before the link exists, `athletes.user_id` is
-- null, so a "you can update your own row" policy (using user_id = auth.uid())
-- can never match it — that's the point, it stops anyone from re-pointing an
-- already-claimed row, but it also blocks the very first claim. This
-- SECURITY DEFINER function is the sanctioned way through: it re-validates
-- the invite token server-side itself (rather than trusting an RLS policy
-- shaped around client-supplied row state, which an authenticated attacker
-- could otherwise satisfy without ever knowing the real token) and only
-- ever attaches the *calling* user (auth.uid()), never an arbitrary id.
create or replace function claim_athlete_invite(p_invite_token uuid, p_email text)
returns athletes
language plpgsql
security definer
set search_path = public
as $$
declare
  result athletes;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to claim an invite';
  end if;

  update athletes
  set user_id = auth.uid(),
      email = p_email,
      invite_token = null
  where invite_token = p_invite_token
    and user_id is null
  returning * into result;

  if result.id is null then
    raise exception 'Invalid or already-used invite link';
  end if;

  return result;
end;
$$;

grant execute on function claim_athlete_invite(uuid, text) to authenticated;

commit;

-- ── RLS (best-effort — verify against your existing policies) ──────────
-- These assume: athletes.user_id = auth.uid() identifies "this row is me"
-- for an athlete, and coaches already have some existing policy scoping
-- athletes/programs/program_days/workouts/workout_feedback to
-- coach_id = auth.uid(). Adjust names/logic to match what you actually have
-- before running — this section is deliberately separate from the schema
-- change above so you can skip or rewrite it without blocking the migration.
--
-- alter policy or `drop policy if exists ... ; create policy ...` as needed;
-- shown here as fresh `create policy` statements assuming RLS is already
-- enabled on these tables.

-- Athletes can read and update their own roster row (needed for the invite
-- acceptance flow to attach user_id/email, and for reading their own streak
-- cache / active program).
create policy "athletes can read own row"
  on athletes for select
  using (user_id = auth.uid());

create policy "athletes can update own row"
  on athletes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- An athlete needs to read their own active program's schedule to resolve
-- "is today due" and render the Program tab.
create policy "athletes can read their active program"
  on programs for select
  using (
    exists (
      select 1 from athletes
      where athletes.active_program_id = programs.id
        and athletes.user_id = auth.uid()
    )
  );

create policy "athletes can read their active program days"
  on program_days for select
  using (
    exists (
      select 1 from athletes
      where athletes.active_program_id = program_days.program_id
        and athletes.user_id = auth.uid()
    )
  );

-- An athlete needs to read workouts referenced by their program days (to
-- render today's workout) and any workout assigned directly to them.
create policy "athletes can read workouts on their program days"
  on workouts for select
  using (
    exists (
      select 1 from program_days
      join athletes on athletes.active_program_id = program_days.program_id
      where program_days.workout_id = workouts.id
        and athletes.user_id = auth.uid()
    )
    or exists (
      select 1 from workout_assignments
      join athletes on athletes.id = workout_assignments.athlete_id
      where workout_assignments.workout_id = workouts.id
        and athletes.user_id = auth.uid()
    )
  );

create policy "athletes can read exercises on visible workouts"
  on workout_exercises for select
  using (
    exists (
      select 1 from workouts
      where workouts.id = workout_exercises.workout_id
    )
  );

-- An athlete can insert/read their own completion logs.
create policy "athletes can insert own workout_feedback"
  on workout_feedback for insert
  with check (
    athlete_id is null
    or exists (select 1 from athletes where athletes.id = workout_feedback.athlete_id and athletes.user_id = auth.uid())
  );

create policy "athletes can read own workout_feedback"
  on workout_feedback for select
  using (
    exists (select 1 from athletes where athletes.id = workout_feedback.athlete_id and athletes.user_id = auth.uid())
  );
