# Implementation status

## Implemented locally

- Phases 1–4: foundation, normalized catalog/search, accounts/favorites/private motion/sharing, submissions/duplicate comparison/rendering.
- Phase 5: assigned review queue, original/editorial/revision comparisons, audited corrections and decisions, atomic approval/alias merge, published metadata revisions, taxonomy/asset/role management, account notifications and retryable email outbox.
- Phase 6 application work: neutral anatomy-reference styling, light/dark/system appearance, mobile filters, complete contributor instructions/classifications/aliases, audited relational movement notes, grouped media selectors, reduced-motion behavior, lazy 3D inspection, original candidate preparation, and measured search optimization.
- Local setup/start guides and first-admin bootstrap. Hosting is deferred at the owner's request.

## Verified checks

Current checkpoint, October 1, 2026:

- Keyframe editing/deletion: 26 relevant unit checks and the browser save/reload flow pass, including timing collisions, machine travel/body pose editing, Undo, minimum-two-frame protection, and sparse Start/End sampling. Existing machine and private-exercise browser flows also pass. Final lint, strict types, production build, and whitespace checks pass. No database migration is required.

- All 53 migrations apply to an empty application schema in an isolated database. All 360 PostgreSQL assertions across 25 files pass, including pulldown grip validation, scene cloning/sharing, and owner-only editing.
- Prior full regression checkpoint: all 106 unit tests across 20 files pass (bounded to two workers), including full-cycle machine contact and actual skinned Smith/pronated fingertip geometry. Independent transformed-machine checks also pass.
- Prior full browser checkpoint: all 16 browser flows pass in a complete two-worker run. The initial seven-worker run had one private-review navigation timeout; the isolated retry and complete bounded run pass.
- The machine browser flow passes for supinated and frontal pronated pulldowns, Smith machine sissy squat, and leg press. It checks playback, travel/grip edits, saving/reloading, free-pose release, mobile overflow, and immutable submission snapshots. It captures nine moments from side and three-quarter views, plus frontal views for the pronated pulldown. Saved demonstrations include their neutral torso base pose so submission readiness accepts the machine-driven motion.
- The real-render browser flow passes against the current renderer: Chrome/FFmpeg, private Storage, approval, signed playback, MP4 fallback, and combined Explore filtering.
- Lint, strict TypeScript, production build, and whitespace checks pass.

Earlier local milestone checks below have not all been rerun against the accumulated workshop changes:

- Lint, strict TypeScript, optimized production build, and local production smoke checks pass, including health, browsing, protected admin access, invalid private links, and internal render authorization.
- A 50,000-exercise benchmark includes combined filtering, text/alias/fuzzy search, three sorts, no matches, and contributor-alias duplicate detection. See PERFORMANCE.md for measurements and limits.

## Content and configuration remaining

- Remaining catalog candidates need complete demonstrations and human content review. The workshop now includes 13 joint controls, adjustable benches, cables, weights, and guided machines; unsupported movements still need appropriate assets and motion.
- Supinated Lat Pulldown, Frontal Lat Pulldown, Smith Machine Sissy Squat, and 45-Degree Leg Press are editable private drafts in the local contributor account. They are not published or submitted. Other unfinished drafts, including the preacher-curl study, still need review.
- Before uploading the current code: review the accumulated tracked/untracked changes and model attribution, then create a reviewed commit including required assets and migrations. A Git push does not transfer local draft records or Storage media.
- External review emails require a verified sender/API key. Local account updates already work. External email delivery has not been exercised with real provider credentials.
- If public hosting is requested later: hosted Supabase/app/workers, HTTPS, verified Auth SMTP, backup/restore verification, monitoring, and broader workload/browser checks. Docker/Compose definitions are unverified deployment scaffolding.

SPEC.md remains unchanged. Product decisions and the local-only delivery scope are recorded in PLAN.md. See LOCAL_USE.md to run the app and curate candidates.
