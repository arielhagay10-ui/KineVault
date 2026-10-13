# Community publishing

The user approved immediate public publishing on 11 October 2026. This supersedes the requirement that every public exercise wait for admin approval. Saving remains private; Publish exercise is explicit.

Publication clones an owned draft into an immutable public version, preserves the private source, and is idempotent for that source. A name is required; classifications and rendered videos are optional. Saved scenes can be viewed directly. Private media must never become readable through publication. Existing reviewed publications remain verified.

Reviewers can verify, remove verification, hide, restore, and resolve reports. Every decision is audited. Signed-in members can report public entries. Verification is a quality signal, not publication permission. Hidden content disappears from public detail, search, and media access.

Recommended search preserves exact-name and exact-alias priority. Within that relevance tier, score is 6 for verification plus 3*ln(1+favorites), 2*ln(1+unique uses), and 0.25*ln(1+unique visitors), rounded to six decimal places for stable JSON pagination. Equal scores favor newer entries, then UUID. New exercises remain searchable and have a separate Newest sort. Alphabetical and Most favorited remain available.

Views count unique signed-in visitors after visible viewing, once per account and exercise. Uses count unique signed-in accounts copying an exercise, once per account and exercise. Creators do not contribute to their own counts. Counters are database-maintained and not directly writable. Unknown anonymous traffic is not counted. Ranking is calculated and paginated in PostgreSQL; cursors carry score and publication timestamp.

Equipment classifications show selected values with a collapsed Edit equipment control. Collapsed controls preserve submitted values and recovery. Body-position labels say Lying face up and Lying face down while retaining supine/prone taxonomy slugs.

Validation covers anonymous and cross-owner denial, publication privacy and immutability, idempotence, reviewer permissions, reports, hidden visibility, deduplicated engagement, relevance and pagination, combined filters, saved form selections, and browser publication/moderation flows. Preserve existing development records and apply additive reviewed migrations without reset.
