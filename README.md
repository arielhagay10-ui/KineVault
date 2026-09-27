# KineVault

A visual, community-reviewed exercise encyclopedia. The MVP is being built in the milestones in [PLAN.md](PLAN.md); it is not a workout tracker.

## Requirements

- Node.js 24 and npm
- Docker Desktop for local Supabase
- Supabase CLI (installed as a development dependency)

## Local development

```sh
npm ci
npx supabase start
npx supabase db reset
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
npm run build
```

The seed includes 20 original catalog candidates and normalized taxonomies. Candidates remain unpublished until original demonstrations are reviewed. Do not use copied descriptions or media from proprietary exercise databases.

## Public catalog

`/exercises` searches published exercise names, aliases and descriptions in PostgreSQL. URL filters cover muscle roles, joints and joint actions, families, movement, equipment, attachments, biomechanics and difficulty. Values within and across filter groups use ALL semantics. Results use cursor pagination. Public family, muscle, joint, joint-action and equipment pages link back to filtered Explore.

`npm run db:types` refreshes the generated Supabase types after schema changes. `npm run db:test` runs PostgreSQL and RLS checks. Browser tests require the local Supabase stack and `.env.local`.

Signed-in users can save favorites, create private exercises, and copy published exercises into independent private drafts with source lineage. The motion workshop saves nine named rig joints as relational keyframes and offers original dumbbell, barbell, and cable assets. A private exercise can have one active, revocable view link; anyone holding it can see its classifications and motion, while editing remains owner-only. The link is shown once when created. Replacing the link revokes the old one.

Contributors can submit a private draft after saving a complete motion demo and either selecting or suggesting required classifications. Submission freezes a separate copy, records possible duplicates and reuse consent, and queues a private render. Requested changes create a linked new revision; the private draft remains editable.

## Render worker

Local Supabase Storage must be running. Set `SUPABASE_SERVICE_ROLE_KEY` in the ignored `.env.local` from local Supabase status and generate a random `RENDER_WORKER_TOKEN` of at least 32 characters. The app and worker must share that token. Set `RENDER_APP_URL` to the app origin. Keep both secrets out of client code and commits.

Run `npm run render:once` to process one queued job or `npm run render:worker` for continuous processing. The worker captures the original 3D scene with headless Chrome, encodes WebM, MP4 and a WebP poster with pinned FFmpeg, uploads to private Storage, then records the three assets in one database transaction. Failed jobs retry up to three times. Publication will copy approved assets into the public bucket.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Database](DATABASE.md)
- [Biomechanics](BIOMECHANICS.md)
- [Moderation](MODERATION.md)
- [Product specification](SPEC.md)
