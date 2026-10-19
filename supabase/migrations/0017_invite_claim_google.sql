-- Google sign-in for athletes.
--
-- A first-time OAuth user arrives with no user metadata, so handle_new_user
-- (which skips only role = 'athlete') gives them an empty coaches row, and
-- claim_athlete_invite then refuses them as "a coach". Email/password signup
-- avoids this by passing role: 'athlete'; signInWithOAuth cannot.
--
-- claim_athlete_invite now drops that auto-created coach profile when, and only
-- when, it is provably unused: created within the last day and owning no
-- athletes, programs, workouts or custom exercises. Every table that points at
-- coaches cascades on delete, so the emptiness check is what keeps this from
-- ever removing a real coach's data. Anyone else is refused exactly as before.

create or replace function public.claim_athlete_invite(p_invite_token uuid, p_email text)
returns public.athletes
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result public.athletes;
  v_created timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to claim an invite';
  end if;

  select created_at into v_created from public.coaches where id = auth.uid();
  if found then
    if v_created < now() - interval '1 day'
       or exists (select 1 from public.athletes where coach_id = auth.uid())
       or exists (select 1 from public.programs where coach_id = auth.uid())
       or exists (select 1 from public.workouts where coach_id = auth.uid())
       or exists (select 1 from public.exercises where coach_id = auth.uid())
    then
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
