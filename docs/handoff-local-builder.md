# ChalkUp hand-off for a local builder

Repo: `AgentBim/gymcoach` · Supabase project `nqrlhotrwyrphwumxtty` · Deploys on Vercel (SPA rewrite in `vercel.json`).
Stack: React 18 + Vite 5, react-router-dom 6, Supabase (auth, Postgres, RLS, RPCs). Tests: Vitest (`npm test`, 41 passing). Build: `npm run build`.

## 1. State of play

| Item | Status |
|---|---|
| Mockup redesign (coach app, athlete portal, in-app messaging) | Merged to `main` in #19 |
| `save_workout` / `duplicate_workout` migration (0015) | Merged in #20 |
| Sign-in redesign, Google sign-in, thread-scroll fix, coach-name fix | **Open: [#21](https://github.com/AgentBim/gymcoach/pull/21)**, branch `claude/funny-gauss-iyslji` |
| Migrations 0011-0016 | Applied live |
| **Migration 0017** | **In the repo, NOT applied live** |
| Google provider in Supabase | **Not configured** |
| Delete `abebe.brice@gmail.com` | **Not done** (requested by the owner) |

Plan and decisions: `docs/plans/mockup-parity.md` (all phases ticked).

## 2. Actions to finish (in order)

These need a signed-in browser or SQL access. The cloud session that built this could not reach the Supabase or Google dashboards, and its Supabase SQL tool hung on any statement containing `DELETE`.

### A. Apply migration 0017
Dashboard: `https://supabase.com/dashboard/project/nqrlhotrwyrphwumxtty/sql/new`. Paste `supabase/migrations/0017_invite_claim_google.sql` and run it.

Why: a first-time Google user has no role metadata, so the `handle_new_user` trigger gives them an empty `coaches` row, and `claim_athlete_invite` then refuses them as a coach. 0017 deletes that auto-created profile only when it is under 1 day old and owns no athletes, programs, workouts or custom exercises.

Safety note: every table that references `coaches` is `ON DELETE CASCADE`. Do not loosen the emptiness check.

Verify:
```sql
select position('delete from public.coaches' in pg_get_functiondef(p.oid)) > 0 as applied
from pg_proc p where p.proname = 'claim_athlete_invite';   -- expect true
```

### B. Enable Google sign-in
1. Google Cloud > APIs & Services > Credentials: create an OAuth client, type **Web application**. Authorized redirect URI: `https://nqrlhotrwyrphwumxtty.supabase.co/auth/v1/callback`. Copy the client ID and secret.
2. Supabase > Authentication > Providers > Google: enable, paste the ID and secret.
3. Supabase > Authentication > URL Configuration > Redirect URLs: add `<production-origin>/auth/callback` and `<production-origin>/athlete/invite/*` (and the same for the Vercel preview origin and `http://localhost:5173` if testing locally). The owner knows the production domain.
4. Confirm "link accounts with the same email" is on (default), so an existing athlete signing in with Google gets the same user id as their password account.

### C. Delete `abebe.brice@gmail.com`
The owner confirmed deleting the whole account. Id `85480262-6628-49b7-bb99-3af7b8427a83`. It holds 1 athlete (no portal login), 1 program, 3 workouts, no feedback or messages. Irreversible.

Dashboard: Authentication > Users > delete that user (this cascades to `coaches` and all coach-owned rows). Or SQL, checking the email first:
```sql
delete from auth.users
where id = '85480262-6628-49b7-bb99-3af7b8427a83' and email = 'abebe.brice@gmail.com';
```
Verify: `select count(*) from public.coaches where id = '85480262-6628-49b7-bb99-3af7b8427a83';` returns 0.

### D. Merge #21
After A and B. (Merging first is safe for the code, but new Google athletes will fail invite claims until A is applied.)

## 3. QA that was never done against the real app

Everything below was verified only against a mock server or in rolled-back DB transactions. Nothing was run in a real browser against the live project.

**Google sign-in matrix** (after B):
- New coach: Sign up with Google on `/login` > lands on `/today`; `coaches` row has the Google name.
- Existing coach (same email as password account): Continue with Google > `/today`, same user id.
- Existing athlete on `/athlete/login` with Google > `/athlete`.
- Athlete using Google on `/login` (coach) > bounced to `/login` with "This is an athlete account...", signed out.
- Unknown Google account on `/athlete/login` > bounced with "isn't linked to an athlete profile", signed out.
- New athlete on an invite link `/athlete/invite/:token` > Continue with Google > ends on `/athlete`, `athletes.user_id` set, auto-created coach row gone (needs A).
- Cancel on Google's consent screen > back on the login page with the error text.

**Athlete portal with a real athlete account** (create a throwaway athlete under the owner's coach account, delete it afterwards): finish a workout (streak updates, coach sees feedback), send a message (shows in coach Inbox), ask to move a day (shows as a request; Approve creates overrides), recovery-day "Log it as done", rest-day state.

**Inbox and Coach tab scroll:** long thread opens at the newest message on phone and desktop; sending a message keeps it pinned.

## 4. Conventions and gotchas

- **Schedule rule (single source of truth):** `src/lib/streaks.js` `resolveDay`: personal override by date > program cell > "free" (no program, every day due). Kinds `due`, `optional` (recovery; never breaks streak, counts if logged), `rest`. Coach and athlete views both go through it.
- **RLS conventions:** RPCs are SECURITY INVOKER with `search_path ''`. SECURITY DEFINER only for cross-table policy checks (avoids 42P17 recursion) or when an athlete must read something they can't select (`athlete_coach_name()`). New tables need explicit grants to `authenticated`. Qualify `coach_id` in policy subqueries.
- **The athlete insert policy on `messages` is intentional:** athletes may insert `messages` as `sender = 'athlete'` into their own thread; `create_schedule_request` relies on it.
- **Auth pool is shared** by coaches and athletes. `useAuth.signIn` and `useAthleteAuth.signIn` check role at login. Route guards: `ProtectedRoute`, `ProtectedAthleteRoute`.
- **Signup trigger:** `handle_new_user` skips only `raw_user_meta_data.role = 'athlete'`. `signInWithOAuth` cannot pass metadata, hence 0017.
- **`AUTH_LINK_ERROR`** (`src/lib/supabase.js`) is read once at load from the URL hash and drives a "link expired" notice on `/login`; OAuth errors are handled separately in `AuthCallback`.
- **Supabase MCP quirks (if you use it):** large `apply_migration` payloads time out; prefer small chunks, `execute_sql`, `ALTER POLICY`. Avoid `get diagnostics`. Probe RLS in a `DO` block that ends with `raise exception 'RESULT ' || r::text` so everything rolls back.
- **Git:** the old remote branch tip held pre-squash history, and force-push was denied in the cloud session, so the branch carries two no-content `-s ours` merge commits. Harmless; a squash merge drops them.
- **Not in the repo:** the mock Supabase server and Playwright screenshot scripts used for verification lived in the cloud session's scratchpad. Recreate if you want them.

## 5. Deliberate deviations from the mockup

- Real deletes keep a confirm sheet instead of undo toasts.
- No "athletes notified" claim and no save-undo on the program editor.
- No time-tracking column on the coach side (time shows only on the athlete Finish screen).
- "Ask coach to move" includes a target day so Approve works.
- SMS and Email are shown as "soon" in the compose dialog; in-app messaging only (owner decision).
- History was removed and folded into Athlete hub and Today.

## 6. File map

- Shell and routes: `src/App.jsx`, `src/components/{Sidebar,BottomNav,Layout}.jsx`, `src/components/ui/`
- Coach pages: `src/pages/{Today,Athletes,AthleteHub,Inbox,Programs,Workouts,Library,ProgramBuilder,WorkoutBuilder}.jsx`
- Athlete portal: `src/pages/athlete/*`, `src/hooks/useAthletePortal.jsx` (single loader for all portal tabs)
- Auth screens: `src/components/AuthShell.jsx`, `src/pages/{Login,AthleteLogin,ForgotPassword,AthleteForgotPassword,ResetPassword,AthleteInviteAccept,AuthCallback}.jsx`, `src/lib/oauth.js`
- Domain logic and tests: `src/lib/` and `src/lib/__tests__/`
- Migrations: `supabase/migrations/0011`-`0017`

## 7. Out of scope (owner chose to defer)

SMS and email delivery. Anything beyond what the mockup shows; the owner will iterate from here.
