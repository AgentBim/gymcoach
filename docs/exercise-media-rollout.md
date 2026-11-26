# Exercise visuals in the redesigned app

The shared MP4/WebP player is connected to exercise details, builder pickers and selected items, saved/draft previews, the signed-in AthleteRun screen and shared-link WorkoutRunner. It uses the existing exercise UUID and published media version, never an exercise-name match. Athlete progress keys, prescribed sets/reps/rest and feedback authorization stay unchanged.

## Deployment defaults

`VITE_EXERCISE_MEDIA_ENABLED` defaults off. `VITE_EXERCISE_MEDIA_SECTIONS` defaults to `strength:Legs`. Merging this PR preserves the current text-only production experience until the approved media data is published and the flag is enabled in a subsequent deployment. No Storage bucket, upload, live migration or publication occurs from an app build or PR merge.

Enablement remains a separate release step under the implementation plan. The live database inspection on November 26 found 280 system exercises, no media tables and no Storage buckets. Do not turn on the flag and call that a completed media rollout: the database/view, exercise links and verified published objects must all exist first.

## Release checklist

1. Select an isolated Supabase test environment. Do not repurpose an unrelated project or create paid resources implicitly.
2. Apply the migration and prepare the import using an exact current system-exercise UUID crosswalk. Keep existing auth, day-override feedback, archive and sharing functions intact. The media migration extends only the shared-workout response.
3. Record content approval for the selected 40 Legs versions. Run the approval-gated uploader, verify every uploaded checksum/MIME type, then publish through the version-pointer function. See exercise-media.md for the schema and commands. Do not place privileged credentials in Vite environment variables.
4. Enable Legs only in the isolated app preview. Verify both signed-in and token/shared workouts, a day-override workout, builder saves, previews, rest timers, per-set resume and feedback. No MP4 may be requested before explicit Play. Test missing media, a failed request and Retry, reduced motion, offscreen/background pause, enlargement and a physical phone.
5. Review the concrete pilot before production migration/import/publication, then enable the flag in a separate release. Roll back by disabling the flag or restoring a prior approved publication pointer; preserve exercise/workout records.

## Validation and limits

The existing app tests, run-state identity/regression tests, 86 PostgreSQL schema/import assertions, eight upload-resumption scenarios, player metadata policy checks and the Vite build are run for this PR. Schema tests use synthetic identities and PGlite; upload tests use real bytes with an in-memory Storage adapter. They do not prove hosted Auth/PostgREST/Storage delivery.

The internal-browser tool reported local browser access unavailable for this chat. A fresh signed-in desktop/mobile walkthrough and physical-phone playback therefore remain unverified. The production deployment CLI also requested reauthentication, so the current source base was verified through fetched GitHub main, not a newly inspected production deployment.

The older static gif-library-preview branch is not merged. Its static-only Vercel configuration must never replace the normal Vite build.
