# Local operations review, 22 October 2026

Status: NO-GO for public launch. Local app liveness and recovery drills passed, but the existing worker queues fail the health gate. This review does not establish external backups, email delivery or alert receipt.

## Verified

| Check | Result | Local evidence |
| --- | --- | --- |
| App liveness | `/api/health` passed on the production preview at port 3002 | `.local-artifacts/operations/434809e8-5420-4571-946f-bb71d1e4bc4a/health.json` |
| Database recovery and upgrade | Synthetic prior-schema backup restored and upgraded through `20261021154657`; record fingerprints, ownership and worker database checks passed. Temporary databases removed | `.local-artifacts/operations/20e8c434ba864cceb4e43313ef653c35/database-recovery.json` |
| Storage recovery | Real WebM, MP4 and WebP bytes restored with matching checksums; signed access passed; anonymous, invalid-signature and public access denied. Disposable bucket removed | `.local-artifacts/operations/d5af5f72-4d94-4345-a0c7-8bfb0d8adafb/storage-recovery.json` |
| Worker/tool regressions | 71 tests passed | `npm run test:worker` |

The drills create their own synthetic data. They do not restore development rows, verify real backup retention, or prove recovery of a remote project. The latest synthetic database restore/verification took 5.475 seconds and Storage restore/verification took 0.094 seconds; these single local runs are not production recovery guarantees.

## Queue finding

Read-only aggregates at 17:14 UTC found 191 queued renders, seven failed renders and 273 queued notifications. No running/sending jobs or stale leases were observed. The oldest render was about 21.8 days old; the oldest due notification was about 24.2 days old. A process snapshot found no local render or notification workers running.

Sanitized triage found 70 queued renders associated with reserved test-domain creators and 121 with other accounts. Six failed renders belong to other accounts, one to a reserved test-domain creator. Two queued renders retain a prior `render_error`; failed-job codes were redacted rather than exposed. The remaining labels do not identify the original failure cause.

All 273 queued notification recipients matched reserved example domains at inspection. This does not authorize sending them or discarding their delivery history. Tests can add fixture deliveries, so counts may change. No queue status, recipient or existing job was modified by this review.

## Next operational step

Review the existing backlog against its owners and intended content. Retain audit history and retry relevant work through the application's normal worker/review flow. Archive or remove obsolete fixtures only after identifying their provenance and an authorized cleanup method. Do not change queue thresholds merely to obtain a green result.

Use a dedicated local/staging queue for the next supervised worker rehearsal. Verify render restart/retry and a consented notification inbox there before enabling delivery. The successful test-fixture renders demonstrate the worker can complete individual local jobs; they do not prove a supervised worker is continuously processing this backlog.

Keep the existing deployment gates in [deployment readiness](deployment-readiness.md). Select the correct target before applying migrations or configuring SMTP. Database backup and Storage object backup remain separate requirements.
