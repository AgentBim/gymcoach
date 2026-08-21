# ChalkUP database development

The migration directory contains the complete production history. The thirteen
May 2026 migrations were recovered verbatim from
`supabase_migrations.schema_migrations`; the six August 2026 migrations were
already tracked locally.

## Local verification

Use the pinned CLI version from `.github/workflows/ci.yml` and a running Docker
engine:

```sh
supabase start
supabase db reset --local
supabase db query --local --file supabase/tests/security_regression.sql
supabase test db --local
```

`db reset --local` destroys only the local database and rebuilds it by replaying
all nineteen migrations. Never add `--linked` to this command for the production
project.

`schema_fingerprint.sql` creates deterministic component fingerprints of the public
schema, including relations, columns, constraints, indexes, RLS policies,
functions, triggers, and application-role grants. CI compares the rebuilt
database with `production_schema_components.csv`, captured from production on
2026-08-21.
