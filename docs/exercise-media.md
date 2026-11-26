# Shared exercise media — implementation and release notes

Branch: `codex/exercise-media-integration`, based on main `f4154597937ecd670d687aa7dd5d4ae22b69094b`.

This is the real React/Vite application branch. Do not merge the static `codex/gif-library-preview` branch into it. The normal Vercel SPA configuration and app build are retained.

## Verified starting point

On 2026-10-17, read-only inspection of Supabase project `nqrlhotrwyrphwumxtty` found 280 generic exercises (200 Strength and 80 Prehab), no media tables, no storage buckets and no application admin-role field. Exact category + muscle group + name reconciliation produced 280 unique exercise UUID matches, no missing or new entries, no ambiguous matches and no changed descriptions. Custom records never participate in automatic matching.

No live schema, bucket, object, exercise or function has been modified by this implementation work.

## Model and read contract

- `media_assets`: permanent UUID/import key, title, current version, archive state and publication revision/history.
- `media_asset_versions`: immutable file identities, version number, timing/dimensions, validation, separate content approval and remote-file verification.
- `exercises.default_media_asset_id`: nullable indexed FK. Existing IDs, descriptions, prescriptions and workout references stay intact.
- `exercises.media_demonstration_note`: entry-specific cue. This is needed because Hang to Row/Inverted Row and Good Morning/Hip Hinge Pattern share files but have different captured notes. A version-wide note remains available separately; the player should display both without repeating identical text.
- `exercise_media`: an invoker view with only playback metadata. Batch it using `exercise_id in (...)`; exercise RLS remains in force. Missing/unpublished/failed/rejected/archived media produces no row, so the UI keeps its text-only exercise.
- `get_shared_workout(text)`: preserves the inspected token format, assignment, expiry and revocation checks. Each nested exercise receives its stable ID, category and nullable `media` object. Anonymous callers get no direct table/view access. Existing response fields remain unchanged.

Playback fields: `media_asset_id`, `version_id`, `publication_revision`, `storage_bucket`, `video_path`, `poster_path`, `width`, `height`, `duration_ms`, `demonstration_note`, `exercise_note`. Review identities, technical reports, source hashes and publication history are not exposed to app clients.

Current first-release scope permits only system media (`owner_coach_id is null`). Private coach uploads and their assignment-aware delivery remain deferred. Ordinary authenticated users have no mutation rights on shared media. Publishing is a server/operator operation using a privileged credential, not a role inferred from editable profile metadata.

## Import preparation

Install locked dependencies with `npm ci`. Use a current system-only exercise export containing `id,name,category,muscle_group,difficulty,description,is_custom,coach_id` from the target database, filtered by `coach_id is null`. The checked-in catalog is an inspected test fixture, not a permanent substitute for target reconciliation.

```text
npm run media:prepare -- <optimized-package/manifest.json> <system-exercises.json> <output-directory>
```

Preparation is offline. It verifies each local file against the compressed manifest and writes:

- `import-drafts.sql`: one transaction that rechecks target UUID/name/category/group/ownership, inserts stable asset/version identities, and links exercises without resetting publication or review state.
- `exercise-id-crosswalk.json`: the persisted exact matches, asset IDs and original entry-specific notes.
- `upload-plan.json`: deduplicated immutable destinations, local inputs and version identities.
- `import-report.json`: coverage, exceptions, byte totals and draft-only status.

Any changed target identity, existing different media link, conflicting coaching note, unknown version or different file fingerprint aborts the import. Repeated imports preserve approved versions and current pointers. A new encoding profile for an existing asset requires an explicitly numbered new version; it must not replace v1 silently.

An upload plan contains local file paths for the operator. Keep it and the generated SQL out of the public site. Do not place privileged keys, internal provenance or generation prompts in the browser bundle.

## Storage and publication sequence

Perform this first in a verified isolated Supabase environment. No paid project/branch is created by these scripts.

1. Apply the reviewed migration and draft import to the intended isolated database. Reconcile against that database's actual exercise UUIDs. Preserve migration history; the repository does not contain the original complete schema.
2. Record explicit content approval for the selected versions, including reviewer and timestamp. The import marks only technical validation passed; it never invents approval. A correction to the demonstrated variation creates a new version or, for a different movement, a new asset.
3. Configure a dedicated `exercise-library` bucket as public for approved generic demonstrations only, with `video/mp4` and `image/webp` MIME types and an appropriate file-size limit (5 MiB covers the current outputs). Do not add anonymous/authenticated upload/update/delete policies. Draft files remain local/private. Public source GIF downloads are not enabled by this migration.
4. Use the upload tool, optionally selecting only the pilot's approved version IDs. It defaults to an offline dry run:

```text
node scripts/media/upload-approved.mjs <upload-plan.json> --versions <version-ids.json>
```

The separate apply mode requires `--apply --expected-project <ref>` and server-only `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` environment variables. Keep credentials out of command arguments, shell history, checked-in files and `VITE_*` variables. This mode has not been run against a hosted project.

The tool checks actual approval and fingerprints in the target DB, validates every selected local file before writing, uploads with `upsert:false`, and downloads files to verify SHA-256, bytes and MIME. Existing matching files are reused; conflicting objects are never overwritten. A partial upload does not publish metadata. Successful verification records `files_verified_at` only if approval and fingerprints still match.

Immutable paths use output checksums, e.g. `library/animations/<sha256>.mp4` and `library/posters/<sha256>.webp`. This retains deduplication across versions and assets while making replacements cache-safe. Cache TTL is one year. The current package needs 495 unique objects totaling 29,081,729 bytes.

5. Publish only approved, technically valid, remotely verified versions via `publish_media_asset(asset_id,next_version_id,expected_current_version_id)`. It locks the asset, checks the expected pointer, enforces same-asset membership, records a revision/history event and changes the pointer in one transaction. The apply/upload tool deliberately does not call this publisher.
6. Roll back with the same function, passing the previous approved version and the current expected pointer. Passing null as the next pointer unpublishes. An archive flag also hides playback metadata. Retain prior files and versions while references exist. Public immutable file URLs can remain cached after metadata is unpublished; private or revocable content must not use this bucket design.

## Local verification

```text
npm run test:media
npm run build
```

For a non-default package path, run the schema suite directly with its manifest argument, followed by `node scripts/media/test-upload.mjs`. The default test command uses the sibling workspace package.

The schema suite runs the migration and full draft import against in-memory PGlite PostgreSQL with a reconstructed inspected schema and synthetic users/assignments. It verifies 86 assertions covering preserved workout data, exact mapping, RLS/grants, service-only publication, expiry/revocation, nullable media, Prehab responses, immutable versions, same-asset pointers, deletion restrictions, reimports and rollback. The upload suite exercises interrupted transfers, reuse, corrupt remote bytes, wrong MIME, approval changes and permission failures through a fake Storage transport using real package bytes.

These tests do not verify hosted Supabase Auth, PostgREST schema discovery/grants, actual Storage/CDN delivery or browser network requests. Those checks remain required during the Legs pilot before production release. The normal app build passes; the existing bundle-size advisory remains.

## Next implementation stage

Add the shared JSX player with a Legs-only pilot flag, metadata adapter, play-on-tap loading, fixed aspect ratio, reduced motion, offscreen/background pause, enlargement and poster fallback. Connect Library, builder/preview, WorkoutRunner and both athlete routes. Use fixtures while isolated hosted services are unavailable. Review selected variations and run the full coach-assignment-to-athlete-feedback flow before production migration/publication.

## Documentation consulted

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Invoker views](https://supabase.com/docs/guides/database/views)
- [Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Storage upload](https://supabase.com/docs/reference/javascript/storage-from-upload)
- [Storage download](https://supabase.com/docs/reference/javascript/storage-from-download)
