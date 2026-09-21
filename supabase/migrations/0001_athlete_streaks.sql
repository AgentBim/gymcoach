-- Athlete streaks feature: portal accounts, program assignment, and streak
-- cache. Verified against the live project (nqrlhotrwyrphwumxtty) schema,
-- RLS policies, grants, and existing functions/triggers before writing this
-- — see notes below on what that audit found and why each piece here is
-- shaped the way it is.
--
-- Audit findings that shaped this file:
--  - RLS is "private by default" here (see the `harden_public_workout_access`
--    / `private_by_default` / `assignment_tokens_and_atomic_writes`
--    migrations already applied). anon has no table access at all; the
--    anonymous /share/:token flow works ONLY through the SECURITY DEFINER
--    RPCs get_shared_workout()/submit_workout_feedback(), keyed by
--    workout_assignments.assignment_token — NOT workouts.share_token, which
--    the app's frontend was (incorrectly) still using. That's a pre-existing
--    bug, fixed alongside this migration (see the accompanying frontend
--    changes) since it shares files with this feature.
--  - workout_feedback has a table GRANT for `authenticated` INSERT, but
--    ZERO RLS policies permit INSERT for any role — so even an authenticated
--    write needs a new policy (added below) or a RPC; a raw insert would be
--    silently denied by RLS despite the grant existing.
--  - The `on_auth_user_created` trigger (handle_new_user) unconditionally
--    inserts a `coaches` row for every new auth.users row. Athlete portal
--    signups go through the same auth.users table, so without a guard,
--    every athlete who accepts an invite would also get a bogus coach row.
--    Fixed below by checking raw_user_meta_data->>'role' = 'athlete'
--    (the frontend passes this in signUp options).
--  - Coach-side writes already have a atomic-RPC convention (save_workout,
--    save_program, duplicate_workout) — new writes here follow the same
--    shape (SECURITY INVOKER, `set search_path to ''`, fully-qualified
--    `public.` references, server-side validation) for consistency.

-- ── Athlete portal accounts ────────────────────────────────────────
alter table public.athletes add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.athletes add column if not exists email text;
alter table public.athletes add column if not exists invite_token uuid;
alter table public.athletes add column if not exists invite_sent_at timestamptz;

create unique index if not exists athletes_user_id_key on public.athletes(user_id);
create unique index if not exists athletes_invite_token_key on public.athletes(invite_token);

-- ── Program assignment ──────────────────────────────────────────────
-- program_started_on anchors the program's week/day grid to real calendar
-- dates: the athlete's "week 1" begins on the Monday of the week containing
-- this date, and the schedule cycles (repeats every duration_weeks) after
-- that. NULL active_program_id means "no active program" -> every day is a
-- due day (plain daily streak).
alter table public.athletes add column if not exists active_program_id uuid references public.programs(id) on delete set null;
alter table public.athletes add column if not exists program_started_on date;

-- ── Streak cache ─────────────────────────────────────────────────────
-- streak_last_computed_date means "current_streak is correct through the
-- end of this calendar date" (a fully-elapsed day). "Today" is layered on
-- top at read time by the app (src/lib/streaks.js), never persisted until
-- it, too, has fully elapsed.
alter table public.athletes add column if not exists current_streak integer not null default 0;
alter table public.athletes add column if not exists streak_last_computed_date date;

-- ── Attribute completions to athletes with an explicit calendar date ───
-- Nullable: the anonymous assignment-token flow (submit_workout_feedback)
-- doesn't set these and simply won't count toward a streak.
alter table public.workout_feedback add column if not exists athlete_id uuid references public.athletes(id) on delete set null;
alter table public.workout_feedback add column if not exists completed_date date;

create index if not exists workout_feedback_athlete_date_idx on public.workout_feedback(athlete_id, completed_date);

-- ── Fix: athlete signups must not create a coaches row ─────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if coalesce(new.raw_user_meta_data->>'role', '') = 'athlete' then
    return new;
  end if;

  insert into public.coaches (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$function$;

-- ── Invite acceptance ───────────────────────────────────────────────
-- Linking an athlete row to a freshly-created auth user can't go through a
-- plain RLS update policy: before the link exists, athletes.user_id is
-- null, so a "you can update your own row" policy (using user_id =
-- auth.uid()) can never match it. This SECURITY DEFINER function is the
-- sanctioned way through: it validates the invite token itself and only
-- ever attaches the *calling* user (auth.uid()).
create or replace function public.claim_athlete_invite(p_invite_token uuid, p_email text)
returns public.athletes
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result public.athletes;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to claim an invite';
  end if;

  update public.athletes
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
$function$;

grant execute on function public.claim_athlete_invite(uuid, text) to authenticated;

-- ── Athlete-submitted workout feedback (streak-eligible) ────────────────
-- Mirrors submit_workout_feedback's validation, but for an authenticated
-- athlete account rather than an anonymous assignment token: athlete_id is
-- resolved from auth.uid() server-side (never trusted from the client),
-- exercises_total is computed server-side, and completed_date is accepted
-- from the client (it's their local calendar day) within a small tolerance
-- band rather than trusted outright.
create or replace function public.submit_athlete_workout_feedback(
  p_workout_id uuid,
  p_emoji_rating text default null,
  p_rpe integer default null,
  p_notes text default null,
  p_exercises_completed integer default 0,
  p_completed_date date default null
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_athlete_id uuid;
  v_athlete_name text;
  v_total integer;
  v_completed_date date;
  v_feedback_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id, full_name into v_athlete_id, v_athlete_name
  from public.athletes where user_id = auth.uid();

  if v_athlete_id is null then
    raise exception 'No athlete profile linked to this account';
  end if;

  if not exists (select 1 from public.workouts where id = p_workout_id) then
    raise exception 'Workout not found';
  end if;

  select count(*)::integer into v_total from public.workout_exercises where workout_id = p_workout_id;

  if p_emoji_rating is not null and p_emoji_rating not in ('easy', 'good', 'hard', 'veryhard') then
    raise exception 'Invalid rating';
  end if;
  if p_rpe is not null and (p_rpe < 1 or p_rpe > 10) then
    raise exception 'RPE must be between 1 and 10';
  end if;
  if length(coalesce(p_notes, '')) > 1000 then
    raise exception 'Feedback is too long';
  end if;
  if p_exercises_completed < 0 or p_exercises_completed > v_total then
    raise exception 'Invalid completed exercise count';
  end if;

  v_completed_date := coalesce(p_completed_date, current_date);
  if v_completed_date < current_date - 2 or v_completed_date > current_date + 1 then
    raise exception 'Invalid completion date';
  end if;

  insert into public.workout_feedback (
    workout_id, athlete_id, athlete_name, completed_date,
    emoji_rating, rpe, notes, exercises_completed, exercises_total
  ) values (
    p_workout_id, v_athlete_id, v_athlete_name, v_completed_date,
    p_emoji_rating, p_rpe, nullif(btrim(coalesce(p_notes, '')), ''),
    p_exercises_completed, v_total
  ) returning id into v_feedback_id;

  return v_feedback_id;
end;
$function$;

grant execute on function public.submit_athlete_workout_feedback(uuid, text, integer, text, integer, date) to authenticated;

-- ── RLS: athlete-facing reads and writes ────────────────────────────────
-- All additive alongside the existing "Coaches manage own X" policies
-- (RLS policies are OR'd together) — coach access is untouched.

create policy "athletes can read own row"
  on public.athletes for select
  to authenticated
  using (user_id = auth.uid());

create policy "athletes can update own row"
  on public.athletes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "athletes can view their active program"
  on public.programs for select
  to authenticated
  using (
    exists (
      select 1 from public.athletes
      where athletes.active_program_id = programs.id
        and athletes.user_id = auth.uid()
    )
  );

create policy "athletes can view their active program days"
  on public.program_days for select
  to authenticated
  using (
    exists (
      select 1 from public.athletes
      where athletes.active_program_id = program_days.program_id
        and athletes.user_id = auth.uid()
    )
  );

create policy "athletes can view their own assignments"
  on public.workout_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.athletes
      where athletes.id = workout_assignments.athlete_id
        and athletes.user_id = auth.uid()
    )
  );

create policy "athletes can view assigned or scheduled workouts"
  on public.workouts for select
  to authenticated
  using (
    exists (
      select 1 from public.workout_assignments wa
      join public.athletes ath on ath.id = wa.athlete_id
      where wa.workout_id = workouts.id and ath.user_id = auth.uid()
    )
    or exists (
      select 1 from public.program_days pd
      join public.athletes ath on ath.active_program_id = pd.program_id
      where pd.workout_id = workouts.id and ath.user_id = auth.uid()
    )
  );

-- workout_exercises/workout_prehab restate the workouts visibility test
-- (rather than relying on RLS composing through the subquery) to match
-- this codebase's existing style for these two tables.
create policy "athletes can view exercises for visible workouts"
  on public.workout_exercises for select
  to authenticated
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id
        and (
          exists (
            select 1 from public.workout_assignments wa
            join public.athletes ath on ath.id = wa.athlete_id
            where wa.workout_id = w.id and ath.user_id = auth.uid()
          )
          or exists (
            select 1 from public.program_days pd
            join public.athletes ath on ath.active_program_id = pd.program_id
            where pd.workout_id = w.id and ath.user_id = auth.uid()
          )
        )
    )
  );

create policy "athletes can view prehab for visible workouts"
  on public.workout_prehab for select
  to authenticated
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_prehab.workout_id
        and (
          exists (
            select 1 from public.workout_assignments wa
            join public.athletes ath on ath.id = wa.athlete_id
            where wa.workout_id = w.id and ath.user_id = auth.uid()
          )
          or exists (
            select 1 from public.program_days pd
            join public.athletes ath on ath.active_program_id = pd.program_id
            where pd.workout_id = w.id and ath.user_id = auth.uid()
          )
        )
    )
  );

create policy "athletes can insert own workout_feedback"
  on public.workout_feedback for insert
  to authenticated
  with check (
    exists (
      select 1 from public.athletes
      where athletes.id = workout_feedback.athlete_id
        and athletes.user_id = auth.uid()
    )
  );

create policy "athletes can read own workout_feedback"
  on public.workout_feedback for select
  to authenticated
  using (
    exists (
      select 1 from public.athletes
      where athletes.id = workout_feedback.athlete_id
        and athletes.user_id = auth.uid()
    )
  );
