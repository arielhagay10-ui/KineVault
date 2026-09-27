# Moderation

Private drafts remain private until their owner explicitly submits a fixed copy. A complete motion scene is required. Submissions move through submitted, in review, changes requested, approved, rejected, merged or withdrawn. A requested change creates a linked new contributor revision; the prior snapshot and events remain in the audit trail. Reviewers may correct classifications in a separate editorial copy, with each correction recorded, while preserving the original.

Reviewers inspect metadata, duplicate candidates and the complete character motion, including angle clarity and equipment alignment. Rendered WebM, MP4 and poster files remain private during review. A public exercise requires at least one clear approved demonstration. Fuzzy duplicate scores are review aids, not automatic rejection rules. A merge may add an alias or relation to an existing canonical exercise and always preserves provenance. Public motion may be copied into a private draft only when the contributor granted reuse consent.

Every transition writes an immutable `moderation_events` row. Approval and merge must update canonical content, versions, media visibility, provenance and search indexing transactionally. Role checks run in server mutations and RLS; hiding controls in the UI is insufficient.
