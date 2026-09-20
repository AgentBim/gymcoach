-- Scheduled cleanup for orphaned athlete-invite signups.
--
-- Problem: AthleteInviteAccept.jsx calls supabase.auth.signUp() and then
-- claim_athlete_invite() as two separate steps. If the browser closes or
-- the connection drops between them, the auth user exists but is never
-- linked to an `athletes` row — and since Supabase enforces unique emails,
-- that email becomes permanently unusable for a fresh signUp attempt.
-- (AthleteInviteAccept already retries via sign-in when this happens, so
-- the person isn't stuck; this clears the DB litter for whoever never
-- comes back to retry.)
--
-- Verified before writing this (see session notes):
--  - auth.identities/sessions/mfa_factors/one_time_tokens/oauth_*/
--    webauthn_* all have ON DELETE CASCADE back to auth.users, so a direct
--    delete here leaves no orphaned rows in the auth internals.
--  - athletes.user_id is ON DELETE SET NULL, and is moot anyway since the
--    query below only ever targets rows with no matching athletes.user_id.
--  - migrations run as `postgres`, which has DELETE on auth.users.
--  - would_delete_now was 0 at the time this was written — nothing existing
--    gets swept up by turning this on.

create extension if not exists pg_cron with schema extensions;

create or replace function public.cleanup_orphaned_athlete_signups()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count integer;
begin
  with orphaned as (
    select u.id
    from auth.users u
    where coalesce(u.raw_user_meta_data->>'role', '') = 'athlete'
      and u.created_at < now() - interval '48 hours'
      and not exists (select 1 from public.athletes a where a.user_id = u.id)
  )
  delete from auth.users where id in (select id from orphaned);
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- Unlike claim_athlete_invite/get_shared_workout/submit_workout_feedback,
-- this is NOT meant to be anon/authenticated-callable via
-- /rest/v1/rpc/cleanup_orphaned_athlete_signups — it should only ever run
-- from the cron schedule below. Confirmed via the security advisor that
-- without this revoke, PostgREST's default PUBLIC execute grant would let
-- anyone trigger it on demand.
revoke execute on function public.cleanup_orphaned_athlete_signups() from public;

select cron.schedule(
  'cleanup-orphaned-athlete-signups',
  '0 3 * * *',
  $$select public.cleanup_orphaned_athlete_signups()$$
);
