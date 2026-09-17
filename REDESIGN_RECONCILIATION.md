# ChalkUP Redesign Artifact Reconciliation

## Reconciled artifacts

| Artifact | Role | Treatment |
| --- | --- | --- |
| `C:\Users\jahb2\Downloads\chalkup-redesign.html` | Visual reference | Preserved unchanged; use for layout, styling, typography, icons, and interaction inspiration only. |
| `C:\Users\jahb2\Downloads\HANDOFF.md` | Historical handoff | Preserved unchanged; its product-state claims are superseded where they conflict with current code. |
| `REDESIGN_HANDOFF.md` | Authoritative scope | Reconciles the visual intent with the application that exists. |
| `REDESIGN_TASKS.md` | Execution checklist | Supplies the ordered implementation plan. |

## Discrepancies resolved

The downloaded handoff describes these features as absent or incomplete even
though they already exist:

- Athlete profile route and page.
- Public shared-athlete workout route.
- Athlete feedback submission and completion confirmation.
- Program creation, saving, and name validation.
- Manual, Random, and Prehab workout-building modes.
- Protection against selecting athletes who are already assigned.
- History workout filters, expanded entries, feedback, and emoji filtering.

They are redesign targets, not greenfield feature tasks. Preserve their behavior.

The following remain new product work and stay outside the first visual pass:

- Coach notes for athletes.
- A hard prehab-completion gate.
- Dashboard aggregates or notification data absent from current queries.
- Persisted per-exercise progress not represented in the database.
- Interaction additions that require a new persisted contract.

The application's AI feature is intentionally removed. Mockup wording such as
“Generate,” “Re-generate,” or “generated workout” is not an AI requirement. Use
`Random` or `Randomizer` for the existing local random-workout mode.

## Rules for the HTML reference

- Do not copy mock data into production components.
- Do not copy inline handlers or static navigation as application logic.
- Do not infer database fields from visible mockup content.
- Do not treat a visually complete screen as proof its backend exists.
- Recreate the design through reusable application components and tokens.
- Check each real route in loading, populated, empty, error, and mobile states.

## Release-state note

This reconciliation changes documentation only. It does not deploy, push, mutate
Supabase, or alter the downloaded originals. Existing unrelated working-tree
changes must be reviewed separately before forming a release commit.
