-- Test baseline: public schema inspected 2026-10-17; synthetic auth/storage only.
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;
create function public.uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
create type public."day_type" as enum ('training','rest','recovery','competition');
create type public."difficulty_level" as enum ('Easy','Medium','Hard');
create type public."exercise_category" as enum ('strength','prehab','mobility');
create type public."muscle_group" as enum ('Arms','Back','Legs','Core','Shoulders');
create type public."prehab_focus" as enum ('activation','stability','mobility','strength');
create table public."athletes" ("id" uuid default uuid_generate_v4() not null,"coach_id" uuid not null,"full_name" text not null,"group_name" text,"level" text,"notes" text,"created_at" timestamp with time zone default now() not null,"user_id" uuid,"email" text,"invite_token" uuid,"invite_sent_at" timestamp with time zone,"active_program_id" uuid,"program_started_on" date,"current_streak" integer default 0 not null,"streak_last_computed_date" date);
create table public."coaches" ("id" uuid not null,"full_name" text not null,"email" text not null,"created_at" timestamp with time zone default now() not null);
create table public."exercises" ("id" uuid default uuid_generate_v4() not null,"name" text not null,"description" text not null,"muscle_group" public."muscle_group" not null,"difficulty" public."difficulty_level" not null,"default_sets" integer default 3 not null,"default_reps" integer,"default_duration_seconds" integer,"default_rest_seconds" integer default 30 not null,"created_at" timestamp with time zone default now() not null,"coach_id" uuid,"is_custom" boolean default false not null,"category" public."exercise_category" default 'strength'::exercise_category not null,"prehab_focus" public."prehab_focus");
create table public."program_days" ("id" uuid default uuid_generate_v4() not null,"program_id" uuid not null,"week_number" integer default 1 not null,"day_of_week" integer not null,"workout_id" uuid,"day_type" public."day_type" default 'training'::day_type not null,"notes" text,"created_at" timestamp with time zone default now() not null);
create table public."programs" ("id" uuid default uuid_generate_v4() not null,"coach_id" uuid not null,"name" text not null,"description" text,"duration_weeks" integer default 1 not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
create table public."workout_assignments" ("id" uuid default uuid_generate_v4() not null,"workout_id" uuid not null,"athlete_id" uuid not null,"coach_id" uuid not null,"assigned_at" timestamp with time zone default now() not null,"assignment_token" text default repeat('0',64) not null,"expires_at" timestamp with time zone default (now() + '180 days'::interval) not null,"revoked_at" timestamp with time zone);
create table public."workout_exercises" ("id" uuid default uuid_generate_v4() not null,"workout_id" uuid not null,"exercise_id" uuid not null,"position" integer default 0 not null,"sets" integer not null,"reps" integer,"duration_seconds" integer,"rest_seconds" integer not null,"created_at" timestamp with time zone default now() not null);
create table public."workout_feedback" ("id" uuid default uuid_generate_v4() not null,"workout_id" uuid not null,"share_token" text,"emoji_rating" text,"rpe" integer,"notes" text,"exercises_completed" integer default 0 not null,"exercises_total" integer default 0 not null,"submitted_at" timestamp with time zone default now() not null,"athlete_name" text,"assignment_id" uuid,"athlete_id" uuid,"completed_date" date);
create table public."workout_prehab" ("id" uuid default uuid_generate_v4() not null,"workout_id" uuid not null,"exercise_id" uuid not null,"position" integer default 0 not null,"sets" integer default 2 not null,"reps" integer,"duration_seconds" integer,"rest_seconds" integer default 20 not null,"created_at" timestamp with time zone default now() not null);
create table public."workouts" ("id" uuid default uuid_generate_v4() not null,"coach_id" uuid not null,"name" text not null,"share_token" text default repeat('0',64) not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"is_ai_generated" boolean default false not null,"program_generated" boolean default false not null,"source_program_id" uuid);
alter table public."coaches" add constraint "coaches_email_key" UNIQUE (email);
alter table public."coaches" add constraint "coaches_pkey" PRIMARY KEY (id);
alter table public."exercises" add constraint "exercises_pkey" PRIMARY KEY (id);
alter table public."workouts" add constraint "workouts_name_length" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 160)));
alter table public."workouts" add constraint "workouts_pkey" PRIMARY KEY (id);
alter table public."workouts" add constraint "workouts_share_token_key" UNIQUE (share_token);
alter table public."workout_exercises" add constraint "workout_exercises_pkey" PRIMARY KEY (id);
alter table public."workout_exercises" add constraint "workout_exercises_values_valid" CHECK ((("position" >= 0) AND ((sets >= 1) AND (sets <= 100)) AND ((reps IS NULL) OR ((reps >= 1) AND (reps <= 10000))) AND ((duration_seconds IS NULL) OR ((duration_seconds >= 1) AND (duration_seconds <= 86400))) AND ((rest_seconds >= 0) AND (rest_seconds <= 86400))));
alter table public."workout_feedback" add constraint "feedback_athlete_name_length" CHECK (((athlete_name IS NULL) OR (char_length(athlete_name) <= 120)));
alter table public."workout_feedback" add constraint "feedback_completion_valid" CHECK (((exercises_completed >= 0) AND (exercises_total >= 0) AND (exercises_completed <= exercises_total)));
alter table public."workout_feedback" add constraint "feedback_emoji_valid" CHECK (((emoji_rating IS NULL) OR (emoji_rating = ANY (ARRAY['easy'::text, 'good'::text, 'hard'::text, 'veryhard'::text]))));
alter table public."workout_feedback" add constraint "feedback_notes_length" CHECK (((notes IS NULL) OR (char_length(notes) <= 1000)));
alter table public."workout_feedback" add constraint "workout_feedback_pkey" PRIMARY KEY (id);
alter table public."workout_feedback" add constraint "workout_feedback_rpe_check" CHECK (((rpe >= 1) AND (rpe <= 10)));
alter table public."athletes" add constraint "athletes_name_length" CHECK (((char_length(btrim(full_name)) >= 1) AND (char_length(btrim(full_name)) <= 120)));
alter table public."athletes" add constraint "athletes_notes_length" CHECK (((notes IS NULL) OR (char_length(notes) <= 5000)));
alter table public."athletes" add constraint "athletes_pkey" PRIMARY KEY (id);
alter table public."workout_assignments" add constraint "workout_assignments_pkey" PRIMARY KEY (id);
alter table public."workout_assignments" add constraint "workout_assignments_workout_id_athlete_id_key" UNIQUE (workout_id, athlete_id);
alter table public."programs" add constraint "programs_description_length" CHECK (((description IS NULL) OR (char_length(description) <= 5000)));
alter table public."programs" add constraint "programs_duration_weeks_range" CHECK (((duration_weeks >= 1) AND (duration_weeks <= 104)));
alter table public."programs" add constraint "programs_name_length" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 160)));
alter table public."programs" add constraint "programs_pkey" PRIMARY KEY (id);
alter table public."program_days" add constraint "program_days_day_of_week_check" CHECK (((day_of_week >= 0) AND (day_of_week <= 6)));
alter table public."program_days" add constraint "program_days_pkey" PRIMARY KEY (id);
alter table public."program_days" add constraint "program_days_program_id_week_number_day_of_week_key" UNIQUE (program_id, week_number, day_of_week);
alter table public."workout_prehab" add constraint "workout_prehab_pkey" PRIMARY KEY (id);
alter table public."workout_prehab" add constraint "workout_prehab_values_valid" CHECK ((("position" >= 0) AND ((sets >= 1) AND (sets <= 100)) AND ((reps IS NULL) OR ((reps >= 1) AND (reps <= 10000))) AND ((duration_seconds IS NULL) OR ((duration_seconds >= 1) AND (duration_seconds <= 86400))) AND ((rest_seconds >= 0) AND (rest_seconds <= 86400))));
alter table public."coaches" add constraint "coaches_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."exercises" add constraint "exercises_coach_id_fkey" FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE;
alter table public."workouts" add constraint "workouts_coach_id_fkey" FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE;
alter table public."workouts" add constraint "workouts_source_program_id_fkey" FOREIGN KEY (source_program_id) REFERENCES programs(id) ON DELETE SET NULL;
alter table public."workout_exercises" add constraint "workout_exercises_exercise_id_fkey" FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT;
alter table public."workout_exercises" add constraint "workout_exercises_workout_id_fkey" FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE;
alter table public."workout_feedback" add constraint "workout_feedback_assignment_id_fkey" FOREIGN KEY (assignment_id) REFERENCES workout_assignments(id) ON DELETE SET NULL;
alter table public."workout_feedback" add constraint "workout_feedback_athlete_id_fkey" FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE SET NULL;
alter table public."workout_feedback" add constraint "workout_feedback_workout_id_fkey" FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE;
alter table public."athletes" add constraint "athletes_active_program_id_fkey" FOREIGN KEY (active_program_id) REFERENCES programs(id) ON DELETE SET NULL;
alter table public."athletes" add constraint "athletes_coach_id_fkey" FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE;
alter table public."athletes" add constraint "athletes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."workout_assignments" add constraint "workout_assignments_athlete_id_fkey" FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE;
alter table public."workout_assignments" add constraint "workout_assignments_coach_id_fkey" FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE;
alter table public."workout_assignments" add constraint "workout_assignments_workout_id_fkey" FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE;
alter table public."programs" add constraint "programs_coach_id_fkey" FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE;
alter table public."program_days" add constraint "program_days_program_id_fkey" FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;
alter table public."program_days" add constraint "program_days_workout_id_fkey" FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE SET NULL;
alter table public."workout_prehab" add constraint "workout_prehab_exercise_id_fkey" FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT;
alter table public."workout_prehab" add constraint "workout_prehab_workout_id_fkey" FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.get_shared_workout(p_share_token text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'workout', jsonb_build_object(
      'id', w.id,
      'name', w.name,
      'coaches', jsonb_build_object('full_name', c.full_name),
      'athlete_name', a.full_name,
      'assignment_expires_at', wa.expires_at
    ),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', we.id, 'position', we.position, 'sets', we.sets,
        'reps', we.reps, 'duration_seconds', we.duration_seconds,
        'rest_seconds', we.rest_seconds,
        'exercises', jsonb_build_object(
          'name', e.name, 'description', e.description,
          'muscle_group', e.muscle_group, 'difficulty', e.difficulty
        )
      ) order by we.position)
      from public.workout_exercises we
      join public.exercises e on e.id = we.exercise_id
      where we.workout_id = w.id
    ), '[]'::jsonb),
    'prehab', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', wp.id, 'position', wp.position, 'sets', wp.sets,
        'reps', wp.reps, 'duration_seconds', wp.duration_seconds,
        'rest_seconds', wp.rest_seconds,
        'exercises', jsonb_build_object(
          'name', e.name, 'description', e.description,
          'muscle_group', e.muscle_group, 'difficulty', e.difficulty,
          'category', e.category, 'prehab_focus', e.prehab_focus
        )
      ) order by wp.position)
      from public.workout_prehab wp
      join public.exercises e on e.id = wp.exercise_id
      where wp.workout_id = w.id
    ), '[]'::jsonb)
  )
  from public.workout_assignments wa
  join public.workouts w on w.id = wa.workout_id
  join public.athletes a on a.id = wa.athlete_id
  left join public.coaches c on c.id = w.coach_id
  where length(p_share_token) = 64
    and p_share_token ~ '^[0-9a-f]+$'
    and wa.assignment_token = p_share_token
    and wa.revoked_at is null
    and wa.expires_at > now();
$function$
;
CREATE OR REPLACE FUNCTION public.workout_owned_by_coach(p_workout_id uuid, p_coach_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.workouts where id = p_workout_id and coach_id = p_coach_id
  )
$function$
;
alter table public."exercises" enable row level security;
alter table public."coaches" enable row level security;
alter table public."workout_exercises" enable row level security;
alter table public."workout_feedback" enable row level security;
alter table public."athletes" enable row level security;
alter table public."workout_assignments" enable row level security;
alter table public."program_days" enable row level security;
alter table public."programs" enable row level security;
alter table public."workout_prehab" enable row level security;
alter table public."workouts" enable row level security;
create policy "athletes can update own row" on public."athletes" as PERMISSIVE for UPDATE to "authenticated" using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "athletes can view their active program" on public."programs" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM athletes
  WHERE ((athletes.active_program_id = programs.id) AND (athletes.user_id = auth.uid())))));
create policy "athletes can view their active program days" on public."program_days" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM athletes
  WHERE ((athletes.active_program_id = program_days.program_id) AND (athletes.user_id = auth.uid())))));
create policy "athletes can view their own assignments" on public."workout_assignments" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM athletes
  WHERE ((athletes.id = workout_assignments.athlete_id) AND (athletes.user_id = auth.uid())))));
create policy "athletes can view assigned or scheduled workouts" on public."workouts" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM (workout_assignments wa
     JOIN athletes ath ON ((ath.id = wa.athlete_id)))
  WHERE ((wa.workout_id = workouts.id) AND (ath.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (program_days pd
     JOIN athletes ath ON ((ath.active_program_id = pd.program_id)))
  WHERE ((pd.workout_id = workouts.id) AND (ath.user_id = auth.uid()))))));
create policy "athletes can view exercises for visible workouts" on public."workout_exercises" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_exercises.workout_id) AND ((EXISTS ( SELECT 1
           FROM (workout_assignments wa
             JOIN athletes ath ON ((ath.id = wa.athlete_id)))
          WHERE ((wa.workout_id = w.id) AND (ath.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
           FROM (program_days pd
             JOIN athletes ath ON ((ath.active_program_id = pd.program_id)))
          WHERE ((pd.workout_id = w.id) AND (ath.user_id = auth.uid())))))))));
create policy "athletes can view prehab for visible workouts" on public."workout_prehab" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_prehab.workout_id) AND ((EXISTS ( SELECT 1
           FROM (workout_assignments wa
             JOIN athletes ath ON ((ath.id = wa.athlete_id)))
          WHERE ((wa.workout_id = w.id) AND (ath.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
           FROM (program_days pd
             JOIN athletes ath ON ((ath.active_program_id = pd.program_id)))
          WHERE ((pd.workout_id = w.id) AND (ath.user_id = auth.uid())))))))));
create policy "Coaches can view own workouts" on public."workouts" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = coach_id));
create policy "Coaches can insert own workouts" on public."workouts" as PERMISSIVE for INSERT to "authenticated" with check ((( SELECT auth.uid() AS uid) = coach_id));
create policy "Coaches can update own workouts" on public."workouts" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT auth.uid() AS uid) = coach_id)) with check ((( SELECT auth.uid() AS uid) = coach_id));
create policy "Coaches can delete own workouts" on public."workouts" as PERMISSIVE for DELETE to "authenticated" using ((( SELECT auth.uid() AS uid) = coach_id));
create policy "Coaches can manage own workout exercises" on public."workout_exercises" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_exercises.workout_id) AND (w.coach_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM (workouts w
     JOIN exercises e ON ((e.id = workout_exercises.exercise_id)))
  WHERE ((w.id = workout_exercises.workout_id) AND (w.coach_id = ( SELECT auth.uid() AS uid)) AND ((e.coach_id IS NULL) OR (e.coach_id = ( SELECT auth.uid() AS uid)))))));
create policy "Coaches manage own workout prehab" on public."workout_prehab" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_prehab.workout_id) AND (w.coach_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM (workouts w
     JOIN exercises e ON ((e.id = workout_prehab.exercise_id)))
  WHERE ((w.id = workout_prehab.workout_id) AND (w.coach_id = ( SELECT auth.uid() AS uid)) AND ((e.coach_id IS NULL) OR (e.coach_id = ( SELECT auth.uid() AS uid)))))));
create policy "Authenticated coaches can view exercise library" on public."exercises" as PERMISSIVE for SELECT to "authenticated" using (((coach_id IS NULL) OR (coach_id = ( SELECT auth.uid() AS uid))));
create policy "Coaches can read own workout feedback" on public."workout_feedback" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_feedback.workout_id) AND (w.coach_id = ( SELECT auth.uid() AS uid))))));
create policy "Coaches manage own athletes" on public."athletes" as PERMISSIVE for ALL to "authenticated" using ((( SELECT auth.uid() AS uid) = coach_id)) with check ((( SELECT auth.uid() AS uid) = coach_id));
create policy "Coaches manage own programs" on public."programs" as PERMISSIVE for ALL to "authenticated" using ((( SELECT auth.uid() AS uid) = coach_id)) with check ((( SELECT auth.uid() AS uid) = coach_id));
create policy "Coaches can view own profile" on public."coaches" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = id));
create policy "Coaches can update own profile" on public."coaches" as PERMISSIVE for UPDATE to "authenticated" using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));
create policy "Coaches insert own custom exercises" on public."exercises" as PERMISSIVE for INSERT to "authenticated" with check (((coach_id = ( SELECT auth.uid() AS uid)) AND (is_custom = true)));
create policy "Coaches update own custom exercises" on public."exercises" as PERMISSIVE for UPDATE to "authenticated" using ((coach_id = ( SELECT auth.uid() AS uid))) with check (((coach_id = ( SELECT auth.uid() AS uid)) AND (is_custom = true)));
create policy "Coaches delete own custom exercises" on public."exercises" as PERMISSIVE for DELETE to "authenticated" using ((coach_id = ( SELECT auth.uid() AS uid)));
create policy "athletes can read own row" on public."athletes" as PERMISSIVE for SELECT to "authenticated" using ((user_id = auth.uid()));
create policy "athletes can insert own workout_feedback" on public."workout_feedback" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM athletes
  WHERE ((athletes.id = workout_feedback.athlete_id) AND (athletes.user_id = auth.uid())))));
create policy "athletes can read own workout_feedback" on public."workout_feedback" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM athletes
  WHERE ((athletes.id = workout_feedback.athlete_id) AND (athletes.user_id = auth.uid())))));
create policy "Coaches manage own program days" on public."program_days" as PERMISSIVE for ALL to "public" using ((EXISTS ( SELECT 1
   FROM programs p
  WHERE ((p.id = program_days.program_id) AND (p.coach_id = ( SELECT auth.uid() AS uid)))))) with check (((EXISTS ( SELECT 1
   FROM programs p
  WHERE ((p.id = program_days.program_id) AND (p.coach_id = ( SELECT auth.uid() AS uid))))) AND ((workout_id IS NULL) OR workout_owned_by_coach(workout_id, ( SELECT auth.uid() AS uid)))));
create policy "Coaches manage own assignments" on public."workout_assignments" as PERMISSIVE for ALL to "public" using ((( SELECT auth.uid() AS uid) = coach_id)) with check (((( SELECT auth.uid() AS uid) = coach_id) AND workout_owned_by_coach(workout_id, ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = workout_assignments.athlete_id) AND (a.coach_id = ( SELECT auth.uid() AS uid)))))));
grant DELETE on public."athletes" to "authenticated";
grant INSERT on public."athletes" to "authenticated";
grant REFERENCES on public."athletes" to "authenticated";
grant SELECT on public."athletes" to "authenticated";
grant TRIGGER on public."athletes" to "authenticated";
grant TRUNCATE on public."athletes" to "authenticated";
grant UPDATE on public."athletes" to "authenticated";
grant DELETE on public."athletes" to "service_role";
grant INSERT on public."athletes" to "service_role";
grant REFERENCES on public."athletes" to "service_role";
grant SELECT on public."athletes" to "service_role";
grant TRIGGER on public."athletes" to "service_role";
grant TRUNCATE on public."athletes" to "service_role";
grant UPDATE on public."athletes" to "service_role";
grant DELETE on public."coaches" to "authenticated";
grant INSERT on public."coaches" to "authenticated";
grant REFERENCES on public."coaches" to "authenticated";
grant SELECT on public."coaches" to "authenticated";
grant TRIGGER on public."coaches" to "authenticated";
grant TRUNCATE on public."coaches" to "authenticated";
grant UPDATE on public."coaches" to "authenticated";
grant DELETE on public."coaches" to "service_role";
grant INSERT on public."coaches" to "service_role";
grant REFERENCES on public."coaches" to "service_role";
grant SELECT on public."coaches" to "service_role";
grant TRIGGER on public."coaches" to "service_role";
grant TRUNCATE on public."coaches" to "service_role";
grant UPDATE on public."coaches" to "service_role";
grant DELETE on public."exercises" to "authenticated";
grant INSERT on public."exercises" to "authenticated";
grant REFERENCES on public."exercises" to "authenticated";
grant SELECT on public."exercises" to "authenticated";
grant TRIGGER on public."exercises" to "authenticated";
grant TRUNCATE on public."exercises" to "authenticated";
grant UPDATE on public."exercises" to "authenticated";
grant DELETE on public."exercises" to "service_role";
grant INSERT on public."exercises" to "service_role";
grant REFERENCES on public."exercises" to "service_role";
grant SELECT on public."exercises" to "service_role";
grant TRIGGER on public."exercises" to "service_role";
grant TRUNCATE on public."exercises" to "service_role";
grant UPDATE on public."exercises" to "service_role";
grant DELETE on public."program_days" to "authenticated";
grant INSERT on public."program_days" to "authenticated";
grant REFERENCES on public."program_days" to "authenticated";
grant SELECT on public."program_days" to "authenticated";
grant TRIGGER on public."program_days" to "authenticated";
grant TRUNCATE on public."program_days" to "authenticated";
grant UPDATE on public."program_days" to "authenticated";
grant DELETE on public."program_days" to "service_role";
grant INSERT on public."program_days" to "service_role";
grant REFERENCES on public."program_days" to "service_role";
grant SELECT on public."program_days" to "service_role";
grant TRIGGER on public."program_days" to "service_role";
grant TRUNCATE on public."program_days" to "service_role";
grant UPDATE on public."program_days" to "service_role";
grant DELETE on public."programs" to "authenticated";
grant INSERT on public."programs" to "authenticated";
grant REFERENCES on public."programs" to "authenticated";
grant SELECT on public."programs" to "authenticated";
grant TRIGGER on public."programs" to "authenticated";
grant TRUNCATE on public."programs" to "authenticated";
grant UPDATE on public."programs" to "authenticated";
grant DELETE on public."programs" to "service_role";
grant INSERT on public."programs" to "service_role";
grant REFERENCES on public."programs" to "service_role";
grant SELECT on public."programs" to "service_role";
grant TRIGGER on public."programs" to "service_role";
grant TRUNCATE on public."programs" to "service_role";
grant UPDATE on public."programs" to "service_role";
grant DELETE on public."workout_assignments" to "authenticated";
grant INSERT on public."workout_assignments" to "authenticated";
grant REFERENCES on public."workout_assignments" to "authenticated";
grant SELECT on public."workout_assignments" to "authenticated";
grant TRIGGER on public."workout_assignments" to "authenticated";
grant TRUNCATE on public."workout_assignments" to "authenticated";
grant UPDATE on public."workout_assignments" to "authenticated";
grant DELETE on public."workout_assignments" to "service_role";
grant INSERT on public."workout_assignments" to "service_role";
grant REFERENCES on public."workout_assignments" to "service_role";
grant SELECT on public."workout_assignments" to "service_role";
grant TRIGGER on public."workout_assignments" to "service_role";
grant TRUNCATE on public."workout_assignments" to "service_role";
grant UPDATE on public."workout_assignments" to "service_role";
grant DELETE on public."workout_exercises" to "authenticated";
grant INSERT on public."workout_exercises" to "authenticated";
grant REFERENCES on public."workout_exercises" to "authenticated";
grant SELECT on public."workout_exercises" to "authenticated";
grant TRIGGER on public."workout_exercises" to "authenticated";
grant TRUNCATE on public."workout_exercises" to "authenticated";
grant UPDATE on public."workout_exercises" to "authenticated";
grant DELETE on public."workout_exercises" to "service_role";
grant INSERT on public."workout_exercises" to "service_role";
grant REFERENCES on public."workout_exercises" to "service_role";
grant SELECT on public."workout_exercises" to "service_role";
grant TRIGGER on public."workout_exercises" to "service_role";
grant TRUNCATE on public."workout_exercises" to "service_role";
grant UPDATE on public."workout_exercises" to "service_role";
grant DELETE on public."workout_feedback" to "authenticated";
grant INSERT on public."workout_feedback" to "authenticated";
grant REFERENCES on public."workout_feedback" to "authenticated";
grant SELECT on public."workout_feedback" to "authenticated";
grant TRIGGER on public."workout_feedback" to "authenticated";
grant TRUNCATE on public."workout_feedback" to "authenticated";
grant UPDATE on public."workout_feedback" to "authenticated";
grant DELETE on public."workout_feedback" to "service_role";
grant INSERT on public."workout_feedback" to "service_role";
grant REFERENCES on public."workout_feedback" to "service_role";
grant SELECT on public."workout_feedback" to "service_role";
grant TRIGGER on public."workout_feedback" to "service_role";
grant TRUNCATE on public."workout_feedback" to "service_role";
grant UPDATE on public."workout_feedback" to "service_role";
grant DELETE on public."workout_prehab" to "authenticated";
grant INSERT on public."workout_prehab" to "authenticated";
grant REFERENCES on public."workout_prehab" to "authenticated";
grant SELECT on public."workout_prehab" to "authenticated";
grant TRIGGER on public."workout_prehab" to "authenticated";
grant TRUNCATE on public."workout_prehab" to "authenticated";
grant UPDATE on public."workout_prehab" to "authenticated";
grant DELETE on public."workout_prehab" to "service_role";
grant INSERT on public."workout_prehab" to "service_role";
grant REFERENCES on public."workout_prehab" to "service_role";
grant SELECT on public."workout_prehab" to "service_role";
grant TRIGGER on public."workout_prehab" to "service_role";
grant TRUNCATE on public."workout_prehab" to "service_role";
grant UPDATE on public."workout_prehab" to "service_role";
grant DELETE on public."workouts" to "authenticated";
grant INSERT on public."workouts" to "authenticated";
grant REFERENCES on public."workouts" to "authenticated";
grant SELECT on public."workouts" to "authenticated";
grant TRIGGER on public."workouts" to "authenticated";
grant TRUNCATE on public."workouts" to "authenticated";
grant UPDATE on public."workouts" to "authenticated";
grant DELETE on public."workouts" to "service_role";
grant INSERT on public."workouts" to "service_role";
grant REFERENCES on public."workouts" to "service_role";
grant SELECT on public."workouts" to "service_role";
grant TRIGGER on public."workouts" to "service_role";
grant TRUNCATE on public."workouts" to "service_role";
grant UPDATE on public."workouts" to "service_role";
grant usage on schema public to anon,authenticated,service_role;