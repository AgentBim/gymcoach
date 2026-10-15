# Exercise GIF library preview

This branch serves the reviewed static library mockup and its exercise galleries. It does not run the live application or connect to its database.

Strength coverage: Arms 40/40, Back 40/40, Legs 40/40, Core 40/40, Shoulders 40/40. Prehab: 80/80. Matching exercise names share the same GIF where appropriate. The Strength hub is at `/strength-gifs/`, the Prehab gallery is at `/prehab-gifs/`, and the library accepts `/?category=strength&group=Arms`.

The branch-specific Vercel configuration serves `gif-preview/` without an install or build step. Do not merge this preview configuration into the production branch.

The snapshot contains browser assets and sanitized downloadable manifests. Source-generation job files, credentials and local filesystem metadata are excluded.
