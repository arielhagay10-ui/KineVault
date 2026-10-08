# Deployment readiness

KineVault currently runs locally. `Dockerfile` and `compose.production.yml` prepare a deployment, but this document does not certify a production environment. `ARCHITECTURE.md` describes the local delivery decision. Keep production credentials and evidence in ignored `.env.production.local` and `.local-artifacts/` files.

## Run the preflight

Use Node 24 and run from the repository root. The script reads only the process environment. It never loads `.env.local` automatically.

```powershell
node --env-file=.env.production.local scripts/check-deployment.mjs --target https://your-domain --json
node --env-file=.env.production.local scripts/check-deployment.mjs --target https://your-domain --evidence .local-artifacts/deployment/evidence.json --online --json
```

The first command is offline. The second makes four bounded GET requests to `/api/health`, `/exercises`, `/sign-in`, and Supabase `/auth/v1/settings`. It sends only the public API key, rejects redirects, and requires email confirmation. It does not send email, claim jobs, apply migrations, or query private records. Exit 0 requires every automated check and operator evidence record to pass; missing evidence or offline probes exit 1. `source: operator` means an attestation, not independently inspected proof. Error output omits env values, provider bodies and evidence contents.

Required configuration:

| Variable | Requirement |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Exact HTTPS origin matching `--target`, without credentials, path, query or fragment |
| `NEXT_PUBLIC_SUPABASE_URL` | Distinct HTTPS project origin |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key or legacy JWT with `anon` role |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret key or legacy `service_role` JWT |
| `RENDER_WORKER_TOKEN` | At least 32 characters, server-only |
| `RENDER_APP_URL` | HTTPS origin, loopback, or existing Compose destination `http://web:3000`; defaults to site origin |
| `RESEND_API_KEY` | Server-only notification provider credential |
| `NOTIFICATION_EMAIL_FROM` | Sender email, optionally `KineVault <reviews@your-domain>` |

Key format checks do not authenticate server credentials. Worker smoke evidence must establish those credentials work. Keep secrets out of every `NEXT_PUBLIC_*` value. Public values are compiled into the web build, so rebuild when changing them. `npm start` binds to loopback; Compose also publishes web only on host loopback. Provide a supervised HTTPS reverse proxy and verify its routing. Container health checks prove app liveness only.

## Migrations and release

1. Run lint, typecheck, all unit/worker tests, database checks, affected browser/media flows and a production build. Coordinate the build with active development servers. Preserve Shoulder Abduction + Cable -> results -> detail coverage.
2. Run `npm run db:test -- --migrations`. The existing harness replays migrations in a UUID-named temporary local database and runs pgTAP without resetting development records. Record its output as `emptyReplay` evidence. This proves a clean application schema replay, not an upgrade of production data.
3. Restore a representative prior deployment into a disposable isolated project. Apply the reviewed pending migrations there, check stored drafts/publication/audit history and authorization, and exercise affected browser/media flows. Record `upgrade` evidence. Never use `db reset` against development or production records.
4. Inspect CLI help and the selected project identity before remote commands. Use `npx supabase migration list --project-ref YOUR_REF` to collect the applied remote version set. Use `npx supabase db push --project-ref YOUR_REF --dry-run --skip-vault` for the pending migration plan. `--skip-vault` matters because CLI 2.118 can update Vault before migrations. These operator commands require configured project credentials; the preflight does not invoke them.
5. Have one deployer apply the reviewed migrations under the deployment's change procedure. Regenerate database types after schema changes. Confirm the remote version set equals the preflight's `migrationManifest.versions`. Re-run browser/media checks against the deployment and record the build identity and logs.

The manifest accepts this repository's legacy 12-digit versions and current 14-digit versions. It rejects duplicate versions, malformed names and empty files. Its SHA-256 digest includes sorted filenames and SQL hashes with normalized line endings. Changing any migration invalidates the associated evidence. Matching history alone does not prove schema equivalence; the upgrade record must include the actual schema and data checks. Supabase tracks applied versions separately from Git. See [database migrations](https://supabase.com/docs/guides/deployment/database-migrations).

## Backup and restore

Set recovery point and recovery time goals in minutes. Record the backup source, timestamp, retention, access owner, encryption and independent storage location. Inspect recent completed backups. Restore into an isolated project and measure actual data loss and elapsed recovery against those goals. Verify representative owners, drafts, submissions, publication versions, audit rows and authorization.

Back up both private media buckets separately, including object bytes and paths. Restore a sample WebM, MP4 and poster, check checksums, and verify signed access and publication visibility. A database backup contains Storage metadata, not the stored objects. See [Supabase backups](https://supabase.com/docs/guides/platform/backups). Record database and Storage drills separately. Retain evidence of the restore, not just a successful backup job.

## Monitoring and workers

Assign an alert owner and escalation route. Monitor HTTPS availability and latency, app errors, Auth errors/rate limits, database capacity, backup age/failure, render queue age/failures and notification delivery backlog/retries. Set thresholds appropriate to the deployment and record them in the alert artifact. Do not log mail content, bearer tokens, passwords or signed media URLs.

Test an alert through the real notification route with its operator, record receipt and recovery, and document the response procedure. Restart each worker in staging. Verify a render completes with WebM, MP4 and poster after retry, reload the saved scene, and confirm the worker can reach its render route. Verify a review produces an account notification and one delivered provider email. Check provider acceptance and recipient inbox separately. Record worker routing, restart supervision and queue health with the smoke evidence.

## Auth email delivery

Configure custom SMTP in Supabase Auth, verify the sending domain, and inspect SPF, DKIM, DMARC, quotas, bounce handling and provider events. The notification worker's Resend key does not configure Auth SMTP. Supabase's default SMTP is restricted and unsuitable for production. See [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Set Auth Site URL to the HTTPS site origin and allow the exact confirmation and recovery redirects used by `src/app/sign-in/actions.ts`. This app's `/auth/confirm` handler expects `token_hash` and `type=email` or `type=recovery`. Configure the signup and recovery templates accordingly, then verify rendered links. Supabase documents the `TokenHash` and `SiteURL` variables in [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

```html
<!-- Signup confirmation link -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirm account</a>
<!-- Recovery link -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=/reset-password/update">Reset password</a>
```

Use a consented test inbox outside the project's team. Create an account through the deployed UI, confirm receipt and login, request recovery, confirm receipt, change the password and sign in again. Check the destination origin, reused/expired links and the provider delivery event. Keep token-bearing URLs and inbox addresses out of shared logs. These actions create accounts and send mail; the preflight leaves them to the deployment operator. A reset form's generic success message is not delivery evidence.

## Evidence file

All fields below are required. Replace placeholders with actual values and artifact references; copy remote migration versions only after checking the selected project. Every proof needs `passed: true`, its own UTC `checkedAt`, and a private artifact reference. Restore proofs expire after 30 days; other proofs expire after 7 days. Future dates fail. Each reference should identify the target, release, operator, steps and observed results without secrets. Retain the referenced artifacts for review. The checker validates records but does not open their references or verify attestations cryptographically.

```json
{
  "version": 1,
  "operator": "deployment-owner",
  "siteUrl": "https://your-domain",
  "supabaseUrl": "https://your-project.supabase.co",
  "migrationDigest": "COPY_PREFLIGHT_DIGEST",
  "migrations": {
    "versions": ["COPY_EVERY_REMOTE_APPLIED_VERSION"],
    "emptyReplay": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/empty-replay-log" },
    "upgrade": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/upgrade-drill" }
  },
  "backups": {
    "rpoMinutes": 60,
    "rtoMinutes": 120,
    "databaseRestore": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/database-restore-drill" },
    "storageRestore": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/storage-restore-drill" }
  },
  "monitoring": {
    "alertDrill": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/alert-receipt" }
  },
  "auth": {
    "customSmtp": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/smtp-domain-check" },
    "redirectAllowlist": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/redirect-template-check" },
    "signupInbox": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/signup-inbox-and-login" },
    "recoveryInbox": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/recovery-inbox-and-password-change" }
  },
  "workers": {
    "renderSmoke": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/render-restart-smoke" },
    "notificationInbox": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/review-mail-inbox" }
  },
  "release": {
    "browserMedia": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/browser-media-results" },
    "productionBuild": { "passed": true, "checkedAt": "ACTUAL_UTC_TIME", "reference": "private/build-release-id" }
  }
}
```
