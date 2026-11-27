# Plan UX audit remediation

The goal is to resolve the Plan UX audit without losing accessibility, data integrity or existing behavior.

| Issue | Implemented solution | Regression coverage |
| --- | --- | --- |
| Selected exercise lost | Choose new/existing workout; carry id into builder; add to main/prehab once; prevent duplicates | WorkoutBuilder and Library DOM tests |
| Unsaved drafts lost | Router navigation blocker with Keep editing/Discard; beforeunload protection; pending-save and concurrent-edit handling | WorkoutBuilder DOM tests |
| Dialog close/focus gaps | Native modal dialogs, explicit Close, focus restore and topmost Escape handling | Dialog/player DOM tests; native browser check still required |
| Tablet columns clipped | Compact exercise/workout rows and sheet details below1280px; corresponding skeletons | Real responsive browser check still required |
| Small mobile fields/targets | 16px/44px shared search;44px pills/segmented and assignment controls | Source review; device check still required |
| Builder false empty/error states | Abortable timed loads with Retry; keep existing-workout form unavailable on failed initial load | Collection load and WorkoutBuilder DOM tests |
| Library context/empty states | URL filters/selection, account-scoped session restoration, Clear filters and explicit empty Mobility message | Library DOM tests and navigation unit tests |
| Replay/stalled media | Replay starts at0;15second stall recovery; Retry; isolated enlarged-dialog dismissal | MediaInteraction DOM tests |
| Partial custom exercise creation | Single complete form with labels/cue/defaults, load/save errors, zero-rest preservation, unsaved protection | CustomExercise DOM test |
| Post-login destination | Validated internal coach destination carried through password and Google callbacks | Safe-navigation unit tests; OAuth walkthrough pending |
| Skeleton alignment | Exercise skeleton62px row minimum, compact layouts share actual page breakpoints; reduced motion retained | Existing skeleton tests; visual alignment check pending |

## Engineering decisions

- Use React Router's data router to support its navigation blocker, covering programmatic navigation and history instead of intercepting clicks. Existing routes and legacy redirects are preserved.
- Native dialogs provide browser focus containment/inert background behavior. Nested player Escape is stopped at the top dialog. Browser-native behavior is not proven by the jsdom polyfill.
- Owner-keyed editor instances and requests prevent cross-account state reuse. Successful snapshots remain cached during refresh; late/cancelled requests cannot replace current data.
- No schema, access policy, production records or media asset changes. jsdom is a pinned development dependency only.
- A save response only clears dirty state if no newer edit occurred. Custom exercise forms retain changes on failure.

## Release gate

Automated tests/build must pass. Complete native modal focus, Escape, Close, chooser handoff, draft guard and responsive visual checks before merging. Check320/390/1024/1440px. Browser control currently stalls after viewport changes and some native dialog interactions; do not describe the visual check as passed. The draft PR is intended for review while this is resolved.

Actual iPhone installed-PWA keyboard, safe area and VoiceOver validation remain a device-test limitation.
