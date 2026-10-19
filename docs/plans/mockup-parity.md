# Plan: bring the app to the "ChalkUp redesign mockups" spec

**Mockup:** https://claude.ai/artifact/YSnVSxDRrj7DqrrTqS5Zsf (23 clickable boards; press Play on any board). Private until the owner shares it.
**Branch convention:** one PR per phase into `main`, as for Program Tools. `npm run build` is the only automated check today (see Phase 0 for adding tests).
**Status:** plan only. No app code changed by this document.

## 1. What the mockup is

A coach-first product with three surfaces:

| Surface | Boards | Navigation |
|---|---|---|
| Coach, desktop (1280) | 1 Today, 2 Athletes, 2b Inbox, 3 Athlete hub, 4 Plan › Programs, 4b Program editor, 4c Plan › Exercises, 5 Plan › Workouts, 5b Workout builder | Sidebar: **Today · Athletes · Inbox · Plan** (Plan has sub-tabs Programs / Workouts / Exercises) |
| Coach, phone (390) | 6 Today, 7 Athletes, M1 Plan, M2 Program editor, M3 Workout builder, M4 Inbox, M5 Thread + request | Bottom tabs: same four |
| Athlete portal, phone | A1 Today (workout due), A2 Today (rest day), A3 Runner, A4 Finish + feedback, A5 Week, A6 Progress, A7 Coach | Bottom tabs: **Today · Week · Progress · Coach** |

Visual language: dark surface, lime accent `#C7E45C`, Big Shoulders Display / IBM Plex Sans / IBM Plex Mono, line icons (no emoji), 44px touch targets on phones, pills for filters, chips for status, a toast with Undo for anything destructive.

## 2. Where the app is today

**Already matches (no work):** the colour tokens, the three fonts and the CSS variables in `index.html` are the mockup's (a previous redesign pass did this). Program Tools (full-program generate, fill week, copy weeks, draft-first save, undo) and bulk delete are built and are in the mockup's spirit. The streak rule (`src/lib/streaks.js`) is the single source of truth.

**Gap, in one sentence:** the mockup is organised around *"who needs me today"* and a *coach↔athlete conversation*; the app is organised around *CRUD pages* (Dashboard = workout list, Roster, Programs, History, Library) and has **no messaging, no schedule requests, and no per-athlete schedule changes**.

### Screen-by-screen delta

| Mockup board | Current app | Delta | Size |
|---|---|---|---|
| **Shell / nav** | Sidebar: Dashboard, Roster, Programs, History, Exercise library, + New workout. Mobile: Home, Roster, ＋, Library, More | Re-IA to Today / Athletes / Inbox (unread badge) / Plan; Create menu + global search in Today header; emoji → icons. History page goes away (its content moves into Athlete hub + Today). Sidebar 200→220px | M |
| **1 Today** | `Dashboard.jsx` is the *workout list* | New home: 3 stat cards (trained today / need you / no program), **Needs you** triage list with inline Message / Reply / Nudge (composer dialog, Unsend), **Completed today** with feel + RPE chips, **This week** all-athletes dot grid, "N athletes have no program" card | L |
| **2 Athletes** | `Roster.jsx` grouped cards | Table: avatar, name + chip (Streak at risk / Missed N / New note / No program / Invite pending), program + "Week 2 of 4", streak, M–S dots, last trained; filter pills with counts (All / Needs attention / No program / per group); multi-select bar: **Assign program** (start next Monday or today, shows "replaces a program" warning + first-session preview), Assign workout, Message | L |
| **3 Athlete hub** | `AthleteProfile.jsx` (assignments, program picker, invite) | Stats row (streak, done this month, avg RPE, follow-through); week navigator with day tiles + day detail + log (sets, time, effort); **Adjust week** (per-athlete overrides, "Adjusted" tags, Reset to program); Recent feedback with inline Reply; Program card (Change, Shift start, progress); 5-week sessions/RPE trend; Extra workouts; Portal access | XL |
| **2b / M4 / M5 Inbox** | none | One thread per athlete: messages, feedback cards, system lines, **schedule request** card (Approve / Suggest another day / Decline), channel picker (In-app / SMS / Email), templates, unread + request filters | XL |
| **4 Programs list** | `Programs.jsx` | Card grid with per-week training-day thumbnail, "In use / Not assigned" chip, athlete avatars → assign popover, ⋯ menu (Open, Duplicate, Delete with Undo) | M |
| **4b Program editor** | `ProgramBuilder.jsx` (+ Program Tools) | Grid + right inspector (day type, workout, meta, note), **impact panel** ("3 athletes affected", Leave this week / Update now), save-confirm dialog (who sees it, when, keep/reset personal adjustments), "On this program" list, **Balance across the block**, undo after save, Copy down. Tools menu already exists | L |
| **5 Workouts** | the workout list inside `Dashboard.jsx` | Table (focus chips, exercise count, assigned-to avatars, last done), assign dialog, ⋯ Edit / Duplicate / Copy athlete link / Delete, **delete-vs-archive-keep-history** dialog, "Program workouts" summary row | M |
| **5b Workout builder** | `WorkoutBuilder.jsx` (938 lines) | Two-pane (library left, main + prehab right), steppers for sets/reps/rest, "Prehab first" suggestions by muscle group, Quick fill (AI / randomize) with Undo, live "about N min" | M |
| **4c Exercises** | `Library.jsx` | Table + detail pane (cue, defaults, **Used in** workouts), category and muscle filters, New exercise dialog | M |
| **A1–A2 Athlete Today** | `AthleteToday.jsx` + `WorkoutRunner` | Workout card (exercise/prehab counts, minutes, preview), latest coach message, week strip; rest-day variant with *Next up* and **optional recovery that counts toward the streak** | M |
| **A3 Runner / A4 Finish** | `WorkoutRunner.jsx` (414 lines) | Tap-a-set model with auto rest timer (+15s / Skip), collapsible exercise rows, "Finish early still counts", feel + RPE chips + note, streak-result screen | M |
| **A5 Week / A6 Progress** | `AthleteProgram.jsx`, `AthleteHistory.jsx` | Week with expandable days and **Ask coach to move**; Progress with streak/best, month calendar, tap a day for log + coach reply | M |
| **A7 Coach** | none | Thread view, quick replies, composer | M (depends on Inbox) |

## 3. Data and backend changes (all new; none exist today)

The live schema has no messaging, requests, overrides, phone number or archive flag. Proposed migrations, numbered after `0010`:

1. **`0011_athlete_day_overrides`**: `athlete_day_overrides(athlete_id, date, day_type, workout_id, program_id, created_at)` unique on `(athlete_id, date)`. Keyed by *calendar date* so it survives Shift start and program changes. `streaks.js#isDueOnDate`, `streakData.js`, `AthleteProgram` and `AthleteToday` must all read it (one rule, as today). RLS: coach manages own athletes' rows; athlete reads own. Use a `SECURITY DEFINER` helper rather than cross-table inline policies (the 0006 recursion lesson).
2. **`0012_messaging`**: `messages(id, coach_id, athlete_id, sender 'coach'|'athlete'|'system', kind 'text'|'feedback'|'schedule_change'|'request', body, channel 'in_app'|'sms'|'email', feedback_id, request_id, created_at, delivered_at, read_at, unsent_at)` and `schedule_requests(id, athlete_id, coach_id, from_date, to_date, note, status 'pending'|'approved'|'declined'|'suggested', suggested_date, resolved_at)`. One thread per athlete (the mockup has no group threads), so no `threads` table. A trigger inserts a `kind='feedback'` message when `submit_athlete_workout_feedback` runs, so Inbox is derived from existing data. RPCs: `send_message`, `unsend_message` (only while `read_at is null`), `resolve_schedule_request` (approve writes an override, adds a system line).
3. **`0013_athlete_contact_and_prefs`**: `athletes.phone`, `athletes.preferred_channel`; `push_subscriptions(athlete_id, endpoint, keys)`.
4. **`0014_workout_archive`**: `workouts.archived_at`. Archive hides the workout from lists and assignment but keeps `workout_feedback` (today a delete cascades it away; `delete_workouts` already has a keep-history mode, so this formalises it).
5. **`0015_recovery_logs`**: `recovery_logs(athlete_id, date, program_day…)` for optional days. Streak rule change: a logged non-due day **adds 1 and never breaks** (today non-due days are skipped without looking at completions). Add `athletes.best_streak`.
6. **`0016_program_apply_modes`**: extend `save_program` with `p_apply 'next'|'now'` and `p_adjustments 'keep'|'reset'`. *Leave this week* = before replacing `program_days`, write overrides for every affected athlete's current-week cells holding the **old** values; *Reset* deletes that athlete's overrides for the program. Add `assign_program_bulk(athlete_ids[], program_id, start_on)` and `get_today_overview()` / `get_athlete_week()` aggregate RPCs so Today and Athletes don't do N+1 client queries (Roster does this today in `batchComputeStreaks`).

**Edge functions** (Supabase): `send-sms` (Twilio), `send-email` (Resend), `send-push` (Web Push; the app is already a PWA). Secrets live in function env, never in the client.

**Derived metrics** (define once in a lib, used by Today, Athletes and the hub): *done this month* = distinct completed dates; *avg RPE* = mean of `workout_feedback.rpe` in range; *follow-through* = completed due days ÷ due days over the last 4 weeks; *needs attention* = missed ≥2 due days, or streak at risk (≥7 and nothing logged today), or unread feedback note, or open request.

## 4. Decisions to confirm (defaults in bold)

1. **SMS and Email: real or stubbed?** **Build the in-app channel fully; ship SMS/Email behind a flag with the Twilio/Resend functions, off until keys are provided.** The channel picker is visible but SMS/Email show "Connect in Settings" until enabled.
2. **"You can unsend until they open it."** True for in-app. SMS/email cannot be recalled. **Hold SMS/email sends for 60 s in a queue (pg_cron + function) so Unsend works; reword the copy per channel.**
3. **Schedule model for "Leave this week".** **Overrides keyed by date** (above) rather than versioning programs.
4. **History page.** **Remove it**; its content lives in Athlete hub (feedback, logs) and Today (completed). Redirect `/history` to `/athletes`.
5. **Mockup's "Meet" day type** is the DB's `competition`. **Keep the enum, show the label "Meet".** The mockup's exercise "Type" has strength/prehab only; the DB also has `mobility` (**show it as a third filter**). "Coaching cue" = `exercises.description`.
6. **Group names** ("Adult gym", "Competitive") come from `athletes.group_name`; filters are generated from data, not hard-coded.
7. **Add athlete** stays a page/dialog (the mockup only toasts "Add athlete form would open here"). **Reuse `AthleteForm` in a dialog on desktop.**

## 5. Phases

Each phase is shippable alone and leaves the app working. Old routes keep redirecting so shared links and the PWA don't break.

### Phase 0: Foundation (S–M)
- Extract mockup primitives into `src/components/ui/`: `Avatar`, `Chip`, `Pill` (with counts), `Segmented`, `StatCard`, `WeekDots` (done/missed/rest/today/future), `Dialog` + `Sheet` (one component, sheet on phones), `Toast` with Undo (generalise `BulkDelete.Toast`), `Icon` set replacing emoji in nav and `DAY_TYPE_COLORS`.
- `theme.js`: add `WEEK_STATE` colours; drop the emoji fields.
- Add **Vitest** and tests for `streaks.js`, `programGenerator.js` and the new metrics lib (no test runner exists today, and the recovery-streak change in Phase 5 needs one).
- **Done when:** primitives are used by at least one existing screen each; `npm run build` and `npm test` pass.

### Phase 1: Shell, navigation, Today (L)
- New `Layout`: 220px sidebar and 4-tab bottom bar (Today / Athletes / Inbox / Plan); user block with Sign out; Inbox badge reads 0 until Phase 4.
- Routes: `/today`, `/athletes`, `/athletes/:id`, `/inbox`, `/plan/programs|workouts|exercises`, `/plan/programs/:id`, `/plan/workouts/new|:id`. Redirect `/dashboard`, `/roster*`, `/programs*`, `/library*`, `/workout*`, `/history`.
- **Today (read-only first):** greeting, search (athletes, programs, workouts), Create menu, stat cards, Needs you (reasons computed from the metrics lib; actions are links until Phase 4), Completed today, This week grid, no-program card. Back it with `get_today_overview()`.
- Move the workout list out of Dashboard into Phase 2's Workouts page; until then keep it reachable at `/plan/workouts` using the existing component.
- **Done when:** every old route redirects; Today loads in one RPC; no horizontal scroll at 375px; Lighthouse a11y pass on shell.

### Phase 2: Plan (M–L)
- Sub-nav (Programs / Workouts / Exercises), shared list header with search, count and primary action.
- **Programs list** (thumbnail grid, assign popover over `assign_program_bulk`, duplicate, delete with Undo). **Workouts list** (table, assign dialog, archive-vs-delete with the counts the mockup shows; `0014`). **Exercises** (table + detail pane + "Used in" query + New exercise dialog). **Workout builder** to two-pane with steppers and prehab suggestions; Quick fill Undo.
- **Program editor:** right-hand inspector replaces the cell popover on desktop; "On this program" and "Balance across the block" panels. The save-confirm dialog + impact panel ship in Phase 3 once overrides exist.
- **Done when:** parity with boards 4, 4c, 5, 5b, M1, M3 at 1280 and 390; Program Tools acceptance criteria in `docs/handoffs/program-tools.md` still pass.

### Phase 3: Athletes, Athlete hub, overrides, program save impact (XL)
- `0011` overrides + engine change in `streaks.js` / `streakData.js` / portal readers, with unit tests (an override day replaces the program cell for due-ness, workout and notes).
- **Athletes table** with filters, counts, chips and the multi-select bar (Assign program with the replace warning and first-session preview; Assign workout; Message wired in Phase 4).
- **Athlete hub:** stats, week navigator, day detail + log, Adjust week / Save for athlete / Reset, trend chart, extra workouts (existing `workout_assignments`), portal access (existing reset RPC), Change program / Shift start dialogs.
- **Program save-confirm** with Leave this week / Update now and Keep / Reset adjustments (`0016`).
- **Done when:** adjusting Maya's Friday changes only Maya's portal, her streak and the hub; saving a program with *Leave this week* leaves in-progress athletes' current week unchanged and applies to next week; completed days can't be edited.

### Phase 4: Messaging and Inbox (XL)
- `0012`, `0013`; `send_message` / `unsend_message` / `resolve_schedule_request`; feedback trigger.
- Coach **Composer** (channel, templates by context, Unsend toast) used from Today, Athletes bulk bar, hub and Inbox; **Inbox** two-pane on desktop, list → thread on phone, with request card actions and filters.
- Edge functions `send-sms`, `send-email`, `send-push` behind a feature flag (Decision 1 and 2).
- Wire Needs-you actions on Today and Reply on hub feedback.
- **Done when:** an athlete's feedback appears in Inbox and on Today; approving a request writes an override and a system line the athlete sees; unsend works before `read_at`; RLS probes show a coach can't read another coach's messages (same rolled-back-probe method as migration 0006/0007).

### Phase 5: Athlete portal redesign (L)
- New tabs (Today / Week / Progress / Coach) replacing Today / History / Program; header keeps the streak flame.
- Today: workout card, latest coach message, week strip; rest variant with *Next up* and **optional recovery log** (`0015`, streak rule).
- **Runner:** tap-a-set, auto rest timer with +15s / Skip, collapse/expand, Finish early. **Finish:** feel + RPE + note, "send to coach" and streak-result screen. Keep `submit_athlete_workout_feedback` as the write path.
- Week with **Ask coach to move** (creates a `schedule_requests` row); Progress with month calendar, best streak, day detail + coach reply; Coach thread with quick replies; push permission prompt.
- **Done when:** boards A1–A7 match at 390; offline-tolerant runner (set taps queue and sync); streak numbers equal the coach's view for the same athlete.

### Phase 6: Phone coach polish and cleanup (S–M)
- Boards 6, 7, M2, M4, M5 pass; sheets clear the status bar (`--sat`); remove dead pages (`Dashboard` list code, `History.jsx`, old `Roster`) and unused emoji constants; update this doc's checklist.

## 6. Risks

- **Streak correctness** is the riskiest change (overrides + recovery logging touch the one rule both sides share). Mitigation: Phase 0 tests first; keep `current_streak` cache but invalidate it when an override is written for a past-or-today date.
- **Cost of Today/Athletes queries** as rosters grow. Mitigation: the two aggregate RPCs in `0016`; no per-athlete client fetches.
- **RLS recursion** between `athletes`, `program_days`, `workout_assignments` and the new tables. Mitigation: `SECURITY DEFINER` helpers only, probe each migration.
- **SMS/email compliance** (consent, STOP handling, quiet hours) is out of scope for the first cut; the flag keeps it off until addressed.
- **Mockup is demo data.** It hard-codes names, dates ("Oct 16"), 4-week programs and Maya's 2 adjusted days; none of that should leak into logic.

## 7. Order and rough sequence

`0 → 1 → 2` can overlap after Phase 0. `3` must precede `4` (requests write overrides). `5` depends on `4` for the Coach tab but its Today / Runner / Finish pieces can ship earlier behind the existing tab bar. Suggested PR count: ~10–12.
