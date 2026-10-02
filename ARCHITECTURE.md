# Architecture

Next.js App Router serves public encyclopedia routes and authenticated workflows. Server mutations validate inputs with Zod and authorize the active user. Supabase Auth provides identity; PostgreSQL grants and RLS enforce the same access rules even when a client reaches the Data API directly.

The database distinguishes an exercise family from a canonical exercise and a version of its content. Private drafts, submitted snapshots and editorial copies share normalized content and taxonomy junctions. Publication creates an immutable version and updates the canonical exercise pointer in one transaction. Search reads only published canonical records.

Private draft saves run in a single PostgreSQL RPC that verifies authenticated ownership before changing normalized content. Direct client writes remain subject to RLS. Share links contain 256-bit random tokens; the database stores only their SHA-256 hashes. An anonymous, read-only RPC returns the draft fields for a valid active link. Rotating or revoking a link ends access without changing the draft. Shared pages are never indexed or cached.

The workshop uses the bundled Z-Anatomy model with an approximate runtime rig and original equipment assets. Named muscles remain independently selectable; each viewer owns its posing, materials and visibility. Elbow flexion points forward; wrist and finger bones close the hands around dumbbell handles. Motion keyframes and rig-joint poses describe what the character shows. Anatomical joint actions and resistance profiles are separate, reviewer-approved classifications. Submission freezes an independent normalized content and scene snapshot. A worker claims a render job through a service-only RPC, reads only that job's scene, waits for the anatomy model, captures attributed frames in Chrome, encodes WebM, MP4 and poster files, and uploads them to private Storage. Completion verifies all three objects and records them transactionally. Approval stages catalog copies in a second private bucket; its read policy permits signing only after canonical publication. Renderer refreshes append complete, versioned storage replacements without changing frozen media or deleting original files; signing, thumbnails and publication staging resolve the replacement paths. Private replacement records require authenticated content access, and public replacements require a published exercise. Motion copying follows the original motion contributor's consent, including after alias merges. Model attribution and ShareAlike terms are in public/models/z-anatomy/ATTRIBUTION.md.

Review decisions enqueue an account notification and transactional email in PostgreSQL. A separate worker freezes the mail payload and calls the provider with an idempotency key. Leased claims, backoff, and a bounded delivery window handle crashes and temporary outages. Worker RPCs expose only the claimed delivery; mail credentials are server-only.

Different Explore filter groups combine with AND; multiple selected values within a group must all match. PostgreSQL applies filtering and cursor pagination before the application loads related metadata. Indexes on both sides of junction tables support combined filters. Query plans were measured with 50,000 generated exercises; see [PERFORMANCE.md](PERFORMANCE.md). The public-only search RPC uses explicit publication/current-version predicates, fixed SQL identifiers, quoted input values, and indexed candidate sets. Direct reads retain RLS.

See [PLAN.md](PLAN.md) for milestones and deferred features.

## Local delivery decisions

The first version stays on the owner's computer. Application entry points bind to loopback. Hosting, SMTP and external mail configuration are deferred; account notifications work independently. Docker deployment definitions are prepared but unverified. A future public deployment must configure HTTPS, worker routing, SMTP, backups and operational monitoring.

Timed movement notes are relational rows linked to joint actions and scenes. Draft/reviewer RPCs enforce timing and classification membership; table triggers also protect direct writes. Remove a note's action link before removing its classification. Review corrections preserve submitted notes and record an immutable diff. Published video overlays use approved notes without regenerating identical frames.

Contributor/reviewer aliases are normalized relational rows, copied into immutable versions and included in search and duplicate comparison. Duplicate scores are heuristics, including matches between contributor aliases and canonical names.

Original seed candidates remain unpublished. A reviewer prepares an owned private copy with an immutable candidate reference; submission freezes that reference. Explicit approval can reuse the pending canonical UUID, slug and relations. Concurrent/stale approval cannot replace an already published candidate. Original content is retained separately from the approved immutable version.

Media groups support presentation/camera selectors when available, WebM plus MP4 fallback, signed URLs, credits, and timed notes. Video respects reduced-motion preferences. Public 3D inspection loads on demand and starts paused. Neutral theme tokens and a cookie-backed light/dark/system control cover the application.
