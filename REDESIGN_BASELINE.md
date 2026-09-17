# ChalkUP Redesign Baseline

## Reference viewports

- Desktop: 1440px wide.
- Compact desktop: 940px wide.
- Tablet: 768px wide.
- Mobile: 375px wide, with safe-area insets respected.

## Existing-to-redesign token mapping

| Existing alias | Redesign role | New token |
| --- | --- | --- |
| `--bg` | Ground | `--ink` (`#15191a`) |
| `--s1` | Primary surface | `--surface` (`#1e2426`) |
| `--s2` | Raised/input surface | `--surface-2` (`#262d30`) |
| `--br` | Subtle border | `--border-soft` (`#2a3234`) |
| `--br2` | Strong border | `--border` (`#38424a`) |
| `--tx` | Primary text | `--chalk` (`#eceee9`) |
| `--mu` | Secondary text | `--chalk-dim` (`#aeb8b4`) |
| `--ac` | Primary accent | `--accent` (`#c7e45c`) |
| `--ac2` | Accent hover/active | `--accent-strong` (`#a9c947`) |

Compatibility aliases remain temporarily so screens can migrate incrementally.

Semantic colors use lime for Training, teal for Recovery, violet for Competition,
muted chalk for Rest, coral for Strength, blue for Flexibility, and amber for
Skill. These tokens describe meaning and should not be the only signal presented.

## Typography decision

The reference families are available through Google Fonts under licenses suitable
for web use. ChalkUP uses Big Shoulders Display for display headings, IBM Plex Sans
for UI/body copy, and IBM Plex Mono for labels and metrics. System, Arial Narrow,
and common monospace fallbacks are defined for offline or blocked-font cases.

## Current visual inventory

Before this work, global tokens and resets lived inline in `index.html`; most
component presentation used inline React styles. The old foundation had two main
surface levels, two border levels, 8px/12px radii, no formal spacing scale, no
shared shadows, and a single short transition convention. Mobile behavior is
primarily selected at 768px through `useIsMobile`, with additional component-local
breakpoints.

The new foundation lives in `src/styles/global.css` and defines color, type,
spacing, radius, shadow, motion, safe-area, z-index, responsive container, and
state primitives. `src/components/ui.jsx` supplies reusable component wrappers.

## Acceptance criteria

- Existing behavior, routing, authorization, queries, and persistence are unchanged.
- No horizontal page overflow at the four reference widths.
- Interactive controls have keyboard-visible focus and mobile targets of at least 44px.
- Icon-only controls have accessible names; state is never conveyed by color alone.
- Reduced-motion preferences are respected.
- No new lint errors; unit tests and production build pass.
- No AI entry point or provider credential is introduced.

## Verification record

The current redesign state passes `npm run check`: 6 unit tests pass, the production
build succeeds, and lint reports no errors. Route-level lazy loading reduced the
main JavaScript chunk from roughly 511kB to 381kB, removing the 500kB warning.
Five Playwright smoke tests pass, including the 375px reference width and an
assertion that the removed AI generator is not exposed on public entry points.

Protected-route screenshots now use a development-only Playwright harness with
deterministic network fixtures. It cannot activate in a production build and no
credentials were fabricated or copied into the repository. Twenty-seven visual
artifacts cover the redesigned routes at 1440px, 940px, and 375px, plus Login,
invalid sharing, and the assignment dialog. The artifacts are intentionally ignored
by Git; `tests/e2e/visual.spec.js` reproduces them.

The shell/navigation unit also passes `npm run check`. Five Playwright smoke tests
pass (login recovery controls, protected-route redirect, invalid-share failure,
mobile authentication/overflow, and absence of the removed AI entry point). On
Windows, the Playwright parent process can remain open after test work and screenshot
output complete; that idle cleanup process is stopped manually and recorded as a
runner issue rather than an application failure.

The read-only `supabase/tests/security_regression.sql` authorization assertions were
also executed against the production Supabase project. Supabase reported success
with no rows returned, confirming the expected anonymous and authenticated grants.
