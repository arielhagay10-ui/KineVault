# Community publishing implementation plan

**Goal:** Publish exercises immediately, rank useful and verified entries higher, and simplify optional metadata.

**Architecture:** Keep immutable public snapshots and private editable sources. Add publication and moderation RPCs, then independent engagement and search ranking. Existing reviewer submission history remains valid.

**Spec:** [Community publishing](../specs/2026-10-11-community-publishing.md)

**Constraints:** Strict TypeScript, normalized taxonomies, explicit authenticated ownership and reviewer authorization, RLS, immutable audit, no database reset, no private media exposure.

- [x] Collapse equipment editing and clarify lying-position labels. Test selections, roles, recovery, and save/reload in a disposable browser fixture.
- [x] Add community publication migration and pgTAP coverage. Publish owned name-only snapshots; preserve idempotence and privacy. Add verification, reports, hide/restore, and audited decisions.
- [x] Add unique engagement storage, protected counters, and indexed generated discovery score. Count actual authenticated views/copies once, excluding creators.
- [x] Extend public search with Recommended sort and score/timestamp cursors. Preserve exact name/alias relevance, explicit sorts, all-value filters, and publication predicates. Test rank ordering, deduplication, authorization, hidden rows, and cursor boundaries.
- [x] Replace review-required entry points with explicit Publish exercise confirmation. Add public verification labels, reporting, reviewer decisions, and visible-view tracking.
- [x] Update product and architecture references. Review migrations, run isolated database tests, apply without reset, regenerate database types, then run lint, typecheck, all unit tests, affected browser/media flows, and build with development server stopped. Restart and confirm HTTP200.

Validation: 489 unit tests, 63 worker tests, 697 database assertions, affected publishing/private-form/moderation/catalog browser flows, real publication media playback, three axe scans, lint, TypeScript and production build passed. Final restarted-server publishing/catalog smoke: 4 passed; HTTP200. Recommendation pagination passed HTTP correctness checks on 10,000 synthetic exercises; all 19 HTTP load cases passed. Additive migrations applied locally without resetting development records. Copy provenance is protected, and recommendation scores use six decimal places to preserve JSON cursor boundaries.
