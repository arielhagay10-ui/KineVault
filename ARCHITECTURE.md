# Architecture

Next.js App Router serves public encyclopedia routes and authenticated workflows. Server mutations validate inputs with Zod and authorize the active user. Supabase Auth provides identity; PostgreSQL grants and RLS enforce the same access rules even when a client reaches the Data API directly.

The database distinguishes an exercise family from a canonical exercise and a version of its content. Private drafts, submitted snapshots and editorial copies share normalized content and taxonomy junctions. Publication creates an immutable version and updates the canonical exercise pointer in one transaction. Search reads only published canonical records.

Private draft saves run in a single PostgreSQL RPC under the caller's RLS identity. Share links contain 256-bit random tokens; the database stores only their SHA-256 hashes. An anonymous, read-only RPC returns the draft fields for a valid active link. Rotating or revoking a link ends access without changing the draft. Shared pages are never indexed or cached.

The workshop uses versioned, original rig and equipment assets. Motion keyframes and rig-joint poses describe what the character shows. Anatomical joint actions and resistance profiles are separate, reviewer-approved classifications. Submission freezes an independent normalized content and scene snapshot. A worker claims a render job through a service-only RPC, reads only that job's scene, captures frames in Chrome, encodes WebM, MP4 and poster files, and uploads them to private Storage. Completion verifies all three objects and records them transactionally. Approval stages catalog copies in a second private bucket; its read policy permits signing only after canonical publication. Motion copying follows the original motion contributor's consent, including after alias merges.

Review decisions enqueue an account notification and transactional email in PostgreSQL. A separate worker freezes the mail payload and calls the provider with an idempotency key. Leased claims, backoff, and a bounded delivery window handle crashes and temporary outages. Worker RPCs expose only the claimed delivery; mail credentials are server-only.

Different Explore filter groups combine with AND; multiple selected values within a group must all match. PostgreSQL applies filtering and cursor pagination before the application loads related metadata. Indexes on both sides of junction tables support combined filters. Query plans will be measured with at least 50,000 generated exercises.

See [PLAN.md](PLAN.md) for milestones and deferred features.
