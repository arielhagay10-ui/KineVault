# Efficiency review implementation, 3 October 2026

Source: `docs/code-efficiency-design-review.md`, items 1–40.

Preserve the existing design, user work, normalized data, authorization, recovery and GPU cleanup. Use no new UI or state framework. Measurements gate speculative optimizations. Work in the current checkout because the reviewed uncommitted workshop changes are part of the requested scope. No publishing or unrelated data changes.

## Work and verification ledger

- [x] Workshop: cable capacity; shared ref playback; snapshot memoization; single pose solve; body proxies; scratch objects; quick/advanced workflow; persistent hints; responsive comparison; translation boundaries; focused hooks/panels. Items 1–5, 10–12, 27–28, 33, 35–37.
- [x] Catalog/data: title-first detail; lazy previews; public option cache/invalidation; request identity; parallel detail reads; one media replacement lookup; bounded favorites/history/roles/candidates; filters. Items 6, 13–20, 26.
- [x] Worker/delivery: context exclusions; claim token and timeout; measure capture phases; static model middleware exclusions. Items 8, 22–25.
- [x] Forms/polish: metadata guard; mobile navigation/touch; visible feedback; robust copy; reduced-motion submissions; responsive review comparison; semantic errors; route fallbacks. Items 7, 21, 29–35, 38.
- [x] Asset/performance: measure production routes, anatomy preparation/draw calls/frame times, poster bytes, worker phases and fresh SQL plans. Evaluate compressed preview without losing selectable anatomy or licensing. Items 9–12, 18, 23–24, 40.
- [x] Documentation: update repository guidance, archive superseded workshop plans, record item outcomes and evidence. Item 39.
- [x] Final checks: lint, strict types, all Vitest, database suite, Playwright catalog/auth/private/moderation/workshop, media suite, production build and desktop/mobile/light/dark/Hebrew visual checks. Fix failures and retain evidence under `.local-artifacts/efficiency-review`.

## Decisions

User's instruction to implement this review authorizes its described design and reversible changes. Profile-first recommendations require measurements, not automatic asset, SQL, theme or concurrency changes.

## Item outcomes

| Items | Result |
| --- | --- |
| 1 | Cable buffers allocate maximum capacity once and change draw ranges; the legacy two-point demo also reuses its buffer. |
| 2–4 | Shared ref playback advances every frame, with React clocks throttled to 100 ms. Draft snapshots are memoized with a lazy baseline. A single authoritative figure solve precedes contact consumers; camera-only frames reuse poses. |
| 5, 12 | Bone/body proxies replace precise skinned placement bounds. Gestures suppress advisories; unchanged final body poses retain cached bounds. Hot solvers reuse per-rig scratch math. |
| 6 | Exercise title/actions precede media on phones and retain desktop grid placement. |
| 7 | Actual metadata changes warn on link/unload navigation. Account/draft/tab-scoped session recovery survives Back, including incomplete names, conflicting roles, and aliases/selections needing correction. Successful saves clear equivalent recovery, including database-derived parent joints. Save validation stays strict. |
| 8 | Docker excludes local caches and artifacts. |
| 9–11 | Lossless meshopt export is 9,920,700 bytes versus 12,417,516 (20.1% smaller). All 2,352 decoded buffer views match; 784 meshes, 325,619 vertices and muscle identities survive. Immutable prepared skinning geometry has explicit shared ownership; skeletons/highlights stay independent. Each rig shares three material states. Larger batching, culling and lower-detail changes remain measured follow-ups requiring anatomy/grip validation. |
| 13 | Home uses a 7,770-byte original licensed poster before explicit 3D loading. Submission pages show media before an optional inspector. |
| 14–17 | Cookie-free public taxonomies use tagged one-hour caching and immediate action invalidation. Identity is request-scoped; privileged actions recheck roles. Independent detail reads run together, related/family names use nested reads, and resolved media is signed once. |
| 18 | CDP measures cross-origin poster transfer that Resource Timing hides. Largest poster is 17,523 transferred bytes; 12 Explore cards total 178,611. Retain these modest originals for now and monitor aggregate transfer before adding stable publication/storage variants. Signed URLs are not blindly optimized. |
| 19–20 | Favorites have a separate exact count and bounded 24-record pages. Submission/candidate/role pages have database-side search/pagination and stable ordering. |
| 21 | Loading fallbacks cover catalog/details and authenticated workflows; route errors offer retry. |
| 22 | Claim IDs reject stale/expired completion/failure. Private paths include the claim. Capture/encoder deadlines cancel Chrome/FFmpeg. Only confirmed failed claims remove their outputs; uncertain outcomes retain files for reconciliation. Pause older workers before deploying the migration, then restart claim-aware workers. |
| 23 | Measured capture costs dominate startup/encoding. Warm-browser reuse and combined encoding have small measured savings; concurrency/lifecycle changes are deferred. |
| 24 | Warm local production responses were 8–15 ms; disabled browser cache measured the complete initial transfer. Preserve flash-free server themes because these results do not justify a static-shell conversion. |
| 25 | Model directory bypasses session middleware; only the fingerprinted model gets immutable caching. |
| 26 | Common filters precede advanced classifications; Apply stays outside a bounded choice scroller. Selected chips remain URL-backed. |
| 27–28 | Quick creation shows four steps; Advanced shows focused tabs. One primary Save remains. Essential current-state guidance survives tutorial closure. |
| 29–32 | Deliberate mobile navigation/touch targets, visible hover/focus states, URL-specific clipboard success/failure, and reduced-motion/preload-aware submission media. |
| 33 | Phone workshop comparisons stack with natural vertical space and persistent linked-camera guidance. Review comparisons show labeled mobile rows. |
| 34–35 | Shared semantic errors associate/focus invalid inputs and preserve values; pending states are exposed. Preview has one loading/retry fallback; empty instruction panels are omitted. |
| 36–38 | Focused playback/history/tutorial hooks and tool panels preserve one scene owner. Explicit translation includes Hebrew toolbar actions/links; user content stays unchanged. Shared errors replace repetition. Redundant direct clsx/tailwind-merge declarations are removed; shadcn remains a build dependency. Worker installs retain actual browser/runtime requirements. |
| 39 | Updated repository guidance and one current workshop reference; historical proposals remain in `docs/archive/workshop/`. |
| 40 | Production transfer/navigation, frames/commits, idle task time, draw calls and comparison memory are recorded with small regression budgets. Fresh isolated 50,000-record SQL plans remain in `PERFORMANCE_RESULTS.txt` and ignored `PERFORMANCE_PLANS.txt`. |

## Verification evidence

Lint, strict types and production build pass. The final complete unit run passed 50 files / 320 tests. All 43 browser tests pass in one production run with one worker, 8.3 minutes. Database checks pass 33 files / 477 assertions, including applying every migration to an empty application schema in an isolated temporary database. Eight worker tests cover real cancellation, capture and uncertain callbacks. The final real media E2E passes private capture, reviewed publication, signed WebM/MP4, reduced motion, MP4 fallback and Shoulder Abduction + Cable → matching results → details, 17.3 seconds.

Browser testing found a live machine-handle bug: keyboard adjustment used the starting transform after editing the finish. Anchor, pointer snapshot and keyboard adjustment now read the same live object ref as rendered geometry. The row/pec-deck regressions remain. Final review also found recovery could discard all fields if an alias exceeded save limits; bounded draft recovery now retains these edits while strict actions reject them until corrected. A rejected save also reset uncontrolled fields. Explicit transition dispatch now preserves form values and pending feedback, retaining the action fallback. Browser regressions verify failed sign-in and invalid metadata retain entered values, then accept corrections. See [React form reset behavior](https://react.dev/reference/react-dom/components/form).

Evidence is in ignored `.local-artifacts/efficiency-review/` and `.local-artifacts/worker-profile/`. Visual coverage: Home/Explore/details at 390×844 and 1440×1000 in light/dark; workshop also in English/Hebrew, including mobile comparison. Software-renderer frame samples are local observations, not hardware GPU or concurrency guarantees. See [performance](../PERFORMANCE.md).

Final production budgets and visual checks pass in 34.2 seconds with no browser errors. Hebrew camera tooltips and accessible names are translated. Comparison keeps compact credits inside each preview and full attribution/licenses below both figures, leaving feet visible. Both labeled mobile poses have dedicated screenshots. Lint and the production build, including strict TypeScript, pass after this visual polish. `git diff --check` passes.

Commands: `npm test`, `npm run test:worker`, `npm run db:test -- --migrations`, `npx playwright test --workers=1`, `npm run test:media -- --workers=1`, `npm run test:performance`, `npm run lint`, `npm run typecheck`, `npm run build`. Production starts on `http://127.0.0.1:3000`.

## Local service recovery

Docker's stale socket-only directory was preserved as `C:\Users\ariel\AppData\Local\docker-secrets-engine.recovery-20261003`; Docker recreated it. Windows excluded TCP 54298–54397, including the previous Supabase ports. Project API/database ports moved to 15421/15422. A data-preserving `supabase stop`/`start` retained backup volumes and development records; ignored local environment settings were synchronized and the app rebuilt. Database checks read the configured port. No database reset was used.

References: [Docker socket issue](https://github.com/docker/for-win/issues/15064), [data-preserving Supabase stop](https://supabase.com/docs/reference/cli/v0/supabase-orgs#supabase-stop).

## Push verification, 4 October 2026

Fresh checks pass: lint, strict TypeScript, production build, 330 unit tests, 24 worker tests, 477 database assertions with all migrations replayed, all 47 browser tests, real media publication/playback, and production performance budgets. The anatomy asset check confirms all 2,352 buffer views and its recorded fingerprint.

Local curation scripts now retain render claim IDs in checkpoints, upload to claim-specific paths, and pass the current claim to completion. Legacy, expired and replaced claims stop before capture; revision cancellation also requires the matching live claim. Sixteen script regressions cover these boundaries. No development database reset was used.
