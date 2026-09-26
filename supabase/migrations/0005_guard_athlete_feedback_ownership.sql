-- Fixes a cross-tenant data-integrity gap found during a full security
-- audit, not from a user report.
--
-- submit_athlete_workout_feedback (the athlete-portal feedback RPC, added
-- in the athlete_streaks migration) only checked that the workout id it
-- was given existed *somewhere in the system* — not that it was actually
-- assigned to the calling athlete or scheduled via their active program.
-- The RLS policy that governs what workouts an athlete can even see
-- ("athletes can view assigned or scheduled workouts") already encodes the
-- real authorization boundary: assigned via workout_assignments, or
-- scheduled via program_days for their active program. This RPC enforced
-- neither, so any authenticated athlete could submit fabricated completion
-- feedback against any coach's workout in the entire system — cross-tenant
-- data pollution, and a streak-gaming vector since the client fully
-- controls which workout_id gets submitted.
--
-- Fixed by mirroring that same OR condition as an explicit check before
-- accepting the feedback.

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

  if not exists (
    select 1 from public.workout_assignments wa
    where wa.workout_id = p_workout_id and wa.athlete_id = v_athlete_id
  ) and not exists (
    select 1 from public.program_days pd
    join public.athletes a on a.active_program_id = pd.program_id
    where pd.workout_id = p_workout_id and a.id = v_athlete_id
  ) then
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
