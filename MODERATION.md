# Moderation

Private drafts remain private until their owner explicitly submits a fixed copy. Submissions move through submitted, in review, changes requested, approved, rejected, merged or withdrawn. A requested change creates a new contributor revision; the original submission remains in the audit trail. Reviewers can edit a separate editorial copy and publish corrections while preserving the original.

Reviewers inspect metadata, duplicate candidates and the complete character motion, including angle clarity and equipment alignment. A public exercise requires at least one clear approved demonstration. Fuzzy duplicate scores are review aids, not automatic rejection rules. A merge may add an alias or relation to an existing canonical exercise and always preserves provenance.

Every transition writes an immutable `moderation_events` row. Approval and merge must update canonical content, versions, media visibility, provenance and search indexing transactionally. Role checks run in server mutations and RLS; hiding controls in the UI is insufficient.
