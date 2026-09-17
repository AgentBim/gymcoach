# ChalkUp visual redesign task list

> Implementation authority: `REDESIGN_HANDOFF.md`. Artifact discrepancies and
> corrected assumptions are recorded in `REDESIGN_RECONCILIATION.md`. The
> downloaded HTML is visual reference only; current app behavior is authoritative.

Goal: adopt the visual system and interaction polish demonstrated in the "Every screen, redrawn" artifact without reintroducing AI, changing authorization behavior, or bundling unrelated database features into the redesign.

Use this document as an ordered checklist. Complete and verify one work unit before starting the next.

## Working rules

- [x] Keep each work unit reviewable; avoid an all-screen rewrite.
- [x] Preserve existing routes, Supabase calls, validation, RLS assumptions, and assignment-token behavior unless a task explicitly says otherwise.
- [x] Do not reintroduce the removed Anthropic/AI feature. "Generate" refers only to the existing local randomizer.
- [x] Keep historical `is_ai_generated` data compatible without exposing a new AI entry point.
- [x] Preserve desktop and mobile behavior throughout the migration.
- [x] Run `npm run check` after every work unit.
- [x] Run `npm run test:e2e` after changes to navigation, authentication, assignment sharing, or athlete completion.
- [x] Check keyboard navigation, visible focus, screen-reader names, color contrast, and 44px mobile targets before closing a UI task.
- [x] Capture redesigned screenshots at desktop, tablet, and mobile widths for every redesigned route. The pre-change state is documented in `REDESIGN_BASELINE.md`; runnable screenshots are kept as ignored verification artifacts.

## 0. Baseline and visual contract

- [x] Capture Login, Dashboard, Roster, Athlete Profile, Workout Editor, Assign modal, invalid Athlete View, Programs, Program Builder, Library, History, and meaningful empty states.
- [x] Record the reference viewports: 1440px desktop, 940px compact desktop, 768px tablet, and 375px mobile.
- [x] Inventory existing colors, spacing, radii, shadows, typography, and breakpoints from `index.html` and inline styles.
- [x] Write a short mapping from current tokens to the artifact palette: Ground, Surface, Chalk, Accent, muted text, borders, and muscle/day-type tags.
- [x] Decide which artifact font families are licensed and practical for production; define system fallbacks.
- [x] Define acceptance criteria: no functional regressions, no horizontal overflow, no inaccessible icon-only control, and no new lint errors.

## 1. Design-system foundation

- [x] Create a global stylesheet and move shared CSS variables out of `index.html`.
- [x] Define color, typography, spacing, radius, shadow, motion, and z-index tokens.
- [x] Define semantic tag colors for muscle groups and Training, Recovery, Competition, and Rest.
- [x] Add shared responsive container and page-header styles.
- [x] Add reusable primitives for Button, IconButton, Input, Select, Textarea, Chip, Badge, Card, Modal, Drawer, EmptyState, StatCard, and Toast.
- [x] Support default, hover, active, disabled, loading, error, success, and focus-visible states.
- [x] Respect `prefers-reduced-motion`.
- [x] Verify the palette meets WCAG AA contrast for normal text.

Acceptance check:

- [x] One small existing surface uses the new primitives without changing its behavior.
- [x] Desktop, tablet, and mobile screenshots demonstrate that tokens render consistently.

## 2. Application shell and navigation

- [x] Redesign `Layout` around the new Ground/Surface system.
- [x] Restyle the desktop sidebar with consistent active, hover, and focus states.
- [x] Restyle the mobile bottom navigation and safe-area handling.
- [x] Standardize page width, gutters, sticky headers, and scroll behavior.
- [x] Add accessible labels to navigation icons.
- [x] Ensure the active route is communicated by more than color alone.
- [x] Verify every existing route remains reachable.

## 3. Authentication

- [x] Apply the centered ChalkUp authentication card and revised typography to Login/Sign up.
- [x] Preserve the existing tab behavior, forgot-password flow, alerts, autocomplete attributes, and submit states.
- [x] Restyle Update Password to use the same shell and fields.
- [x] Align signup password guidance with the eventual server policy; do not silently change the server policy as part of visual work.
- [x] Verify validation messages are announced and remain visible at 200% zoom.

## 4. Dashboard

- [x] Apply the redesigned page header, search, filter chips, cards, and responsive mobile list.
- [x] Show assignment status on each workout card using existing assignment data.
- [x] Replace dense text actions with accessible overflow or icon actions.
- [x] Add confirmation before destructive deletion.
- [x] Add Save/Duplicate/Delete success and error toasts using the shared toast primitive.
- [x] Implement the honest empty-dashboard state without mentioning AI; use "Build manually or use the randomizer."
- [x] Treat new dashboard statistics as a separate follow-up unless they can be derived safely from existing queries without slowing the page.

## 5. Roster and athlete forms

- [x] Apply grouped squad sections, athlete rows, avatars, assignment counts, and search/filter styling.
- [x] Convert View/Edit/Delete controls to accessible icon buttons with tooltips.
- [x] Preserve the current athlete-profile route and deletion behavior.
- [x] Add the redesigned empty-roster state.
- [x] Restyle Add/Edit Athlete using the shared form and modal/page primitives.
- [x] Verify long names, missing levels, empty groups, and large rosters.

## 6. Athlete profile

- [x] Redesign the existing profile header, identity block, assignment summary, and assignment cards.
- [x] Preserve copy-link, rotate-link, remove-assignment, expiry, and error behavior.
- [x] Add Assigned and Feedback tabs only using data already available and authorized to the coach.
- [x] Treat coach-authored Notes as a separate product/database project, not part of the visual redesign.
- [x] Verify expired/revoked links have distinct labels and recovery actions.

## 7. Workout editor

- [x] Apply the shared editor shell to Manual, Randomizer, and Prehab modes.
- [x] Keep the existing local randomizer; label it "Random" or "Randomizer," never AI.
- [x] Ensure randomized exercises land in the same editable/reorderable list as manual selections.
- [x] Redesign exercise search, muscle filters, add controls, list rows, sets/reps/rest inputs, reorder controls, and remove controls.
- [x] Redesign the existing Prehab panel and make its grouping visually consistent with the athlete view.
- [x] Preserve create/edit behavior and historical `is_ai_generated` values.
- [x] Add an unsaved-changes prompt before navigating away.
- [x] Verify keyboard reordering or provide accessible Move up/Move down actions.

## 8. Assign and share

- [x] Restyle the existing assignment modal using separate "Already assigned" and "Add more athletes" sections.
- [x] Preserve the current rule that already-assigned athletes cannot be selected again.
- [x] Preserve athlete-specific links, token rotation, expiry, and clipboard behavior.
- [x] Add assignment success/error toasts.
- [x] Verify the modal with zero athletes, every athlete already assigned, long squad lists, clipboard failure, and network failure.

## 9. Athlete shared view

- [x] Apply the new athlete-facing header, workout metadata, tags, exercise cards, and progress presentation.
- [x] Restyle the existing completion and feedback form rather than rebuilding it from assumptions in the artifact.
- [x] Distinguish invalid, expired, revoked, already-submitted, and genuinely empty states where the API provides enough information.
- [x] Decide separately whether prehab completion should technically lock the main workout; document the behavior before implementing it.
- [x] Prehab locking was not approved and remains intentionally unimplemented; the main workout is never trapped behind client-only state.
- [x] Verify one-time feedback submission and refresh behavior.

## 10. Programs and program builder

- [x] Redesign the program list, active-block progress, cards, and empty state.
- [x] Restyle New Program while preserving existing name validation and save errors.
- [x] Apply the new week calendar and day-type color system.
- [x] Replace the inline day editor with a responsive drawer only after documenting focus trapping, Escape behavior, and unsaved changes.
- [x] Preserve atomic program saving and authorized workout selection.
- [x] Verify 1-week and 104-week bounds, empty days, mobile week navigation, and failed saves.

## 11. Exercise library and custom exercise form

- [x] Apply the fixed desktop filter rail and responsive mobile filter controls.
- [x] Retain one responsive card representation; a second density mode would add state and maintenance cost without a demonstrated accessibility benefit.
- [x] Restyle exercise cards, difficulty tags, muscle tags, defaults, and custom indicators.
- [x] Redesign the existing custom-exercise form with shared form primitives.
- [x] Add the honest Mobility-empty state only when the selected result set is actually empty.
- [x] Verify combined filters, long descriptions, empty searches, and custom exercise editing.

## 12. History

- [x] Preserve the current assignment-accurate feedback query and attribution helpers.
- [x] Apply the revised typography, filter controls, statistics, feed cards, and expanded state.
- [x] Keep both workout and feel filters; they already exist in the application.
- [x] Preserve legacy recorded-name labeling.
- [x] Do not imply per-exercise completion details unless the database actually stores them.
- [x] Verify two athletes assigned to one workout never appear under the wrong response.

## 13. Empty, loading, error, and confirmation states

- [x] Centralize reusable EmptyState, Skeleton/Loading, InlineError, ConfirmationDialog, and Toast patterns.
- [x] Cover empty dashboard, empty roster, no programs, no feedback, empty filtered library, invalid share link, and network failure.
- [x] Use distinct share-link messaging where the current RPC exposes a distinct state; invalid, expired, and revoked remain one fail-closed response because the API deliberately does not disclose the reason.
- [x] Add destructive confirmation for workout, athlete, assignment, and program deletion. Custom exercises currently have no delete action, so no confirmation applies.
- [x] Ensure errors are actionable and never rely on color alone.

## 14. Accessibility and responsive audit

- [x] Run keyboard-only navigation through routes and modal/drawer primitives.
- [x] Confirm modal/drawer focus trapping and focus restoration.
- [x] Add accessible names to every icon-only button.
- [x] Verify headings form a logical hierarchy.
- [x] Check text and controls at narrow/zoom-equivalent layouts.
- [x] Check contrast for muted text, chips, disabled controls, and colored tags.
- [x] Verify 44px touch targets on mobile.
- [x] Test reduced motion and high-contrast preferences.
- [x] Verify no content is hidden behind the bottom navigation or sticky headers.

## 15. Performance and regression pass

- [x] Lazy-load route-level screens where appropriate.
- [x] Keep shared primitives tree-shakeable and avoid adding a heavy icon library without measuring it.
- [x] Reduce the main bundle below the current 500kB warning threshold if practical.
- [x] Update unit tests for any extracted view-model logic.
- [x] Expand Playwright coverage to the redesigned navigation and primary coach/athlete flows.
- [x] Run `npm run check` and `npm run test:e2e`.
- [x] Run the read-only database authorization suite against the production Supabase project; all assertions completed successfully with no rows returned.
- [x] Compare final screenshots against the artifact direction and baseline at desktop, compact desktop/tablet, and mobile reference widths.

## Explicitly separate follow-up projects

These are product or data-model changes, not visual-redesign tasks. They intentionally remain unchecked and do not block this redesign release:

- [ ] Coach-authored athlete notes, including schema, RLS, retention, and tests.
- [ ] Dashboard unread-feedback state and aggregate analytics.
- [ ] Persistent per-exercise completion history.
- [ ] Server-backed prehab gating across devices.
- [ ] CAPTCHA and application-level rate limiting.
- [ ] Any future AI-assisted workout generation.

## Suggested iteration order

1. Baseline and design-system foundation.
2. App shell, navigation, authentication, and shared states.
3. Dashboard and roster.
4. Workout editor and assignment modal.
5. Athlete shared view and feedback.
6. Athlete profile and History.
7. Programs and program builder.
8. Exercise library and custom exercise form.
9. Accessibility, responsive, performance, and regression passes.

Definition of done: every current ChalkUp capability remains available, the visual language is consistent across all routes, automated checks pass, responsive screenshots match the approved direction, and no new backend behavior has been smuggled into the visual migration.
