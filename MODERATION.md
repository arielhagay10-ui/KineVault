# Moderation

Private drafts remain private until their owner explicitly submits a fixed copy. A complete motion scene is required. Submissions move through submitted, in review, changes requested, approved, rejected, merged or withdrawn. A requested change creates a linked new contributor revision; the prior snapshot and events remain in the audit trail. Reviewers may correct classifications in a separate editorial copy, with each correction recorded, while preserving the original.

Reviewers inspect metadata, duplicate candidates and the complete character motion, including angle clarity and equipment alignment. Rendered WebM, MP4 and poster files remain private during review. A public exercise requires at least one clear approved demonstration. Fuzzy duplicate scores are review aids, not automatic rejection rules. A merge may add an alias or relation to an existing canonical exercise and always preserves provenance. Public motion may be copied into a private draft only when the contributor granted reuse consent.

Every transition writes an immutable `moderation_events` row. Approval and merge must update canonical content, versions, media visibility, provenance and search indexing transactionally. Role checks run in server mutations and RLS; hiding controls in the UI is insufficient.

Starting review assigns the current reviewer and creates the editorial copy. Only that reviewer or an admin can resolve or edit it. Direct editorial writes are blocked by RLS. The correction RPC validates controlled taxonomy values, persists normal relational records, preserves relation notes, and records changed fields in `moderation_field_changes`. Contributors see the same before/after audit values in their submission history.

Approval requires family, a primary muscle, a primary joint action, and complete rendered WebM/MP4/poster output. Storage copies are staged privately; the database verifies those objects and freezes a new published content version. Canonical publication, variation relationship, audit history, and search refresh commit together. A slug collision rolls back the decision.

A duplicate merge retains the existing exercise identity, classifications, relationships, and demonstration. It appends the submitted name as an alias in a new immutable version and records the merged submission. Motion provenance remains attached to its original contributor; alias contributors cannot change the original reuse consent. Legitimate variations use approval with a variation relationship.

Decision notifications are queued in the same transaction. Email runs asynchronously and cannot undo moderation. The account inbox remains available when delivery fails. Old decisions are not automatically backfilled into the mail queue.

## Original catalog candidates and aliases

Reviewers prepare seed candidates from `/admin/candidates`, then use the same private-motion and submission workflow. Approval may explicitly publish the original candidate, preserving its canonical identity, slug and relationships. New standalone publication remains available with a distinct slug. Already published or mismatched targets are rejected.

Aliases can be added, corrected or removed in editorial content with an audit reason. Contributor aliases also participate in duplicate comparisons; exact/alias matches remain review aids. Timed-note corrections use a separate audited action so original annotations stay unchanged. Unlink an annotation before removing its classified action.
