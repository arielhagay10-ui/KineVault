# Implementation status

## Implemented locally

- Phases 1–4: foundation, normalized catalog/search, accounts/favorites/private motion/sharing, submissions/duplicate comparison/rendering.
- Phase 5: assigned review queue, original/editorial/revision comparisons, audited corrections and decisions, atomic approval/alias merge, published metadata revisions, taxonomy/asset/role management, account notifications and retryable email outbox.
- Phase 6 application work: neutral anatomy-reference styling, light/dark/system appearance, mobile filters, complete contributor instructions/classifications/aliases, audited relational movement notes, grouped media selectors, reduced-motion behavior, lazy 3D inspection, original candidate preparation, and measured search optimization.
- Local setup/start guides and first-admin bootstrap. Hosting is deferred at the owner's request.

## Verified checks

- All 37 migrations apply to an empty application schema in an isolated database.
- 237 PostgreSQL assertions across 17 files cover authorization, ownership, relational integrity, search, favorites, duplicate aliases, submission snapshots, audit events, moderation transitions, candidate publication, and notifications.
- 18 unit tests across 7 files.
- 5 browser flows: URL filters, joint-action page, mobile appearance/filtering, private save/share/revoke, and reviewer corrections/account updates.
- A real-render browser flow: two original Chrome/FFmpeg renders, private Storage, approval, signed public playback, favorite/unfavorite, immutable public corrections, movement notes, reduced-motion pause, forced WebM failure with MP4 fallback, and Shoulder Abduction + Cable → matching result → exercise detail.
- Lint, strict TypeScript, optimized production build, and local production smoke checks pass, including health, browsing, protected admin access, invalid private links, and internal render authorization.
- A 50,000-exercise benchmark includes combined filtering, text/alias/fuzzy search, three sorts, no matches, and contributor-alias duplicate detection. See PERFORMANCE.md for measurements and limits.

## Content and configuration remaining

- The 20 original seed candidates need complete demonstrations and human biomechanical/content review before publication. The preparation and approval workflow is ready. The current nine-joint figure and three equipment assets cannot clearly demonstrate every listed exercise; richer assets remain content work.
- Your real account must be created and selected for the first local admin role. Test accounts are synthetic fixtures.
- External review emails require a verified sender/API key. Local account updates already work. External email delivery has not been exercised with real provider credentials.
- If public hosting is requested later: hosted Supabase/app/workers, HTTPS, verified Auth SMTP, backup/restore verification, monitoring, and broader workload/browser checks. Docker/Compose definitions are unverified deployment scaffolding.

SPEC.md remains unchanged. Product decisions and the local-only delivery scope are recorded in PLAN.md. See LOCAL_USE.md to run the app and curate candidates.
