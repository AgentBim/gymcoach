# ChalkUp application audit

Audit date: 2026-08-12  
Scope: production deployment, authenticated test account, public GitHub source at commit `81a18c6`, Vercel project metadata/runtime errors, responsive behavior, accessibility semantics, dependency lockfile, and client-side Supabase usage.

## Executive summary

ChalkUp's main information architecture is coherent, its protected routes work, its empty states are useful, and the tested desktop/mobile routes produced no console errors. The largest immediate problem is that the advertised AI workout generator is nonfunctional in production. The largest reliability risk is non-transactional workout saving, which can destroy the contents of an existing workout when a later insert fails.

No critical vulnerability was confirmed. Two high-priority defects, five medium-priority issues, and four lower-priority improvements were confirmed. Database RLS policies and Supabase Security Advisor results were not available in the repository or connected tooling, so cross-account isolation remains an important unverified control rather than a confirmed vulnerability.

## High priority

### APP-001 — AI workout generation is broken in production

- Rule ID: REACT-NET-001 / functional reliability
- Severity: High
- Location: `src/components/AIGeneratorModal.jsx`, `generate()`, lines 90–104
- Evidence: the browser calls `https://api.anthropic.com/v1/messages` directly with only `Content-Type`; there is no authentication header or server proxy. An authenticated production test reached “Something went wrong. Please try again.”
- Impact: a prominent paid-looking feature cannot complete. Adding a secret API key to this browser request would expose it to every visitor.
- Fix: move generation to a Vercel Function or Supabase Edge Function, store the provider credential server-side, validate the caller, apply per-user rate limits, validate provider output against a strict schema, and return a normalized response.
- Mitigation: hide or label the feature unavailable until the backend endpoint is deployed.
- False-positive notes: none; the failure was reproduced in production.

### APP-002 — Editing a workout can erase its exercises on partial failure

- Rule ID: data integrity / atomic writes
- Severity: High
- Location: `src/pages/WorkoutBuilder.jsx`, `save()`, lines 294–326
- Evidence: edit mode updates the workout, deletes `workout_exercises` and `workout_prehab`, and then performs replacement inserts as separate requests. Insert errors are ignored.
- Impact: a transient network, validation, permission, or database error after deletion can leave a saved workout empty or partially populated while the UI may proceed as if saving succeeded.
- Fix: perform the entire save in one database transaction through a Postgres RPC or authenticated server/edge function. Validate all rows before deleting existing children and return one explicit success/error result.
- Mitigation: check every response and stop navigation on failure, but this does not provide atomicity.
- False-positive notes: database triggers could reduce the impact, but no transaction-capable API is invoked by this client code.

## Medium priority

### SEC-001 — Essential browser security headers are missing

- Rule ID: REACT-HEADERS-001 / REACT-CSP-001
- Severity: Medium
- Location: `vercel.json`, lines 1–3; production response headers
- Evidence: `vercel.json` only defines the SPA rewrite. The production response includes HSTS but not CSP, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, or `Permissions-Policy`.
- Impact: avoidable exposure to clickjacking, MIME confusion, referrer leakage, and a larger blast radius if an XSS defect is later introduced.
- Fix: add Vercel response headers, beginning with a realistic report-only CSP and then enforcing it. Include `nosniff`, `frame-ancestors 'none'` unless embedding is required, a suitable referrer policy, and a minimal permissions policy.
- Mitigation: React's default text escaping helps prevent many XSS paths but is not a substitute for headers.
- False-positive notes: runtime headers were inspected directly, so this is not merely absent repository configuration.

### REL-001 — Database errors are routinely suppressed

- Rule ID: reliability / observable failures
- Severity: Medium
- Location: `src/pages/Dashboard.jsx` lines 38–71; `src/pages/AthleteView.jsx` lines 140–154; similar patterns across forms, assignments, programs, roster, and history
- Evidence: reads frequently destructure only `data`; mutations often await Supabase and immediately update local UI without checking `error`. Feedback submission sets `done` even if insertion fails.
- Impact: users can see false success, stale lists, missing records, or silent data loss. Operational telemetry also misses useful failure context.
- Fix: centralize Supabase result handling, surface user-safe errors, keep forms recoverable, and log structured failures to monitoring without sensitive data.
- Mitigation: refetch after mutations and show a retry action.
- False-positive notes: Supabase returns errors as values for these methods; ignoring them is observable behavior.

### SEC-002 — Public feedback endpoint is vulnerable to link-based spam and replay

- Rule ID: authorization/abuse resistance
- Severity: Medium
- Location: `src/pages/AthleteView.jsx`, lines 140–151 and 241–260
- Evidence: possession of `/share/:token` permits anonymous workout reads and feedback insertion. The client has no one-time assignment proof, duplicate prevention, challenge, or rate limit.
- Impact: anyone who receives or discovers a valid shared link can submit repeated or impersonated athlete feedback and pollute coach history.
- Fix: make feedback submission an RPC/Edge Function that validates the share token, applies per-token/IP rate limits, enforces a submission policy, and records an assignment-scoped nonce or idempotency key.
- Mitigation: allow coaches to rotate/revoke share tokens and flag/delete suspicious responses.
- False-positive notes: database policies or gateway rate limiting may exist outside the repo; verify them before final severity acceptance.

### A11Y-001 — Login controls lack programmatic labels and tab semantics

- Rule ID: WCAG form labels/name-role-value
- Severity: Medium
- Location: `src/pages/Login.jsx`, lines 47–71
- Evidence: `<label>` elements have no `htmlFor`, inputs have no `id`, and the login/signup selector is presented as ordinary buttons rather than a tablist with selected state. Production inspection also found no page heading or `main` landmark on login.
- Impact: screen-reader users receive weaker context, and keyboard/assistive technology users cannot reliably identify the active authentication mode.
- Fix: associate labels and inputs, add an `h1` and `main`, implement correct tabs or use two clearly labelled mode buttons with `aria-pressed`, and set selector buttons to `type="button"`.
- Mitigation: placeholders provide some accessible naming in current browsers, but they disappear when users type and are not a label replacement.
- False-positive notes: confirmed from the production accessibility tree.

### AUTH-001 — Account recovery is missing

- Rule ID: product/auth resilience
- Severity: Medium
- Location: `src/pages/Login.jsx` and `src/hooks/useAuth.jsx`
- Evidence: the only auth actions are signup, password sign-in, and sign-out. There is no forgotten-password request or recovery callback route.
- Impact: users who forget a password cannot self-recover and may abandon the product or require manual support.
- Fix: add Supabase `resetPasswordForEmail`, a recovery redirect route, password update form, clear success states, and rate-limit-aware messaging.
- Mitigation: document a support recovery path until self-service is available.
- False-positive notes: no alternative recovery surface was found in routes or production UI.

### DEP-001 — The committed dependency tree contains known advisories

- Rule ID: REACT-SUPPLY-001
- Severity: Medium
- Location: `package.json` lines 10–18 and `package-lock.json`
- Evidence: `npm audit --package-lock-only` reported 9 advisories: 4 high, 4 moderate, and 1 low. They include old Vite/build-chain packages and React Router advisories. Several are development-only or require code patterns not currently present.
- Impact: developer environments and future routing changes carry avoidable risk; stale dependencies also increase upgrade difficulty.
- Fix: upgrade React Router to a patched release, upgrade Vite/build dependencies deliberately, run the build and route regression suite, and enable automated dependency review.
- Mitigation: never expose the Vite development server publicly.
- False-positive notes: severity here is reduced because several advisories do not affect the static production bundle's current code paths.

## Low priority and product improvements

### UX-001 — Mobile dashboard renders duplicate filter controls

- Severity: Low
- Location: `src/pages/Dashboard.jsx`, lines 115–150
- Evidence: the expandable mobile filter exists, but the desktop-style search and chips at lines 148–150 render unconditionally. Production at 390×844 displayed the second search/filter row even with the mobile search panel closed.
- Fix: wrap the general filter row in `!isMobile`, or use one shared responsive filter component.

### PERF-001 — Large exercise collections render eagerly

- Severity: Low
- Location: `src/pages/Library.jsx` and `src/pages/WorkoutBuilder.jsx`
- Evidence: the authenticated library reports 280 exercises and renders 200 cards for the default filter; the builder emits a very large list of repeated controls with no pagination or virtualization.
- Impact: slower rendering and poorer keyboard/screen-reader navigation as the catalog grows.
- Fix: paginate or virtualize the list, debounce search, and preserve focus when filters change.

### TEST-001 — No automated quality gates are configured

- Severity: Low
- Location: `package.json`, lines 5–9
- Evidence: scripts contain only `dev`, `build`, and `preview`; no lint, type-check, unit, accessibility, or end-to-end test command is present.
- Fix: add ESLint, component tests for save/error states, and Playwright tests for auth, workout CRUD, public sharing, feedback, and responsive navigation.

### OBS-001 — Production visibility is minimal

- Severity: Low
- Evidence: Vercel reported no runtime errors in the previous seven days, but this is a client-heavy Vite app and the tested AI failure produced no console error or server-side trace.
- Fix: add client error reporting, structured edge-function logs, correlation IDs, and success/failure metrics for save and AI-generation operations.

## Positive findings

- Protected routes redirected unauthenticated visitors to login.
- The authenticated dashboard, roster, programs, history, library, and workout builder loaded without console errors.
- The principal authenticated pages use `main`, navigation landmarks, and useful level-one headings; empty states include clear next actions.
- The 390×844 layout had no horizontal overflow in the tested dashboard state.
- React rendering uses normal JSX for user-visible data; no `dangerouslySetInnerHTML`, `eval`, string event handlers, or unsafe `postMessage` path was found.
- The Supabase client uses a browser-appropriate public key variable rather than a service-role credential in source.
- Vercel serves HTTPS with HSTS, and the production deployment is currently ready.

## Unverified controls and follow-up

1. Export and review all Supabase RLS policies and run Supabase Security Advisor. Every exposed table should have RLS, ownership predicates, appropriate `WITH CHECK` clauses, and tightly scoped anonymous policies for sharing/feedback.
2. Test cross-account isolation with a second test coach: attempt reads and mutations against known workout, athlete, assignment, program, and feedback IDs from the first account.
3. Verify share tokens are cryptographically random, unique, revocable, and never logged in analytics/referrers.
4. Inspect Supabase Auth settings for leaked-password protection, JWT expiry, email rate limits, CAPTCHA/bot protection, and custom SMTP readiness.
5. Add an end-to-end save failure test that proves existing workout rows survive an injected child-insert failure.

## Recommended order of work

1. Replace the client-side Anthropic call with an authenticated server function and restore or hide AI generation.
2. Make workout saves transactional.
3. Add centralized Supabase error handling and monitoring.
4. Review RLS and public share/feedback abuse controls.
5. Add security headers and account recovery.
6. Repair accessibility semantics, responsive filter duplication, tests, and dependency posture.
