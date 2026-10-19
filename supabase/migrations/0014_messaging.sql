-- In-app messaging between a coach and their athletes, plus schedule-change
-- requests (docs/plans/mockup-parity.md, Phase 4). In-app only: SMS, email
-- and push are deferred.
--
-- One thread per athlete. A thread is the athlete's messages and the coach's,
-- interleaved with the athlete's workout feedback (read straight from
-- workout_feedback, not copied) and system lines such as "Thursday moved to
-- Friday".
--
--   messages          text, schedule-change notices and request announcements.
--   schedule_requests an athlete asking to move a day; the coach approves
--                     (which writes personal overrides, see 0012) or declines.
--   thread_state      when each side last opened the thread. This is what
--                     makes "unread" and "unsend until they open it" work:
--                     a coach message can be unsent only while it is newer
--                     than athlete_read_at.
--
-- Writes go through RPCs (SECURITY INVOKER, search_path '') so every
-- statement still runs through the caller's RLS. Coaches see only their own
-- athletes' threads; an athlete sees only their own.

create table if not exists public.schedule_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  from_date date not null,
  to_date date,
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  sender text not null check (sender in ('coach', 'athlete', 'system')),
  kind text not null default 'text' check (kind in ('text', 'schedule_change', 'request')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  request_id uuid references public.schedule_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  unsent_at timestamptz
);

create table if not exists public.thread_state (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  coach_read_at timestamptz not null default 'epoch',
  athlete_read_at timestamptz not null default 'epoch'
);

create index if not exists messages_thread_idx on public.messages (athlete_id, created_at);
create index if not exists messages_coach_idx on public.messages (coach_id, created_at desc);
create index if not exists schedule_requests_coach_idx on public.schedule_requests (coach_id, status);

alter table public.schedule_requests enable row level security;
alter table public.messages enable row level security;
alter table public.thread_state enable row level security;

-- New tables here get no default grants; RLS does the row filtering.
grant select, insert, update, delete on public.schedule_requests, public.messages, public.thread_state to authenticated;

create policy "Coaches manage own requests" on public.schedule_requests
  for all to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);

create policy "athletes read own requests" on public.schedule_requests
  for select to authenticated
  using (exists (select 1 from public.athletes a where a.id = athlete_id and a.user_id = auth.uid()));

create policy "athletes create own requests" on public.schedule_requests
  for insert to authenticated
  with check (exists (select 1 from public.athletes a where a.id = athlete_id and a.user_id = auth.uid() and a.coach_id = schedule_requests.coach_id));

create policy "Coaches read own messages" on public.messages
  for select to authenticated
  using ((select auth.uid()) = coach_id);

create policy "Coaches write own messages" on public.messages
  for insert to authenticated
  with check (
    (select auth.uid()) = coach_id
    and sender in ('coach', 'system')
    and exists (select 1 from public.athletes a where a.id = athlete_id and a.coach_id = (select auth.uid()))
  );

create policy "Coaches update own messages" on public.messages
  for update to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);

create policy "athletes read own messages" on public.messages
  for select to authenticated
  using (unsent_at is null and exists (select 1 from public.athletes a where a.id = athlete_id and a.user_id = auth.uid()));

create policy "athletes write own messages" on public.messages
  for insert to authenticated
  with check (
    sender = 'athlete'
    and exists (select 1 from public.athletes a where a.id = athlete_id and a.user_id = auth.uid() and a.coach_id = messages.coach_id)
  );

create policy "Coaches manage own thread state" on public.thread_state
  for all to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id);

create policy "athletes manage own thread state" on public.thread_state
  for all to authenticated
  using (exists (select 1 from public.athletes a where a.id = athlete_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.athletes a where a.id = athlete_id and a.user_id = auth.uid() and a.coach_id = schedule_requests.coach_id));

-- Coach sends a message into an athlete's thread. Sending counts as reading.
create or replace function public.send_coach_message(p_athlete_id uuid, p_body text)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(coalesce(p_body, '')), '') is null then
    raise exception 'Write a message first';
  end if;
  if not exists (select 1 from public.athletes a where a.id = p_athlete_id and a.coach_id = v_uid) then
    raise exception 'Athlete not found';
  end if;
  insert into public.messages (coach_id, athlete_id, sender, kind, body)
  values (v_uid, p_athlete_id, 'coach', 'text', btrim(p_body))
  returning id into v_id;
  insert into public.thread_state (athlete_id, coach_id, coach_read_at)
  values (p_athlete_id, v_uid, now())
  on conflict (athlete_id) do update set coach_read_at = now();
  return v_id;
end;
$function$;

-- Take a coach message back, only while the athlete hasn't opened the thread
-- since it was sent.
create or replace function public.unsend_message(p_message_id uuid)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_ok uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  update public.messages m
     set unsent_at = now()
   where m.id = p_message_id
     and m.coach_id = v_uid
     and m.sender = 'coach'
     and m.unsent_at is null
     and m.created_at > coalesce((select t.athlete_read_at from public.thread_state t where t.athlete_id = m.athlete_id), 'epoch')
  returning m.id into v_ok;
  if v_ok is null then
    raise exception 'It has already been opened, so it can''t be unsent';
  end if;
end;
$function$;

-- An athlete writes to their coach.
create or replace function public.send_athlete_message(p_body text)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_athlete public.athletes%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(coalesce(p_body, '')), '') is null then
    raise exception 'Write a message first';
  end if;
  select * into v_athlete from public.athletes where user_id = auth.uid();
  if v_athlete.id is null then
    raise exception 'No athlete profile linked to this account';
  end if;
  insert into public.messages (coach_id, athlete_id, sender, kind, body)
  values (v_athlete.coach_id, v_athlete.id, 'athlete', 'text', btrim(p_body))
  returning id into v_id;
  insert into public.thread_state (athlete_id, coach_id, athlete_read_at)
  values (v_athlete.id, v_athlete.coach_id, now())
  on conflict (athlete_id) do update set athlete_read_at = now();
  return v_id;
end;
$function$;

-- Mark a thread opened. A coach passes the athlete; an athlete passes null.
create or replace function public.mark_thread_read(p_athlete_id uuid default null)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_athlete public.athletes%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_athlete_id is not null then
    select * into v_athlete from public.athletes where id = p_athlete_id and coach_id = v_uid;
    if v_athlete.id is null then
      raise exception 'Athlete not found';
    end if;
    insert into public.thread_state (athlete_id, coach_id, coach_read_at)
    values (v_athlete.id, v_uid, now())
    on conflict (athlete_id) do update set coach_read_at = now();
  else
    select * into v_athlete from public.athletes where user_id = v_uid;
    if v_athlete.id is null then
      raise exception 'No athlete profile linked to this account';
    end if;
    insert into public.thread_state (athlete_id, coach_id, athlete_read_at)
    values (v_athlete.id, v_athlete.coach_id, now())
    on conflict (athlete_id) do update set athlete_read_at = now();
  end if;
end;
$function$;

-- An athlete asks their coach to move a day.
create or replace function public.create_schedule_request(p_from date, p_to date default null, p_note text default null)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_athlete public.athletes%rowtype;
  v_id uuid;
  v_body text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  select * into v_athlete from public.athletes where user_id = auth.uid();
  if v_athlete.id is null then
    raise exception 'No athlete profile linked to this account';
  end if;
  if p_from is null or p_from < current_date - 1 then
    raise exception 'Pick an upcoming day';
  end if;
  insert into public.schedule_requests (coach_id, athlete_id, from_date, to_date, note)
  values (v_athlete.coach_id, v_athlete.id, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;
  v_body := coalesce(nullif(btrim(coalesce(p_note, '')), ''),
    case when p_to is null then 'Can we move ' || to_char(p_from, 'FMDay, Mon FMDD') || '?'
         else 'Can I move ' || to_char(p_from, 'FMDay, Mon FMDD') || ' to ' || to_char(p_to, 'FMDay, Mon FMDD') || '?' end);
  insert into public.messages (coach_id, athlete_id, sender, kind, body, request_id)
  values (v_athlete.coach_id, v_athlete.id, 'athlete', 'request', v_body, v_id);
  insert into public.thread_state (athlete_id, coach_id, athlete_read_at)
  values (v_athlete.id, v_athlete.coach_id, now())
  on conflict (athlete_id) do update set athlete_read_at = now();
  return v_id;
end;
$function$;

-- Coach answers a request. 'approve' moves the day with personal overrides
-- (from_date becomes a rest day, to_date gets p_workout_id) unless the athlete
-- already logged that date, and tells the athlete. 'decline' just closes it;
-- the coach writes the reply separately.
create or replace function public.resolve_schedule_request(p_request_id uuid, p_action text, p_workout_id uuid default null, p_today date default null)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_req public.schedule_requests%rowtype;
  v_today date := coalesce(p_today, current_date);
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_action not in ('approve', 'decline') then
    raise exception 'Invalid action';
  end if;
  if abs(v_today - current_date) > 1 then
    raise exception 'Invalid date';
  end if;
  select * into v_req from public.schedule_requests where id = p_request_id and coach_id = v_uid for update;
  if v_req.id is null then
    raise exception 'Request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'That request was already answered';
  end if;

  if p_action = 'approve' then
    if v_req.to_date is null then
      raise exception 'That request has no new day to move to';
    end if;
    if v_req.from_date < v_today or v_req.to_date < v_today then
      raise exception 'Only upcoming days can be moved';
    end if;
    if exists (select 1 from public.workout_feedback f where f.athlete_id = v_req.athlete_id and f.completed_date in (v_req.from_date, v_req.to_date)) then
      raise exception 'One of those days is already logged and can''t change';
    end if;
    if p_workout_id is not null and not public.workout_owned_by_coach(p_workout_id, v_uid) then
      raise exception 'Workout not found';
    end if;
    insert into public.athlete_day_overrides (athlete_id, coach_id, date, day_type, workout_id)
    values (v_req.athlete_id, v_uid, v_req.from_date, 'rest', null)
    on conflict (athlete_id, date) do update set day_type = 'rest', workout_id = null, notes = null;
    if p_workout_id is not null then
      insert into public.athlete_day_overrides (athlete_id, coach_id, date, day_type, workout_id)
      values (v_req.athlete_id, v_uid, v_req.to_date, 'training', p_workout_id)
      on conflict (athlete_id, date) do update set day_type = 'training', workout_id = p_workout_id, notes = null;
    end if;
    insert into public.messages (coach_id, athlete_id, sender, kind, body, request_id)
    values (v_uid, v_req.athlete_id, 'system', 'schedule_change',
      to_char(v_req.from_date, 'FMDay, Mon FMDD') || ' moved to ' || to_char(v_req.to_date, 'FMDay, Mon FMDD') || ', as you asked.', v_req.id);
  end if;

  update public.schedule_requests
     set status = case p_action when 'approve' then 'approved' else 'declined' end,
         resolved_at = now()
   where id = v_req.id;

  insert into public.thread_state (athlete_id, coach_id, coach_read_at)
  values (v_req.athlete_id, v_uid, now())
  on conflict (athlete_id) do update set coach_read_at = now();
end;
$function$;

-- Header badge: threads with something new from an athlete, and open requests.
create or replace function public.coach_inbox_counts()
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select jsonb_build_object(
    'unread', (
      select count(*) from public.athletes a
       where a.coach_id = auth.uid()
         and (
           exists (
             select 1 from public.messages m
              where m.athlete_id = a.id and m.sender = 'athlete' and m.unsent_at is null
                and m.created_at > coalesce((select t.coach_read_at from public.thread_state t where t.athlete_id = a.id), 'epoch')
           )
           or exists (
             select 1 from public.workout_feedback f
              where f.athlete_id = a.id
                and f.submitted_at > now() - interval '21 days'
                and f.submitted_at > coalesce((select t.coach_read_at from public.thread_state t where t.athlete_id = a.id), 'epoch')
           )
         )
    ),
    'requests', (select count(*) from public.schedule_requests r where r.coach_id = auth.uid() and r.status = 'pending')
  )
$function$;

revoke execute on function public.send_coach_message(uuid, text) from public, anon;
revoke execute on function public.unsend_message(uuid) from public, anon;
revoke execute on function public.send_athlete_message(text) from public, anon;
revoke execute on function public.mark_thread_read(uuid) from public, anon;
revoke execute on function public.create_schedule_request(date, date, text) from public, anon;
revoke execute on function public.resolve_schedule_request(uuid, text, uuid, date) from public, anon;
revoke execute on function public.coach_inbox_counts() from public, anon;
grant execute on function public.send_coach_message(uuid, text) to authenticated;
grant execute on function public.unsend_message(uuid) to authenticated;
grant execute on function public.send_athlete_message(text) to authenticated;
grant execute on function public.mark_thread_read(uuid) to authenticated;
grant execute on function public.create_schedule_request(date, date, text) to authenticated;
grant execute on function public.resolve_schedule_request(uuid, text, uuid, date) to authenticated;
grant execute on function public.coach_inbox_counts() to authenticated;
