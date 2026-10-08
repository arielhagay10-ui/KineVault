# Operations validation

These checks produce local evidence without restoring over development data. Reports and synthetic backups live under ignored `.local-artifacts/operations/`. A local pass does not replace the deployment evidence required by `deployment-readiness.md`.

## Commands

Run from the repository root with Node 24 and the existing local Supabase stack. Coordinate Docker workloads with catalog measurements and builds.

```powershell
npm run recovery:database
npm run recovery:storage
npm run operations:check -- --target http://127.0.0.1:3000
npm run test:worker
```

Direct equivalents are `node scripts/drill-database-recovery.mjs`, `node scripts/drill-storage-recovery.mjs`, and `node scripts/check-operations.mjs --target http://127.0.0.1:3000`. Storage reads the supplied process environment and fills missing values from `.env.local` when present. The other commands require no credentials. Each script supports `--help`, writes a JSON artifact, and exits 1 on failure. Provider bodies, keys, email payloads and signed URLs stay out of diagnostic output.

## Database recovery and upgrade

The database drill reads only the local platform schema from `supabase_db_kinevault`. It creates two UUID-named databases, rebuilds the application schema through the prior migration, and adds synthetic taxonomy, draft, scene, submission, moderation-history and notification records. Development rows are never copied or changed.

It saves a custom-format `pg_dump` to disk, verifies its SHA-256, restores that file into the second database, compares representative table counts and row digests, applies the pending migrations, and repeats the comparison. Owner access must survive; the reviewer cannot read the owner's drafts. It then runs the real database assertions in `notifications.sql`, `render_claims.sql`, `submissions.sql` and `integrity.sql`. These cover backoff, stable notification identity, frozen payloads, expired worker leases, replacement render generations, stale callbacks and bounded retries. Cleanup drops only the two names created by this run, including after a failed check.

The default baseline is the penultimate local migration. To exercise several pending migrations, pass `--baseline-version VERSION`; choose a version compatible with the current seed and fixture APIs. The artifact binds the drill to the exact full migration manifest and records applied pending versions. Unsupported historical fixtures fail instead of claiming an upgrade pass.

The retained dump contains synthetic records. It is not an independent production backup, a production-data upgrade, or proof of retention/encryption/backup ownership. `syntheticDataLossSeconds` is zero when every fixture row survives. `backupAgeAtRestoreSeconds` measures the age of this fresh synthetic backup; `rtoSeconds` measures restore, upgrade and validation duration. Neither establishes a production recovery point objective.

## Storage bytes and private access

The Storage drill rejects remote origins and requires the running local Storage container. It creates one UUID private bucket, generates valid tiny WebM, MP4 and WebP fixtures, downloads each to an independent backup directory, and verifies bytes and SHA-256. It deletes the original objects, confirms a missing-object response, uploads the disk backups, and verifies downloaded and signed-access bytes again. Anonymous private downloads, public URLs and modified signatures must return documented authorization or missing-object statuses. Bare 400s, rate limits, server errors and transport failures fail the drill. Reports retain only numeric denial statuses. Cleanup removes only these three objects and this run's bucket. See [Storage error codes](https://supabase.com/docs/guides/storage/debugging/error-codes).

This tests the local Storage transport and recovery procedure. It does not restore production objects, certify existing exercise bucket policies, or prove published-media visibility. Existing media publication browser tests cover those policies separately. Keep production object inventories, independent backup location, access owner, encryption and retention evidence with the deployment's restore artifact. Supabase's [database backups](https://supabase.com/docs/guides/platform/backups) do not include Storage object bytes; [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) require authorized or signed access.

## Queue and health monitoring

`operations:check` queries aggregate counts in a read-only transaction with a five-second statement timeout. It records queued/running/sending/failed jobs, expired render/notification leases and oldest eligible backlog age. Any failed job, stale lease or backlog older than the configured limit fails the gate. The default age limit is 900 seconds; override with `--max-age-seconds N`.

The optional `--target` must be a local origin. Its bounded GET checks `/api/health`; redirects fail. Without a target the liveness check remains pending and the command exits 1. App liveness and queue health are reported separately. No job is claimed, retried or modified; no email is sent. Historical failures require operator triage. Do not erase them to make the monitor green.

These checks do not prove a supervised worker process restart, successful media encoding after a restart, provider email acceptance, inbox delivery or alert receipt. Record those against the actual deployment through the operator procedure in `deployment-readiness.md`.

## Read-only connected-project audit, 7 October 2026

The connected project `kkywpvkckxniriatelta` has four public tables, `profiles`, `roles`, `subscriptions` and `track_documents`, all with RLS enabled. Its two migration versions, `20261005150934` and `20261005152713`, are absent from the repository's 68-version exercise-schema manifest. All 68 local versions are missing remotely. This project cannot certify the exercise deployment or worker queues. Matching project name/status alone is insufficient.

The security advisor reports one warning for [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The performance advisor reports two informational [unused-index findings](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). The audit did not change settings or remove indexes.

The available rolling 24-hour log sources were PgBouncer and Postgres only. A snapshot counted 11,590 PgBouncer entries and five Postgres entries; the latter contained error-like text, but exposed severity/SQLSTATE fields were unavailable. These are text-mention counts, not a verified error rate. No Auth, Storage, notification delivery or worker-process log evidence was available. Inbox and alert receipt remain unverified.

The private summary is `.local-artifacts/operations/remote-audit/audit.json`. Only migration versions, table names, RLS counts, advisor summaries and aggregate log counts were retained. Remote migrations, SQL mutations, restores, SMTP settings and outbound emails were not run.

## Current local results

Targeted operations tests: eight passed, including rejection of server errors, rate limits and transport failures as denial evidence. Targeted ESLint: passed.

The fresh read-only development snapshot failed its queue gate: 90 queued renders, four failed renders, and 73 queued notifications. No expired leases were present. The oldest render backlog was about 6.8 days; the oldest eligible notification backlog was about 9.2 days. QA liveness at `http://127.0.0.1:3001` passed. No jobs were claimed or changed. Artifact: `.local-artifacts/operations/17901735-3a83-45ef-9f50-1c04dbfe53a4/health.json`.

The live database drill passed with the 68-version manifest. It restored an 889,277-byte custom-format dump, preserved all seven table fingerprints, retained owner/reviewer authorization, applied the final pending migration, and passed 59 database assertions. Restore, upgrade and verification took 4.904 seconds; both UUID databases were removed. Artifact: `.local-artifacts/operations/6713639828db41158eae932d19bd634a/database-recovery.json`.

The fresh live Storage drill passed for WebM, MP4 and WebP, including disk-backup checksums, absence after deletion, byte-preserving restore and signed access. Each anonymous/public request returned 404 and each modified-signature request returned 401. Restore and access verification took 0.086 seconds; cleanup passed and an independent read-only bucket-count query returned zero. Artifact: `.local-artifacts/operations/595ac5b5-5bb5-44a0-9cb6-efdf59b00e60/storage-recovery.json`.
