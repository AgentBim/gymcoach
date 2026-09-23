-- Hardens claim_athlete_invite against linking a coach's own session to an
-- athlete's roster row.
--
-- Found while investigating a real "invited athlete ended up unable to log
-- in" report. The actual cause (see the accompanying frontend changes) was
-- an orphaned auth account: signUp() succeeded, but the claim never ran
-- because it depended on a PENDING_INVITE_KEY value surviving in
-- localStorage across the email-confirmation redirect — which breaks
-- whenever that link opens in a different browser/app than where signup
-- started. The fix makes AthleteInviteAccept.jsx finish the claim as soon
-- as it detects a live session (e.g. right after the redirect), instead of
-- relying on localStorage.
--
-- That change means claim_athlete_invite now runs automatically on page
-- load whenever a session exists, not only from an explicit form submit.
-- The function previously trusted auth.uid() unconditionally — it would
-- happily link a currently-authenticated COACH's id to any athlete's
-- invite_token they visited, corrupting that athlete's account. Low blast
-- radius before (required deliberately submitting the invite form while
-- logged in as a coach), higher now that any page load can trigger it, so
-- closing it here rather than leaving it latent.

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
    raise exception 'This account is registered as a coach and cannot accept an athlete invite';
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
