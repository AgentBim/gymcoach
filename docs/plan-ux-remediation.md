# Plan UX audit remediation

The goal is to resolve the Plan UX audit while preserving accessibility, data integrity and the existing visual system.

| Issue | Solution | Evidence |
| --- | --- | --- |
| Selected exercise lost | New/existing workout chooser; apply id once to main/prehab without autosaving | Builder/Library DOM tests; both handoffs verified in browser |
| Unsaved drafts lost | Router blocker, Keep editing/Discard and browser-exit protection; newer edits remain dirty after a save | DOM tests; browser draft guard and deliberate discard |
| Dialog close/focus gaps | Native modal, explicit 44px Close, focus restoration, topmost Escape | Browser focus moves inside, stays contained, returns to row; enlarged Escape preserves parent |
| Tablet columns clipped | Compact rows and sheet details below 1280px | Browser 1024px and 1440px: no clipped section content |
| Small mobile controls | 16px/44px search; 44px pills, segmented and assignment controls | Browser 320/390px field sizing and 52px Plan tabs |
| Builder false empty/error states | Abortable 15-second loads, Retry and safe existing-workout loading gate | Collection/Builder DOM tests; rendered first-load skeletons |
| Lost library context and empty states | URL filters/selection, account-scoped session restoration and Clear filters | Browser search survives Plan navigation; empty Mobility explanation and reset |
| Replay/stalled media | Replay from 0, 15-second stall recovery and Retry | DOM recovery test; browser MP4 readyState4 and replay position reset |
| Partial custom exercise creation | One complete labeled form, cue/defaults, load/save recovery and unsaved protection | Browser failed save retains text; retry saves selected entry; zero rest retained |
| Post-login destination lost | Validated internal destination through password/Google login and callback | Password, Google handoff/callback DOM tests; external-redirect rejection tests |
| Skeleton alignment | Compact skeletons use the same breakpoint as actual content; 62px exercise rows; reduced motion retained | Browser compact/desktop skeletons and loaded content; existing accessibility tests |

## Engineering decisions

- Use React Router's data router for supported navigation blocking across programmatic and history navigation. Existing routes and legacy redirects remain.
- Native dialogs provide focus containment and inert background behavior. Each enlarged player stops Escape at the top dialog and restores its opener.
- Owner-keyed editors and requests prevent cross-account state reuse. Timed loads reject stale/cancelled responses and preserve successful refresh snapshots.
- No schema, access policy, production records or media asset changes. jsdom is a pinned development dependency; no new runtime dialog library is retained.
- Saving only clears dirty state if no newer edit occurred. Custom exercise forms retain changes on failure.

## Validation

78 committed regression tests and production build pass. A temporary full-App fixture test also passed. Browser checks used actual app routes/components with isolated local data at320,390,1024 and 1440px. The temporary fixture was corrected to preserve the authenticated user object's identity, resolving its inbox-refresh loop. Fixture files are excluded from the PR and removed after verification.

The production review still follows PR checks, merge and deployment verification. Actual iPhone installed-PWA keyboard, safe-area and VoiceOver checks remain device-test limitations; viewport simulation does not prove those behaviors.
