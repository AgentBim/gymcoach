# ChalkUP Visual Redesign Handoff

## Purpose and authority

This is the authoritative handoff for adopting the visual direction in
`C:\Users\jahb2\Downloads\chalkup-redesign.html` without replacing working product
behavior or reintroducing removed AI functionality. The downloaded files remain
unchanged as source material.

When the artifacts disagree, use this order:

1. Current application code and database migrations define real behavior.
2. This handoff defines the safe redesign scope.
3. `REDESIGN_TASKS.md` defines the implementation sequence.
4. The downloaded HTML defines visual intent, not product or data contracts.
5. The downloaded `HANDOFF.md` is historical context only.

ChalkUP is a Vite/React application backed by Supabase and deployed on Vercel.
Apply the redesign to its existing routes, components, queries, RPC calls,
authorization boundaries, and loading/error states.

AI generation is intentionally removed. Do not add an AI provider, browser-side
API credentials, AI-labelled actions, or placeholder AI responses in this work.

## Visual language

```css
--ink: #15191a;
--surface: #1e2426;
--surface-2: #262d30;
--surface-3: #313a3d;
--border: #38424a;
--border-soft: #2a3234;
--chalk: #eceee9;
--chalk-dim: #9aa6a2;
--chalk-faint: #66716d;
--accent: #c7e45c;
--accent-strong: #a9c947;
--accent-ink: #171c0e;
--blue: #6ba9de;
--amber: #e7a23e;
--coral: #e2695a;
--teal: #4fb88a;
--violet: #a184e3;
```

- Display headings: Big Shoulders Display.
- Body and controls: IBM Plex Sans.
- Metrics, labels, and technical values: IBM Plex Mono.
- Icons: use a consistent local SVG system derived from the mockup. Icons must
  remain accessible and must not be the sole carrier of meaning.
- Preserve responsive behavior, keyboard access, visible focus, and contrast.
- Preserve real loading, empty, error, disabled, and success states.
- Never hard-code the mockup's people, workouts, metrics, or feedback.
- Call the existing local workout feature `Random` or `Randomizer`, never AI.

## Screen reconciliation

| Area | Current reality | Visual-pass scope | Deferred product work |
| --- | --- | --- | --- |
| Authentication | Auth flow exists | Restyle its real form and states | New auth methods or policy changes |
| Dashboard | Dashboard and real data exist | Restyle shell, cards, hierarchy, and responsive layout | New aggregate/unread data |
| Roster | Roster exists | Restyle real cards and states | New athlete data model |
| Athlete profile | `/roster/:id` and profile exist | Restyle profile, assignments, and available feedback | Coach notes require schema/RLS decisions |
| Workout editor | Manual, Random, and Prehab exist | Visually unify all modes and preserve state transitions | AI and server-backed prehab enforcement |
| Assign/share | Flow exists; assigned athletes are protected | Restyle modal and statuses | New sharing or authorization semantics |
| Athlete shared view | `/share/:token`, completion, and feedback exist | Restyle the real flow | Hard prehab lock without specified persistence |
| Programs | Create/save and name validation exist | Restyle builder and validation | New persistence rules or unsaved-change system |
| Exercise library | Library and custom form exist | Restyle search, filters, cards, and form | New taxonomy or persisted view preference |
| History | Filters, expanded entries, feedback, and emoji filter exist | Restyle existing data and controls | Details the database does not store |
| Empty states | Several exist | Standardize tone, icons, and calls to action | Fake examples presented as user data |

## Boundaries

The visual pass may change tokens, typography, spacing, borders, responsive
layout, reusable visual primitives, presentational structure, non-contractual
copy, and state presentation.

It must not silently change Supabase tables, migrations, RPC signatures, RLS,
authentication, route paths, share-token behavior, ownership checks, stored data
shapes, completion/feedback persistence, Vercel configuration, or environment
variables.

Keep these as separately scoped product work:

- Coach-authored athlete notes and their visibility/retention rules.
- Dashboard aggregates or unread indicators absent from current queries.
- Persisted per-exercise completion.
- Server-enforced prehab gating.
- Rate limiting and bot protection for public feedback endpoints.
- Future AI workflows, including provider, consent, cost, safety, server-side
  secrets, validation, limits, and fallback behavior.

## Definition of done

- Changed screens render real data and preserve current behavior.
- Existing routes, Supabase calls, validation, and authorization still work.
- No AI integration or exposed provider credential is present.
- Desktop and mobile layouts are visually checked.
- Keyboard navigation, focus, labels, contrast, and reduced motion are checked.
- Lint, build, and tests pass at the repository's existing baseline.
- The release diff includes no unrelated work, secrets, deployment, or production
  mutation.
