-- Tightens 0017 (found in the PR #21 audit).
--
-- 0017 let claim_athlete_invite delete the caller's coaches row when it was
-- under a day old and empty. Two problems:
--   1. The invite page claims automatically whenever a session exists, so a
--      brand-new coach (email or Google) who opened an athlete invite in the
--      same browser, before adding anything, silently lost their coach profile.
--   2. A first-time Google user who pressed "Continue with Google" on the
--      athlete login (no invite yet) kept the empty coach row the signup
--      trigger gave them. Once it was a day old, their later invite was refused
--      as "a coach".
--
-- Fix: one definition of "an unused stub", used in two places.
--   - is_unused_oauth_coach_stub(uid): the coaches row exists, the login came
--     from Google (email signups are never touched), it is under an hour old,
--     and the coach owns no athletes, programs, workouts or custom exercises.
--     (Messages, overrides, requests, thread state and assignments all hang off
--     athletes or workouts, so an empty coach cannot own any.)
--   - claim_athlete_invite deletes the row only when that holds.
--   - discard_unused_coach_stub(): the Google callback calls it when someone
--     signs in on the athlete login without being an athlete, so the stub is
--     removed straight away instead of waiting to be claimed.
--
-- Residual case: a coach who signs up with Google and, within the hour and
-- before adding anything, opens an athlete invite in the same browser, still
-- loses the profile. They can sign up again; nothing of value is lost.

create or replace function public.is_unused_oauth_coach_stub(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
      from public.coaches c
      join auth.users u on u.id = c.id
     where c.id = p_uid
       and u.raw_app_meta_data ->> 'provider' = 'google'
       and c.created_at > now() - interval '1 hour'
       and not exists (select 1 from public.athletes where coach_id = c.id)
       and not exists (select 1 from public.programs where coach_id = c.id)
       and not exists (select 1 from public.workouts where coach_id = c.id)
       and not exists (select 1 from public.exercises where coach_id = c.id)
  );
$function$;

revoke execute on function public.is_unused_oauth_coach_stub(uuid) from public, anon, authenticated;

create or replace function public.discard_unused_coach_stub()
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.is_unused_oauth_coach_stub(auth.uid()) then
    return false;
  end if;
  delete from public.coaches where id = auth.uid();
  return true;
end;
$function$;

revoke execute on function public.discard_unused_coach_stub() from public, anon;
grant execute on function public.discard_unused_coach_stub() to authenticated;

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

  if exists (select 1 from public.coaches where id = auth.uid()) then
    if not public.is_unused_oauth_coach_stub(auth.uid()) then
      raise exception 'This account is registered as a coach and cannot accept an athlete invite';
    end if;
    delete from public.coaches where id = auth.uid();
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

-- Probe once applied (roll back with a sentinel exception):
--  as a coach created by email, empty and brand new: claim_athlete_invite must
--   raise 'registered as a coach' (provider is not google).
--  as a Google-created empty coach older than an hour: same refusal.
--  as a Google-created empty coach under an hour old: the row is deleted and
--   the invite is claimed; discard_unused_coach_stub() returns true and
--   removes it; for a coach who owns any athlete/program/workout/exercise it
--   returns false and removes nothing.
