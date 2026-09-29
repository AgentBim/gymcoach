# Handoff: Program Tools (full program generation, copy weeks, draft-first saving)

**Mockup:** https://claude.ai/artifact/Ar6JMCdZKbdzKL8VtRSKrj. Seven clickable phone screens; press Play on "Program builder". The link is private until the owner shares it from the page's Share menu.
**Branch:** `feature/redesign` (PRs into `main`)
**Stack:** React 18 + Vite, Supabase (project `nqrlhotrwyrphwumxtty`), Vercel. No test runner or linter: `npm run build` is the only automated check.

## Goal

Replace the single-week "Generate" button in `ProgramBuilder` with a **Program tools** menu that offers three tools:

1. **Generate full program:** fills every week at once. You choose a split, training days, how workouts vary across weeks, progression and deloads. A preview lets you reroll or lock workouts before accepting.
2. **Fill a week:** today's generator, upgraded to a separate body-part focus for each day.
3. **Copy weeks:** copies one week to any other weeks, either **linked** (same workouts) or **cloned** (independent copies, optionally progressed).

Two product rules the user set:

- **Nothing is written to the database until Save.** Every tool only edits the in-memory draft, and each tool run can be undone.
- **Program-generated workouts never appear alongside hand-built ones** in the coach's workout list. They are managed inside their program.

## Read this first: how the mockup maps to the real app

- The mockup's **"Library" screen is the Home screen (`src/pages/Dashboard.jsx`)** in the real app. That's where hand-built workouts are listed. The real `/library` route (`src/pages/Library.jsx`) is the *exercise* library and does not change. Ignore the mockup's Workouts/Exercises tabs.
- The mockup uses line icons. The app currently uses emoji in `ProgramBuilder` (day types, 👁). Either follow the app's existing style or switch to icons consistently; don't mix them within one screen.
- The mockup's sample program (Upper/Lower, 8 weeks, new exercises every 4 weeks, +1 set per week, deload every 4th week) is just demo data. The logic must be general.

## Current state (what exists today)

- `src/pages/ProgramBuilder.jsx`
  - Draft state: `days = { 'w{week}d{dayIdx}': { day_type, workout_id, notes } }`. `dayIdx` 0 is Monday.
  - `save()` updates `programs`, **deletes all `program_days`, then re-inserts them**, and checks none of those errors (lines ~101–129). A failed insert silently wipes the program's schedule. This is the root blind spot that hid the RLS recursion bug fixed in `supabase/migrations/0006_*`.
  - `fetchWorkouts()` lists **all** of the coach's workouts for the cell picker.
  - Cells for weeks beyond `weeks` stay in `days` after you reduce the week count, and `save()` still inserts them. Fix this as part of Phase 1.
- `src/components/GenerateProgramModal.jsx` fills one week. It **calls `save_workout` immediately for every generated day**, so workouts land in the library before the program is saved, and cancelled or repeated runs leave orphans. It contains `weightedPick` (weighted random picks with no repeats: minimum weight 0.02, and 0.12× weight for anything already picked in the same run). Reuse that function.
- DB: `workouts(id, coach_id, name, share_token, is_ai_generated, created_at, updated_at)`.
  - `program_days` has `UNIQUE(program_id, week_number, day_of_week)`, `day_of_week` 0–6 and `day_type` in `training|rest|recovery|competition`.
  - FKs: `program_days.workout_id → workouts ON DELETE SET NULL`, **`workout_feedback.workout_id → workouts ON DELETE CASCADE`**, `workout_assignments.workout_id → workouts ON DELETE CASCADE`.
- RPCs (all `SECURITY INVOKER`, `set search_path to ''`, check `auth.uid()`):
  - `save_workout(p_workout_id, p_name, p_is_ai_generated, p_exercises jsonb, p_prehab jsonb)`. Items are `{exercise_id, position, sets, reps, duration_seconds, rest_seconds}`, and `''` means null for reps/duration.
  - `duplicate_workout(p_workout_id)` copies only `coach_id, name || ' (copy)', is_ai_generated=false` plus exercises and prehab.
- Helper `public.workout_owned_by_coach(workout_id, coach_id)` is `SECURITY DEFINER`. It exists to avoid RLS recursion between `workouts` and `program_days`/`workout_assignments` (see migration 0006).
- `useWorkoutPreview(workoutId)` / `WorkoutPreviewPanel` fetch a workout by id. Draft workouts have no id yet (see Phase 1).
- Exercise fields: `default_sets, default_reps, default_duration_seconds, default_rest_seconds, muscle_group ∈ {Arms, Back, Legs, Core, Shoulders}, category ∈ {strength, prehab}`.

## Data model changes (Phase 1)

New migration `supabase/migrations/0007_program_generated_workouts.sql`. Apply it live with Supabase `apply_migration` **and** commit the file, as with every previous migration.

```sql
alter table public.workouts
  add column program_generated boolean not null default false,
  add column source_program_id uuid references public.programs(id) on delete set null;

create index workouts_source_program_id_idx
  on public.workouts (source_program_id) where source_program_id is not null;
```

Why two columns instead of just `source_program_id`:
- If a program is deleted, a generated workout that an athlete already **completed** must survive, because deleting it would cascade-delete their `workout_feedback` history. That workout keeps `program_generated = true` (still hidden from the workout list, still shown in History) while `source_program_id` becomes null.
- `duplicate_workout` doesn't copy either column, so a duplicate automatically becomes a normal hand-built workout. That gives you "Save to library" for free.

### `save_program` RPC (Phase 1)

A single transaction replaces `ProgramBuilder.save()`. Use `SECURITY INVOKER` and `set search_path to ''`, and keep the conventions of `save_workout`.

```
save_program(
  p_program_id  uuid,     -- null = create
  p_name        text,
  p_description text,
  p_weeks       int,      -- 1..12
  p_workouts    jsonb,    -- new/changed program-generated workouts (see below)
  p_days        jsonb     -- the full schedule
) returns uuid           -- program id
```

- `p_workouts` items: `{ ref: text, id: uuid|null, name: text, exercises: [...], prehab: [...] }`.
  - `id = null` creates a workout: `coach_id = auth.uid()`, `program_generated = true`, `source_program_id = <program id>`.
  - A non-null `id` means an existing generated workout the draft changed. Update it the way `save_workout` does, but only if `coach_id = auth.uid() and source_program_id = <program id>`.
  - Exercise items use the same shape as `save_workout`.
- `p_days` items: `{ week: int, day: int, day_type: text, workout_id: uuid|null, workout_ref: text|null, notes: text|null }`. `workout_ref` points at a `p_workouts[].ref` created in this call.
- Steps, in order:
  1. Authenticate. Validate the name, `p_weeks` between 1 and 12, every `week` ≤ `p_weeks`, `day` between 0 and 6, a valid `day_type`, and no duplicate `(week, day)`. Cap sizes (≤ 84 days, ≤ 84 workouts, ≤ 20 exercises each) and raise a clear message on violation.
  2. Insert the program, or update it where `coach_id = auth.uid()` (raise if not found).
  3. Insert or update the `p_workouts`, building a map from `ref` to the new uuid.
  4. Resolve each day's workout (`workout_ref` through the map, else `workout_id`). Every existing `workout_id` must pass `public.workout_owned_by_coach(id, auth.uid())`; the RLS policy enforces this too, but raise a readable error first.
  5. `delete from program_days where program_id = …`, then insert all the days.
  6. **Orphan cleanup:** delete workouts where `source_program_id = <program>`, not referenced by any of this program's `program_days`, **and** with no `workout_feedback` and no `workout_assignments` rows.
  7. Return the program id.
- Grants: `revoke execute … from public, anon; grant execute … to authenticated;`

### `delete_program` RPC (Phase 1)

`delete_program(p_program_id uuid)`, also `SECURITY INVOKER`. It deletes this program's generated workouts that have no feedback or assignments, then deletes the program (its `program_days` cascade). Generated workouts that do have feedback survive with `source_program_id` set to null. Switch `Programs.jsx → deleteProgram` to this RPC and show its error.

**Migration 0009** (a follow-up after Phase 1) did two things:
- It dropped an older, unused `save_program(…, p_duration_weeks, p_days)` overload.
- It made both RPCs lock the program's generated workouts `FOR UPDATE` in their own statement before the cleanup delete, so an athlete completion committed at the same moment can't be cascade-deleted.

Keep that lock if you change either RPC.

### RLS

The existing policies already cover the new columns: coaches manage their own workouts, and athletes see workouts scheduled in their active program via `program_days`. **Don't add policies on `workouts` that query `program_days`/`workout_assignments` inline, or the reverse.** That exact cycle caused `42P17 infinite recursion` (migration 0006). Use a `SECURITY DEFINER` helper if a new cross-table check is ever needed.

## Client architecture

### Draft model (in `ProgramBuilder`)

```js
days:          { 'w1d0': { day_type, workout_id: uuid|null, workout_ref: string|null, notes } }
draftWorkouts: { [ref]: { ref, id: uuid|null, name, focus, exercises: [...], prehab: [...] } }
history:       [{ days, draftWorkouts, label }]   // undo stack, cap 10
```

- A cell points at a saved workout (`workout_id`) or a draft one (`workout_ref`), never both.
- Cell names come from `savedWorkouts ∪ draftWorkouts`. Add a small "Generated" tag on generated cells, as in the mockup.
- Every tool action pushes a snapshot first. A banner reads "Generated draft, not saved yet · N program workouts are created when you save", with **Undo**.
- On save, send `days` pruned to `week ≤ weeks`, plus only the `draftWorkouts` that the remaining cells reference. Keep the draft and show the RPC's error on failure; navigate only on success.
- `WorkoutPreviewPanel`: add an optional `draftWorkout` prop that renders `{ name, exercises, prehab }` directly (joining the exercise rows already loaded for generation), so previewing an unsaved workout needs no fetch. Keep the "Edit workout" button hidden for drafts.

### Pure logic module: `src/lib/programGenerator.js` (new)

Keep it free of React and Supabase so it's easy to reason about.

- `weightedPick(pool, weightFor, n, usedIds)`: moved unchanged from `GenerateProgramModal.jsx`.
- `FOCUS_PRESETS`: per-muscle weights.
  - `Upper {Arms 65, Back 80, Legs 5, Core 25, Shoulders 70}`
  - `Lower {Arms 5, Back 15, Legs 90, Core 55, Shoulders 5}`
  - `Push {Arms 55, Back 5, Legs 5, Core 20, Shoulders 85}`
  - `Pull {Arms 60, Back 90, Legs 5, Core 20, Shoulders 25}`
  - `Legs {Arms 0, Back 10, Legs 95, Core 45, Shoulders 0}`
  - `Full body` (all 50)
  - Single-group presets for the body-part split (for example `Back {Back 95, Arms 40, Core 20, Legs 5, Shoulders 20}`)
  - These are the values used in the mockup.
- `SPLITS`:
  - `full ['Full body']`
  - `ul ['Upper','Lower']`
  - `ppl ['Push','Pull','Legs']`
  - `bp ['Legs','Back','Shoulders','Arms','Core']`
  - `custom ['Custom']`
  - The k-th selected training day gets `seq[k % seq.length]`.
- `generateWorkout({ focusWeights, count, includePrehab, pool, usedIds, name })` returns a draft workout. It mirrors today's modal: strength picks, then up to 2 prehab picks.
- `generateProgram(config, pool)` returns `{ days, draftWorkouts }`. `config` fields:
  - `weeks`, `trainingDays: bool[7]`, `offDays: 'rest'|'recovery'`, `dayFocus: { [dayIdx]: weights }`, `count`, `includePrehab`
  - `variation: 'repeat'|'rotate'|'fresh'`, `rotateEvery`
  - `progression: null|'sets'|'reps'`, `deloadEvery: null|int`
  - `locked: Set<key>` and a `previous` result, so rerolls keep locked workouts
- `copyWeeks(state, { source, targets, mode: 'link'|'clone', conflict: 'replace'|'fill', copyDayTypes, copyNotes, progress })` returns new `{ days, draftWorkouts }`.
- `summarize(config)` returns the workout count shown in the setup footer.

**Which workouts get generated.** "Workout slot" means a training day of the week (Mon, Tue, …). A block is a run of `rotateEvery` weeks.

| variation | progression off | progression on |
|---|---|---|
| repeat | 1 workout per slot, linked in every week; deload weeks get one extra deload copy per slot | 1 exercise selection per slot; **one clone per week** with adjusted sets/reps |
| rotate every N | 1 workout per slot per block; plus deload copies | new exercise selection per block; one clone per week |
| fresh | new selection per slot per week | same, with dosage progressed |

With progression on, every week must be its own workout, because sets and reps live on `workout_exercises`. Expect `training days × weeks` workouts; the mockup shows 32 for 4 × 8.

**Dosage.** Let `i` be the week's 0-based index within its block and `base` the exercise's default.
- `sets` mode: `min(base + i, 6)`.
- `reps` mode: `base + 2i`. Only apply it when `default_reps` is set; timed exercises keep their duration.
- Deload week (when `deloadEvery` divides the week number): sets = `max(1, round(base × 0.6))`, with reps unchanged.

**Names** are what athletes see in the portal:
- `"{Program} · {Focus} {n}"` when one workout is shared across weeks.
- Add ` · B{block}` for rotation without progression.
- Add ` · W{week}` for per-week clones.
- Truncate to 160 characters.

**Exercise pool:** `supabase.from('exercises').select('*')`, as the modal does today (RLS limits custom exercises to the coach's own). Load it once per tools session.

### Components

| File | Change |
|---|---|
| `src/components/ProgramToolsSheet.jsx` | New. A bottom sheet on mobile and a small modal on desktop with the three entries (mockup screen "Program tools"). Replaces the 🔀 Generate button in the `ProgramBuilder` header. |
| `src/components/FullProgramModal.jsx` | New. A three-step flow inside one modal (full screen on mobile): **Setup** → **Day focus** (sub-view from "Edit") → **Preview**. The preview is a weeks × days grid grouped by block. Tap a cell for its exercise list; "Reroll this workout" / "Reroll block" / "Reroll all"; "Lock" keeps a workout's exercises during rerolls. Rerolling a shared workout changes it in every week of its block, so say so in the detail text. **Apply to draft** calls back to `ProgramBuilder`, which snapshots and then replaces the whole draft. |
| `src/components/GenerateProgramModal.jsx` | Rework into **Fill a week**: draft-first (no `save_workout` calls), per-day focus using the same Day focus UI as the full flow (factor out a `DayFocusEditor` component), undoable. |
| `src/components/CopyWeeksModal.jsx` | New. The mockup's "Copy weeks" screen, described below. |
| `src/pages/ProgramBuilder.jsx` | Draft model, undo banner, "Copy this week to…" shortcut under the mobile week bar, generated tags, `save_program`, pruning weeks, the cell picker filter (below), and a `draftWorkout` preview. |
| `src/pages/Dashboard.jsx` | Workout list query: add `.eq('program_generated', false)`. Add a collapsed **Program workouts** section (mockup's Library screen) that groups generated workouts by `source_program_id → programs(name, duration_weeks)` with an **Open** link to `/programs/:id`. List workouts with a null source under "Kept for athlete history". |
| `src/pages/Programs.jsx` | Delete through the `delete_program` RPC, surfacing errors. |
| `src/components/WorkoutPreviewPanel.jsx`, `src/lib/useWorkoutPreview.js` | `draftWorkout` prop. For a saved generated workout, add a **Save to library** action: call `duplicate_workout`, then rename to drop " (copy)" (or add an optional `p_name` to `duplicate_workout`). |

**Copy weeks behaviour:**
- Source week: single select. Weeks with no days are dimmed and can't be copied from.
- Targets: multi-select with shortcuts "All after W{n}", "Every other week" and "Clear". The source is disabled, and weeks that already have days are marked.
- **Link** makes target cells point at the same `workout_id`/`workout_ref`, creating no workouts.
- **Clone** creates new draft workouts. For saved source workouts, first fetch their `workout_exercises`/`workout_prehab` rows. "Progress the copies" applies the `sets` dosage rule with `i = target − source`.
- **Replace** overwrites a target's cells. **Only fill empty days** writes only missing cells. Show a warning naming the target weeks that already have days.
- "Rest, recovery and competition days" off means only training cells are copied. "Day notes" is a toggle.

**Cell picker:** `fetchWorkouts()` should return hand-built workouts plus this program's generated ones:
- New program: `.eq('program_generated', false)`
- Existing program: `.or(\`program_generated.eq.false,source_program_id.eq.${id}\`)`

**Unchanged on purpose:**
- `History.jsx` keeps showing all workouts, including generated ones: athletes complete program workouts and coaches need that feedback.
- The athlete portal already reads scheduled workouts through `program_days`.
- `AssignModal` only opens from Dashboard cards, which no longer include generated workouts.

## Phases

Ship each phase as its own PR into `main` (commit → push `feature/redesign` → PR → CI (Vercel) green → merge), the way this repo has been run.

1. **Foundation** (shipped in #13, with follow-ups in migration 0009)
   - Migration 0007, `save_program`, `delete_program`.
   - `ProgramBuilder` saves through the RPC with visible errors and prunes weeks.
   - Draft model, undo banner, draft preview.
   - Fill a week becomes draft-first with per-day focus.
   - Dashboard filter and Program workouts section, cell picker filter.
2. **Copy weeks:** `CopyWeeksModal`, `copyWeeks()`, and the "Copy this week to…" shortcut. Shipped in #14.
3. **Full program:** `programGenerator.generateProgram`, `ProgramToolsSheet`, `FullProgramModal` (setup, day focus, preview with reroll and lock). Shipped in #17.
4. **Polish:** Save to library, generated tags, desktop layout of the preview grid (7 columns × N weeks fits at 1280px), and the loading/empty state when the exercise pool is small. Done: Save to library (`duplicate_workout` gained an optional `p_name` in migration 0011), GEN tags (since Phase 1), the preview widening to 1040px on desktop with the detail panel beside the grid, and a shared notice for an empty library, a library too small for the chosen size, repeats across days, or no prehab.

## Acceptance criteria

Phase 1 was verified with rolled-back RLS probes (migrations 0007 and 0009) and a signed-in browser pass on the Vercel preview. Criteria that later phases extend are ticked for what exists now, with a note on what to recheck.

**Data safety**
- [x] Generating, rerolling, copying and cancelling create **zero** rows in `workouts` until Save. *Verified for Fill a week, reroll, Undo and cancel (Phase 1) and for Copy weeks in Link and Clone mode (Phase 2), and for the full program, including rerolls, Apply and Undo (Phase 3).*
- [x] A save that fails partway (for example an invalid day type injected in dev tools) leaves the program and its days exactly as they were, and the error shows in the builder. *Tested both ways: an invalid day type injected into React state in the browser, and a check violation after writes had started, in a probe.*
- [x] Rerolling and re-saving an existing program leaves no orphaned generated workouts (orphan cleanup step).
- [x] Deleting a program removes its generated workouts **except** ones with athlete feedback. Those stay hidden from Home and still appear in History.
- [x] Reducing weeks from 8 to 6 and saving removes the week 7–8 `program_days`.

**Visibility**
- [x] Home's workout list never shows `program_generated` workouts. The Program workouts section lists them grouped by program, with working Open links.
- [x] An athlete whose active program uses generated workouts sees them in `/athlete/program` and can complete them (feedback goes through `submit_athlete_workout_feedback`). *Needs migration 0008: before it, portal completions failed for every workout.*

**Behaviour**
- [x] Full program Upper/Lower, Mon/Tue/Thu/Fri, 8 weeks, rotate every 4, +1 set, deload every 4th week: the setup footer says 32 workouts, weeks 4 and 8 show the deload dosage, and weeks 1–3 show 3/4/5 sets. *Phase 3: the footer said 32; Monday ran 3/4/5/2 (deload) in both blocks; a Block B exercise with 4 default sets ran 4/5/6/2; after Save, 32 generated workouts across 56 days (8 recovery, 16 rest).*
- [x] A locked workout is unchanged by "Reroll block" and "Reroll all". *Phase 3: a locked Upper 1 kept all 6 exercises through both; an unlocked workout was re-picked, and "Reroll this workout" is disabled while locked.*
- [x] Copy weeks in Link mode followed by Save gives target weeks the same `workout_id`s as the source. Clone mode gives new ids, and the counts match the footer. *Phase 2: Link W1→W2–3 saved the same 10 ids. Clone W1→W4 gave 5 new ids, as the footer said, named "… · W4", with sets progressed 3 → 6.*
- [x] Undo restores the exact previous draft after each tool. *Verified for Fill a week (Phase 1), Copy weeks (Phase 2) and Generate full program (Phase 3, including the week count).*
- [x] Mobile: all new sheets clear the status bar (`--sat` padding pattern, as in #11), touch targets are ≥ 44px, and there's no horizontal scroll at 375px. *Verified for the Fill a week (Phase 1), Copy weeks (Phase 2), Program tools and Generate full program (Phase 3) sheets. On/off switches got 44px tap areas in Phase 3.*

**Checks**
- [x] `npm run build` passes.
- [x] Supabase security advisor shows no new `anon_*` findings for the new RPCs.
- [x] RLS verified by simulating a coach (`set local role authenticated; set local request.jwt.claim.sub = '<coach uuid>'` inside a `do` block via `apply_migration`, as done for migration 0006):
  - `save_program` works for the owner.
  - It raises for another coach's program or workout.
  - It does not trigger `42P17`.
- [x] Clean up any probe rows and tables afterwards.

## Open questions (decide during Phase 3; defaults in bold)

- Should reps progression apply to prehab items? **No, prehab keeps its defaults.**
- Should the full program keep existing hand-picked (non-generated) cells? **No, it replaces the whole draft (undoable).** A later option could add "only fill empty days".
- Should "Fill a week" on a program that already has progression continue that progression? **No, it's a one-off.**
