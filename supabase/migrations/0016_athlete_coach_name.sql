-- The athlete portal shows "Coach <first name>" in the header of the Coach tab
-- and on messages. Athletes can't read the coaches table (and shouldn't: it
-- holds the coach's email), so the select the portal used returned nothing and
-- the name fell back to a placeholder.
--
-- athlete_coach_name() returns only the full name of the calling athlete's own
-- coach. SECURITY DEFINER because of the coaches RLS; it reads one column for
-- one row chosen by auth.uid(), never by a caller-supplied id.

create or replace function public.athlete_coach_name()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select c.full_name
    from public.athletes a
    join public.coaches c on c.id = a.coach_id
   where a.user_id = auth.uid()
   limit 1;
$function$;

revoke execute on function public.athlete_coach_name() from public, anon;
grant execute on function public.athlete_coach_name() to authenticated;
