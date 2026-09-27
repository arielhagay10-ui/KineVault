# Database

Migrations live in `supabase/migrations/`; original development data lives in `supabase/seed.sql`.

## Main relationships

- `exercise_families` classify broad movement concepts. `exercises` are stable public identities with unique slugs and a pointer to current content.
- `exercise_relations` links public exercises. `variation_of` forms a single-parent, acyclic tree; other relation types are queryable cross-links.
- `exercise_content` holds version-specific scalar fields. `exercise_muscles`, `exercise_joints`, `exercise_joint_actions`, `exercise_equipment`, `exercise_attachments` and `exercise_movement_patterns` hold filterable classifications. `exercise_biomechanics` holds controlled biomechanical values and review notes.
- `private_exercises` owns editable private content. `exercise_submissions` references fixed original content and a separate editorial copy. `exercise_versions` retains published history.
- `exercise_scenes`, `motion_keyframes` and `motion_joint_poses` describe character movement. Their rig joints are not the anatomical `joint_actions` taxonomy.
- `moderation_events` records each state transition; `moderation_reviews` stores decisions and reasons. `favorites` updates a maintained count on the canonical exercise.

## Security

Every application table has RLS enabled. Public taxonomy and published-catalog reads are allowed to anonymous visitors. Owners control private drafts and see their submissions. Reviewers see submission material. Admins manage taxonomies and roles. Direct public-catalog writes are not granted to ordinary users. Privileged helpers are in the unexposed `private` schema.

## Publication rule

Seed records are `pending_media` and are not public. A public record needs a reviewed original character demonstration, approved content version, provenance, and an atomic search update before `published` status.
