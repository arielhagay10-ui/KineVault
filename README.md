# KineVault

A visual, community-reviewed exercise encyclopedia. The local MVP follows [PLAN.md](PLAN.md); it is not a workout tracker. Start with [Local use](LOCAL_USE.md).

## Requirements

- Node.js 24 and npm
- Docker Desktop for local Supabase
- Supabase CLI (installed as a development dependency)

## Local development

```sh
npm ci
npx supabase start
npx supabase migration up --local
```

Copy `.env.example` to `.env.local`, then fill its public Supabase URL and anon key from `npx supabase status`. Keep the service-role key server-only.

Set `NEXT_PUBLIC_SITE_URL` to the application origin. The MVP uses Supabase email/password Auth. In production, enable email confirmation, configure custom SMTP, and set the confirmation and recovery email templates to reach `/auth/confirm` with `token_hash` and `type` so the server can establish a cookie session.

Use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` for the confirmation template and the same URL with `type=recovery&next=/reset-password/update` for recovery. Add the site origin to Supabase Auth redirect URLs.

```sh
npm run dev
```

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:media
npm run build
```

The seed includes 20 original catalog candidates and normalized taxonomies. Candidates remain unpublished until original demonstrations are reviewed. Do not use copied descriptions or media from proprietary exercise databases.

## Public catalog

`/exercises` searches published exercise names, aliases and descriptions in PostgreSQL. URL filters cover muscle roles, joints and joint actions, families, movement, equipment, attachments, biomechanics and difficulty. Values within and across filter groups use ALL semantics. Results use cursor pagination. Public family, muscle, joint, joint-action and equipment pages link back to filtered Explore.

`npm run db:types` refreshes the generated Supabase types after schema changes. `npm run db:test` copies the local schema into a temporary database, seeds it, runs PostgreSQL/RLS checks, then removes that temporary database. Existing development records remain intact. Apply new migrations with `npx supabase migration up --local`. Browser tests require the local Supabase stack and `.env.local`; `test:media` also requires Storage and render-worker secrets and exercises real Chrome/FFmpeg publication.

Signed-in users can save favorites, create private exercises, and copy published exercises into independent private drafts with source lineage. The motion workshop saves nine named rig joints as relational keyframes and offers original dumbbell, barbell, and cable assets. A private exercise can have one active, revocable view link; anyone holding it can see its classifications and motion, while editing remains owner-only. The link is shown once when created. Replacing the link revokes the old one.

Contributors can submit a private draft after saving a complete motion demo and either selecting or suggesting required classifications. Submission freezes a separate copy, records possible duplicates and reuse consent, and queues a private render. Requested changes create a linked new revision; the private draft remains editable.

## Render worker

Local Supabase Storage must be running. Set `SUPABASE_SERVICE_ROLE_KEY` in the ignored `.env.local` from local Supabase status and generate a random `RENDER_WORKER_TOKEN` of at least 32 characters. The app and worker must share that token. Set `RENDER_APP_URL` to the app origin. Keep both secrets out of client code and commits.

Run `npm run render:once` to process one queued job or `npm run render:worker` for continuous processing. The worker captures the original 3D scene with headless Chrome, encodes WebM, MP4 and a WebP poster with pinned FFmpeg, uploads to private Storage, then records the three assets in one database transaction. Failed jobs retry up to three times.

Approval stages copies in `exercise-public`, a private bucket whose read policy exposes only media linked to a published canonical exercise. Catalog pages batch-sign URLs for 15 minutes. Failed approval leaves staged files inaccessible to visitors.

## Administration

Create your first local account, then run:

```sh
npm run setup:admin
```

After this one-time bootstrap, use `/admin/roles`; role changes require a reason and are audited. `/admin/submissions` provides assignment, snapshot comparisons, corrections, decisions, and failed-render retry. `/admin/taxonomies` manages relational classifications. Saved taxonomy slugs stay fixed. `/admin/assets` enables or retires existing reviewed asset versions; saved scenes retain retired definitions.

`/admin/exercises` permits reviewed metadata corrections to published exercises. Every save creates a new immutable content version with a recorded reason and retains the original motion, media, and provenance. Stale forms cannot overwrite newer corrections.

## Review notifications

Every change request, approval, rejection, or merge creates an owner-only account notification and an email outbox entry in the same transaction. `/notifications` displays updates. The email worker requires `RESEND_API_KEY`, a verified sender in `NOTIFICATION_EMAIL_FROM`, and the HTTPS site origin. See the [Resend email API](https://resend.com/docs/api-reference/emails/send-email).

Run `npm run notify:once` or `npm run notify:worker`. The worker freezes each email payload, uses a stable provider idempotency key, and retries temporary failures with backoff. Automatic retries end after five attempts or a 23-hour delivery window. A `sent` outbox status means provider acceptance; delivery/bounce webhooks are a future operational extension. Unconfigured email does not block review or account updates.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Database](DATABASE.md)
- [Biomechanics](BIOMECHANICS.md)
- [Moderation](MODERATION.md)
- [Local use](LOCAL_USE.md)
- [Performance measurements](PERFORMANCE.md)
- [Product specification](SPEC.md)

## Local delivery status

Light/dark/system appearance, mobile filters, complete contributor metadata and aliases, audited timed notes, grouped media controls, and catalog candidate preparation are implemented. See [PROGRESS.md](PROGRESS.md) for verified checks and remaining content work.

Hosting is deferred at the owner's request. Docker/Compose files are future deployment scaffolding and have not been built or used for this local delivery. Keep credentials in ignored environment files. A future release needs verified Auth SMTP, transactional email configuration, backup/restore checks, and final content review.
