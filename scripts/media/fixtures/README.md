# Local media migration fixtures

`baseline.sql` reconstructs the relevant public schema, constraints, grants and RLS policies inspected on 2026-10-17 in project `nqrlhotrwyrphwumxtty`. It is a test fixture, not a migration or deployment script. Never apply it to an existing project.

`catalog.json` contains only the 280 generic system exercise records and UUIDs, selected with `coach_id is null`. It includes no coaches, athletes, assignments, credentials or user records.

The test creates synthetic auth users, coach and athlete rows and assignment tokens in an in-memory PGlite database. `auth.uid()` reads a synthetic test claim. The two existing UUID defaults are modeled with the built-in random UUID generator; assignment/workout tokens are supplied explicitly. Public column types, enums, constraints and RLS expressions come from the inspection. No real Auth, PostgREST, Storage or hosted-project behavior is claimed by these tests.

The migration suite uses the inspected shared-workout payload as its before/after baseline and verifies all existing fields remain equivalent when the new ID/media fields are removed. Refresh these fixtures after a relevant production schema change.
