# ChalkUp application re-audit

Date: 2026-08-13  
Scope: production SPA, authenticated non-AI flows, source, Vercel deployment state, and Supabase database/security posture. AI-generated workouts were explicitly excluded.

## Executive summary

The earlier security remediation is holding: all public tables have RLS enabled, anonymous direct table access is revoked, coach ownership policies are present, leaked-password protection is enabled, the application security headers are deployed, the production app loads without browser console errors, and the current source passes lint/build with no errors. The remaining work is primarily data integrity, public-link abuse resistance, accessibility, test automation, and release reproducibility.

Overall status: **B / suitable for controlled beta, not yet production-mature for broad public use**.

## Resolution update — 2026-08-13

Findings APP-001, APP-002, DB-001, DB-002, and APP-003 were addressed in the
assignment_tokens_and_atomic_writes release. Program saves and workout
duplication are transactional; duplication includes prehab; migrations now
match production history; sharing uses revocable, expiring, athlete-specific
assignment tokens; and the release is committed and deployed from source.

## Prioritized findings

### APP-001 — Program edits are destructive and non-transactional

- Severity: High
- Location: `src/pages/ProgramBuilder.jsx:72-99`
- Evidence: editing updates the program, deletes every `program_days` row, then inserts replacements in separate unchecked requests. The UI navigates away even when update, delete, or insert fails.
- Impact: a transient network, validation, or permission error after line 79 can permanently erase a coach's schedule or leave a partially saved program.
- Fix: create an authenticated `save_program_transaction` RPC that validates ownership and replaces the program and days in one database transaction; return and surface errors before navigation.
- Mitigation: until then, check every response and insert new rows before removing old rows where possible.

### APP-002 — Production is not reproducible from the repository

- Severity: High
- Location: working tree / Vercel deployment metadata
- Evidence: production was deployed from a dirty local tree while the repository remains on commit `81a18c6`; the deployed security changes, password reset route, migrations, and audit configuration are uncommitted.
- Impact: another developer, CI, or rollback cannot reliably recreate the running application. A Git-based deployment could overwrite the hardened production build with older code.
- Fix: review and commit the current changes, push a protected branch, deploy from the commit, and require CI checks before production promotion.
- Mitigation: retain the current deployment as a rollback candidate until the committed equivalent is verified.

### DB-001 — Local and production migration histories have drifted

- Severity: High
- Location: `supabase/migrations/20260812000000_save_workout_transaction.sql`, `20260813040000_harden_public_workout_access.sql`, `20260813043000_restore_service_role_access.sql`, `20260813050000_private_by_default.sql`
- Evidence: production records the same migrations as versions `20260813025538`, `20260813041501`, `20260813041733`, and `20260813044634`. Local filenames use different version identifiers.
- Impact: a future `supabase db push` can treat the local files as unapplied and attempt to run them again. Several statements add named constraints and are not safely repeatable, so deployment may fail or produce history divergence.
- Fix: reconcile local filenames/history with the production migration versions before the next schema deployment, then verify with `supabase migration list --local` and remote comparison.
- Mitigation: do not run automated migration pushes from this tree until reconciliation is complete.

### DB-002 — Shared feedback identity and abuse controls are weak

- Severity: Medium
- Location: `src/components/AssignModal.jsx:45-69`; `supabase/migrations/20260813040000_harden_public_workout_access.sql:218-277`
- Evidence: every athlete assigned a workout receives the same permanent workout token. The anonymous RPC accepts a caller-supplied athlete name and limits only the whole token to 30 submissions/hour.
- Impact: anyone possessing a link can impersonate an athlete, submit duplicate/misleading feedback, or exhaust the quota for all legitimate athletes. Removing an assignment does not revoke that athlete's copied link.
- Fix: issue an assignment-specific, revocable, expiring token; bind feedback to the assignment; enforce one active/completed response policy as appropriate; rate-limit at an Edge Function/API layer using token plus network/device signals.
- Mitigation: add token rotation/revocation and flag duplicate or suspicious feedback to coaches.
- False-positive note: this is an integrity/abuse issue, not evidence that private coach tables are directly readable.

### APP-003 — Workout duplication omits prehab

- Severity: Medium
- Location: `src/pages/Dashboard.jsx:58-80`
- Evidence: duplication copies only `workout_exercises`; it never reads or inserts `workout_prehab`.
- Impact: the duplicate looks successful but silently loses part of the prescribed workout.
- Fix: implement a transactional duplicate RPC that copies workout metadata, strength exercises, and prehab together.

### APP-004 — Feedback history misattributes responses

- Severity: Medium
- Location: `src/pages/History.jsx:55-80`
- Evidence: the query omits `workout_feedback.athlete_name`, then attaches the complete assigned-athlete list to every feedback item.
- Impact: coaches cannot reliably tell who submitted a response; with multiple assignees, the UI can imply that any or all assigned athletes authored it.
- Fix: after assignment-specific feedback exists, query and display the authoritative assignment/athlete relation. In the interim, include the submitted name and label it as self-reported.

### A11Y-001 — Form controls lack accessible names

- Severity: Medium
- Location: examples include `src/pages/Dashboard.jsx:126,158`, `src/pages/Roster.jsx:97,117`, `src/pages/Library.jsx:131,161`, `src/pages/WorkoutBuilder.jsx:666,722,849,922`, `src/pages/AthleteForm.jsx:63-82`, and `src/pages/CustomExercise.jsx:108-171`
- Evidence: live inspection found search and workout-name inputs with neither associated `<label>` elements nor `aria-label`; several forms use visual text rather than associated labels.
- Impact: screen-reader users cannot identify controls consistently, and placeholder-only labeling disappears after input.
- Fix: add persistent `<label htmlFor>`/`id` pairs, field descriptions, and accessible names for icon-only actions. Add automated axe checks to route-level browser tests.

### QA-001 — No automated regression suite or CI gate

- Severity: Medium
- Location: `package.json`; `supabase/tests/security_regression.sql`
- Evidence: the project has build/lint scripts but no `test` script or CI workflow. The SQL security assertions exist but are manual. Lint currently reports 25 warnings, chiefly missing hook dependencies.
- Impact: authentication, RLS, public sharing, password recovery, and destructive save regressions can ship without detection.
- Fix: add unit/component tests, Playwright end-to-end coverage, run the database regression suite against an isolated branch, and require `npm ci`, lint, build, audit, and tests in CI.

### PERF-001 — Initial JavaScript bundle is oversized

- Severity: Low
- Location: production build output / route architecture
- Evidence: Vite emits one 533.26 kB minified bundle (137.50 kB gzip) and warns above its 500 kB threshold.
- Impact: slower first interaction on mobile or weak networks; every route downloads code it may not use.
- Fix: lazy-load page routes and heavy modals, then set and track a bundle budget.

### DB-003 — Intentional public SECURITY DEFINER endpoints remain a sensitive boundary

- Severity: Low (design warning)
- Location: `supabase/migrations/20260813040000_harden_public_workout_access.sql:151-297`
- Evidence: Supabase's security advisor reports four warnings because `get_shared_workout` and `submit_workout_feedback` are executable by anonymous and authenticated roles and bypass RLS. This exposure is intentional and the functions validate/share a narrow output, use a fixed search path, and have explicit grants.
- Impact: future edits to either function could accidentally widen public data access because RLS is bypassed.
- Fix: preferably put privileged implementation in a private schema behind a tightly reviewed API/Edge Function. At minimum, retain explicit output shaping, fixed `search_path`, revoked default execution, regression tests, and advisor review for every change.
- Remediation references: [anonymous SECURITY DEFINER warning](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated SECURITY DEFINER warning](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Verified controls

- All public tables inspected have RLS enabled.
- Coach-facing policies restrict rows with `auth.uid()` ownership predicates; update policies include ownership checks.
- Anonymous direct table grants are absent; public access is limited to the two deliberate sharing RPCs.
- Public share RPC input validation, field-length bounds, rating/RPE bounds, and a basic hourly submission cap are present.
- Security advisor has no leaked-password warning; the remaining four warnings correspond to the intentional public RPC boundary.
- Performance advisor reports only unused-index information and the Auth absolute-connection allocation notice; no missing-FK-index or RLS-init-plan regressions were reported.
- Production CSP, anti-framing, MIME sniffing, referrer, and permissions headers are configured in `vercel.json`.
- Authenticated production routes `/dashboard`, `/roster`, `/programs`, `/history`, `/library`, and `/workout/new` loaded without captured console errors.
- `npm run check` passed: 0 lint errors, 25 warnings; production build succeeded.
- No `dangerouslySetInnerHTML`, raw `innerHTML`, `eval`, `new Function`, unsafe `postMessage`, or browser token-storage pattern was found in application source.

## Recommended order of work

1. Commit and reconcile the production code and migration history.
2. Make program saving and workout duplication transactional and complete.
3. Replace workout-wide links with assignment-specific, revocable feedback identity.
4. Add CI plus automated auth/RLS/share/save browser tests.
5. Complete accessibility labeling and keyboard/focus testing.
6. Add route-level code splitting and observability/error reporting.

## Audit limitations

- AI-generated workout behavior and its Anthropic integration were excluded by request.
- The audit did not submit destructive forms, create records, alter Supabase, or change production.
- Dependency audit could not be refreshed because the npm registry audit endpoint was unavailable in this sandbox; the previous completed audit reported zero known vulnerabilities. The lockfile is present.
