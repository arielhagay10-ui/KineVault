# KineVault MVP implementation plan

## Product behavior

KineVault is a visual exercise encyclopedia, not a workout tracker. Explore lists each variation separately and shows its exercise family. Visitors can search and filter, watch a prepared character clip, inspect reviewed biomechanical information and motion poses, and copy an approved exercise into a private draft.

Signed-in contributors can keep exercises private indefinitely. In the workshop they pose an original stylized anatomical character at multiple keyframes, select equipment from an approved 3D library, preview motion and select a clear camera angle. Submission freezes a copy; the private draft remains editable. Contributors can replace metadata and the demonstration after a reviewer requests changes. Submitted copies are otherwise editable only by reviewers and admins.

Publication requires a clear character demonstration. Reviewers inspect every motion and may correct metadata, request changes, reject, approve or merge. Approved motions may be copied and remixed inside KineVault with visible source lineage. Searchable biomechanics are reviewer-approved metadata, not calculations inferred from the animation. Timed labels and highlights explain setup, joint actions and movement phases alongside the clip.

## Application and database architecture

- Next.js App Router, strict TypeScript, Tailwind CSS, shadcn/ui, Zod, Supabase Auth, PostgreSQL and Storage. Use server components for public reads, focused client components for filters and the workshop, and server routes/actions for mutations. Authorize each mutation server-side and with database grants and RLS.
- `exercise_families` are movement concepts. Public `exercises` are stable UUID/slug identities, each with independent normalized biomechanics. `exercise_relations` represents an acyclic, single-parent `VARIATION_OF` tree and typed cross-links. `exercise_versions` records immutable published states and provenance.
- A shared normalized exercise-content model supports private drafts, immutable submission snapshots, reviewer-edited copies and public versions. The current searchable content uses junctions for muscles and roles, joints, joint actions and roles, equipment, attachments and movement patterns. Historical snapshots may use JSON for audit display, but never as the current filter source.
- Normalize `muscles`, `joints`, `joint_actions`, `equipment_categories`, `equipment`, `attachments`, `movement_patterns` and `exercise_families`. Keep role, resistance profile, peak position, mechanic, force type and laterality as controlled values; use lookup tables where admin editing or future extension matters. Keep confidence and reviewer notes with resistance classifications.
- Keep rig motion separate from anatomical classification: versioned `rigs`, `rig_joints`, `equipment_assets`, `exercise_scenes`, `scene_equipment`, `motion_keyframes`, `motion_joint_poses` and timed annotations. Store joint transforms as typed numeric fields linked to rig joints. Rig joints are not anatomical joint-action records.
- `profiles` and database-managed `roles` link to Supabase Auth. New accounts receive `user`; only admin operations grant `reviewer` or `admin`. Public reads expose published content only. Owners control private drafts and see their submissions; reviewers see moderation records; admins manage taxonomies and roles. RLS and Storage policies back every access rule. Privileged functions live outside exposed schemas.
- One search document per published exercise combines weighted name, aliases and description full-text terms. PostgreSQL GIN/trigram indexes support text queries. SQL `EXISTS` filters avoid join fan-out. Different groups combine with AND; every selected value within a group must match. Apply stable cursor pagination to IDs, then batch-load details. Keep URL parameters validated with Zod. Measure query plans with at least 50,000 exercises.
- Duplicate detection compares normalized names/aliases, trigram candidates, family and relational overlaps. Show heuristic scores, never auto-reject fuzzy matches. A contributor identifies a duplicate or variation before submitting.
- Submitted scenes render through a queued worker using only approved rig and equipment assets. Store private source and output until approval; publish WebM, MP4 and poster with source, license, rig version, camera and lineage metadata. Retain editable source. Keep submission media private through Storage RLS.

## Milestones and gates

Before Phase 1, initialize Git, add `.gitignore`, commit the specification and plan, and create a private `KineVault` GitHub repository under the owner's account. Add CI as scripts become available.

After **each milestone**, run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`, plus relevant Playwright and database/RLS tests. Fix failures before advancing.

### Phase 1 — Foundation and database

1. Scaffold the application, strict tooling, scripts, environment templates and CI. Test a clean build.
2. Migrate normalized taxonomies, content, canonical identities, versions, relations, moderation, rig and scene tables. Test keys, checks, cycles, immutability and migration reset.
3. Wire Auth, profiles, roles, grants and RLS. Test anonymous, owner, reviewer and admin access directly against PostgreSQL.
4. Create an original rig and essential equipment assets as a feasibility proof. Seed about 20 original exercise records and accurate classifications; publish only those with approved original demonstrations. Document architecture, schema and classification rules.

### Phase 2 — Exercise database, search and filtering

1. Build public Explore, family, exercise and joint-action pages with responsive states.
2. Add indexed name/alias/description search, URL filters and cursor pagination.
3. Add individual variation results, related exercises, timed labels and mobile filters. Test combined ALL semantics and the Shoulder Abduction + Cable → exercise detail flow.

### Phase 3 — Accounts, favorites and private exercises

1. Add sign-in, account pages, favorites and private exercise CRUD. Test ownership and favorite counts.
2. Build the pose-keyframe workshop, interpolation, approved equipment placement, camera selection, preview and draft persistence. Test pose and equipment round-trips.
3. Add public motion inspection and copying into private drafts with source lineage. Test copy isolation.

### Phase 4 — Community submissions and duplicate detection

1. Add validation, taxonomy suggestions, immutable submission snapshots and contributor reuse consent.
2. Add duplicate/variation comparison and user confirmation. Test deterministic ranking and exact/alias matches.
3. Add render jobs and WebM/MP4/poster output; require at least one clear demonstration. Test failures, retry and privacy.
4. Add submit, withdraw and revision-after-request flows. Test transitions and snapshot isolation.

### Phase 5 — Admin moderation

1. Build queue and original-versus-edited metadata/motion comparison.
2. Add corrections, media/angle requests, approval, rejection and immutable event history.
3. Add merge, alias, relations, provenance and atomic canonical publication/versioning.
4. Add admin taxonomy and asset-library management. Test every role, transition, merge and publication outcome.

### Phase 6 — Media, polish, tests and optimization

1. Complete original launch assets and demonstrations; optimize playback and workshop performance.
2. Finish accessible light/dark UI, mobile states and README, ARCHITECTURE, DATABASE, BIOMECHANICS and MODERATION documentation.
3. Run full unit, database/RLS and Playwright suites, including the specified Explore flow.
4. Benchmark at least 50,000 generated exercises, tune measured bottlenecks, verify render throughput, deploy app and worker, and run production smoke tests.

## Risks and flexible decisions

Original 3D art quality, joint editing on mobile, render reliability, media rights and many-to-many query performance are delivery risks. Keep rig and media versions stable, taxonomy IDs independent of labels, and search documents replaceable. Future languages, avatars, joint-angle analysis, resistance curves and API subscriptions remain outside the MVP.

## Specification Questions / Recommended Changes

- Move the character workshop and WebM/MP4 rendering into the MVP; `SPEC.md` currently places these in future work.
- Require one clear character demonstration for publication. Additional angles and body options are optional; reviewers can request a clearer view.
- Separate private-draft and submission state machines. Preserve an independently editable private copy after submission.
- Define public motion reuse as in-app copying with source lineage and explicit contributor consent.
- Treat timed biomechanical labels as reviewed annotations, not automatically derived classifications.
