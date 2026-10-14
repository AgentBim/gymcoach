# Exercise GIF library preview

This branch serves the reviewed static library mockup and its exercise galleries. It does not run the live application or connect to its database.

Coverage: 40 Strength Legs entries and 80 Prehab entries. Matching exercise names share the same GIF where appropriate. The Prehab gallery is at `/prehab-gifs/` and the library starts at `/?category=prehab`.

The branch-specific Vercel configuration serves `gif-preview/` without an install or build step. Do not merge this preview configuration into the production branch.

The snapshot contains browser assets and sanitized downloadable manifests. Source-generation job files, credentials and local filesystem metadata are excluded.
