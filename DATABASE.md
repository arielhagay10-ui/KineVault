# Database

Migrations live in `supabase/migrations/`; original development data lives in `supabase/seed.sql`.

## Main relationships

- `exercise_families` classify broad movement concepts. `exercises` are stable public identities with unique slugs and a pointer to current content.
- `exercise_relations` links public exercises. `variation_of` forms a single-parent, acyclic tree; other relation types are queryable cross-links.
- `exercise_content` holds version-specific scalar fields. `exercise_muscles`, `exercise_joints`, `exercise_joint_actions`, `exercise_equipment`, `exercise_attachments` and `exercise_movement_patterns` hold filterable classifications. `exercise_biomechanics` holds controlled biomechanical values and review notes.
- `private_exercises` owns editable private content. `exercise_submissions` references fixed original content and a separate editorial copy; `revision_of_id` links a later snapshot after requested changes. `exercise_versions` retains published history.
- `exercise_scenes`, `motion_keyframes` and `motion_joint_poses` describe character movement. Their rig joints are not the anatomical `joint_actions` taxonomy.
- `moderation_events` records each state transition; `moderation_reviews` stores decisions and reasons. `favorites` updates a maintained count on the canonical exercise.
- `taxonomy_suggestions` keeps proposed values attached to a submission without changing global taxonomies. `render_jobs`, `exercise_media` and `submission_media` track private outputs before approval.
- `moderation_field_changes` stores immutable before/after audit snapshots, while current classifications remain relational. `admin_events` records taxonomy, role, and asset availability changes. Hierarchical taxonomies reject cycles and saved slugs cannot change.
- `exercise_scenes.motion_source_submission_id` identifies the motion contributor separately from alias/version provenance. Media metadata can reference one immutable Storage object from several published versions.
- `notifications` is an owner-only account inbox. `notification_deliveries` is a restricted transactional outbox with leased claims, frozen provider payloads, backoff, and bounded retries.

## Security

Every application table has RLS enabled. Public taxonomy and published-catalog reads are allowed to anonymous visitors. Owners control private drafts and see their submissions. Reviewers see submission material. Admins manage taxonomies and roles. Direct public-catalog writes are not granted to ordinary users. Privileged helpers are in the unexposed `private` schema. Storage policies let only the submitter or a reviewer read private render objects; service-only RPCs scope worker reads to a claimed job.

Editorial content can be changed only through audited review RPCs. Reviewers may read historical published versions, but visitors see the current canonical version. Both media buckets are private: the catalog bucket's read policy requires a current published exercise reference before issuing a signed URL. Anonymous visitors cannot sign staged or withdrawn-only objects.

## Publication rule

Seed records are `pending_media` and are not public. A public record needs a reviewed original character demonstration, approved content version, provenance, and an atomic search update before `published` status.
