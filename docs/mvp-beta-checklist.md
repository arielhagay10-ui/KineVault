# MVP beta checklist

Use the final production build and disposable local accounts for the automated rehearsal. Keep test records separate from development exercises. Record the build, browser, date, task, result and evidence path for each manual run. Do not record passwords, email tokens or signed media URLs.

## Acceptance journeys

| Journey | Pass condition | Existing coverage |
| --- | --- | --- |
| Find an exercise | Shoulder Abduction + Cable returns matching results; opening detail retains useful navigation and playable media | `tests/e2e/catalog.spec.ts`, `tests/e2e/media-recovery.spec.ts` |
| Account access | Register, confirm from the local inbox, sign in, recover the password and return to the original filtered catalog | `tests/e2e/authentication.spec.ts` |
| Personal library | Save an exercise, find it in Saved, resume a private draft and reach sharing/details from More actions | `tests/e2e/library-navigation.spec.ts` |
| Create privately | Save and reload the same movement; another user and an anonymous visitor cannot read the private draft | `tests/e2e/site-simplification.spec.ts`, workshop/browser and database suites |
| Publish and moderate | Explicit publication creates a public snapshot; later private edits leave it intact. Report, verify, hide and restore through the reviewer UI | `tests/e2e/community-publication.spec.ts` |
| Failure recovery | Failed WebM falls back to MP4; total media failure offers reload. Catalog errors preserve the current search when retried | `tests/e2e/media-recovery.spec.ts`, catalog state tests |
| Responsive interface | Navigation, filters and actions remain reachable at 320, 390, 768 and 1440 CSS pixels, in light and dark | navigation and readiness suites |

## Before inviting beta users

- Review home, catalog, detail, library and workshop on a phone and desktop. Include empty results, long names, loading, unavailable saved exercises and failure recovery.
- Test with a few intended users. Ask each to find a movement, save it, and create/reload a private variation without coaching. Record success, confusion and lost work before adding features.
- Run a physical iPhone/Safari playback and save/reload check. Windows WebKit and touch emulation do not establish this result.
- Run keyboard and a real screen reader through catalog, auth and workshop controls. Resolve applicable axe incomplete results. Use the manual record in `docs/browser-accessibility-readiness.md`.
- Choose one moderation operator and a route for beta feedback. Do not promise response times that nobody has agreed to cover.

## Staging and public access

The local production preview is a build-review environment, not an externally deployed staging service. Run `npm run build -- --webpack`, then `npm start` after coordinating active servers. Use `.local-artifacts/` for local evidence.

For external staging, first choose the host, HTTPS origin and correct Supabase project. Reuse `compose.production.yml` and `docs/deployment-readiness.md`. Keep production/staging credentials in ignored environment files; never copy local service credentials into a public build.

Before public access, complete the existing evidence for migration upgrade, database and Storage restore, custom SMTP and real confirmation/recovery inbox delivery, worker restart/retry, notification delivery and an alert drill. Run the deployment preflight against that exact target. Do not treat a green local build as public-launch approval.

## Research and follow-up

See [MVP readiness research](mvp-readiness-research-2026-10-22.md) for official sources and priorities. Exercise-specific metadata and a published-only sitemap are useful after selecting the public origin. Keep them below correctness, recovery, usability and deployment evidence.

## Local follow-up completed, 22 October 2026

- Installed Firefox passed eight compatibility checks and 14 accessibility scans in light/dark, including combined catalog filters, keyboard navigation, workshop equipment selection and modal focus.
- Four production performance checks passed. The small home mascot now uses sized image optimization; matched desktop measurements reduced mascot transfer from 825 KB to 10 KB and total home transfer by about 75%. See `PERFORMANCE.md` for scope and raw evidence.
- Isolated database upgrade/restore and private media-byte restore drills passed with cleanup. Real deployment backup/restore evidence remains pending.
- Local liveness passed, but the queue gate found an old render/notification backlog and no continuously running workers. Review the backlog before enabling delivery. See [local operations findings](mvp-local-operations-2026-10-22.md).

The next beta step is representative user and physical-device review alongside a dedicated worker rehearsal. Emulated browsers, synthetic restores and individual fixture renders do not replace those results.
