-- Fixes a live bug and adds a coach-facing recovery action, found while
-- investigating a real client's "Invite not found" error.
--
-- Root cause (verified live via pg_policies): all three RLS policies on
-- `athletes` require the `authenticated` role. AthleteInviteAccept.jsx's
-- first step — looking up the invite by token — ran as a raw table select
-- from an anonymous, not-yet-signed-up visitor. RLS silently returns zero
-- rows for that request no matter what, so every fresh invite link failed
-- for any real client clicking it cold, independent of whether the token
-- was valid. This mirrors the existing get_shared_workout/
-- submit_workout_feedback pattern (SECURITY DEFINER RPC granted to anon)
-- instead of a raw table read.
--
-- Also adds reset_athlete_portal_access: coaches had no way to recover an
-- athlete stuck on a dead invite/login (e.g. lost password, or an invite
-- sent before this fix). It clears user_id/email/invite_token and deletes
-- the associated auth.users row (freeing the email for a fresh signUp —
-- without this, Supabase's anti-enumeration behavior would silently no-op
-- a fresh signUp attempt for the same email) while leaving athlete_id,
-- workout_assignments, workout_feedback, streak cache, and program
-- assignment completely untouched, so no history is lost.

create or replace function public.get_athlete_invite(p_invite_token uuid)
returns table(id uuid, full_name text)
language sql
security definer
set search_path to ''
as $function$
  select a.id, a.full_name
  from public.athletes a
  where a.invite_token = p_invite_token
    and a.user_id is null
  limit 1
$function$;

grant execute on function public.get_athlete_invite(uuid) to anon, authenticated;

create or replace function public.reset_athlete_portal_access(p_athlete_id uuid)
returns public.athletes
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_old_user_id uuid;
  result public.athletes;
begin
  select user_id into v_old_user_id
  from public.athletes
  where id = p_athlete_id and coach_id = auth.uid();

  if not found then
    raise exception 'Athlete not found';
  end if;

  update public.athletes
  set user_id = null,
      email = null,
      invite_token = gen_random_uuid(),
      invite_sent_at = now()
  where id = p_athlete_id
  returning * into result;

  if v_old_user_id is not null then
    delete from auth.users where id = v_old_user_id;
  end if;

  return result;
end;
$function$;

grant execute on function public.reset_athlete_portal_access(uuid) to authenticated;

-- Unlike get_athlete_invite, this one is coach-only — it validates
-- coach_id = auth.uid() itself, but Postgres's default PUBLIC execute
-- grant on a new function would otherwise leave it anon-callable too.
-- Confirmed via the security advisor that revoking this is what drops it
-- from the anon-callable list (the internal ownership check alone would
-- have made an anon call a no-op, but this closes the gap explicitly).
revoke execute on function public.reset_athlete_portal_access(uuid) from public, anon;
