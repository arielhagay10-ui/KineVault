# KineVault

The 3D figure uses the bundled Z-Anatomy muscle/skeleton model (CC BY-SA 4.0), with BodyParts3D attribution (CC BY-SA 2.1 Japan). See `public/models/z-anatomy/ATTRIBUTION.md` and the upstream notices for sources and modifications. The viewer supports muscle groups, individual structures, isolation, and approximate posing with the existing workshop keyframes. It loads the 12 MB asset only when a 3D viewer opens. The render worker waits for the model before capturing frames and includes a source credit in exported images.

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

Signed-in users can save favorites, create private exercises, and copy published exercises into independent private drafts with source lineage. New exercises open directly in the motion workshop; saving creates the draft and scene atomically, then opens the information form. Drag the figure or equipment to move it; use Up/Down for height, Pose body for joints, and visible Hold buttons for left, right or both hands. Held weights drive the arms; cables follow the chosen hand. Both wrists support palm-up (supinated), neutral and palm-down (pronated) grips, flexion and tilt, including animated and held poses. Ankles support toe movement, foot turning and tilt. Knee controls show positive flexion up to 150 degrees, with extension limited to 5 degrees and no sideways twisting. Movement sensitivity defaults to 35% and is remembered in the browser; it controls dragging, gizmos and camera movement. Existing demo barbells become editable scene objects. X/Y/Z position controls stay visible; animation, rotation and resizing remain collapsed until requested. Add up to 20 original cable machines, adjustable benches, squat racks, barbells, or dumbbells. Joint poses remain relational keyframes; figure placement, equipment grips and equipment movement keyframes use validated `exercise_scenes.studio_layout` JSON. Layouts survive saving, sharing, submission snapshots and rendering. Apply migrations through `202609300047_ankle_controls.sql` before using the editor. A private exercise can have one active, revocable view link; anyone holding it can see its classifications and motion, while editing remains owner-only. The link is shown once when created. Replacing the link revokes the old one.

The workshop keeps its preview beside independently scrolling controls. Equipment placement is static until **Animate this item** is enabled; opening the timeline alone does not create equipment keyframes. Turning animation off keeps the selected moment as the static placement. Held weights explain and pause shoulder/elbow posing, with a **Release weight to pose arm** action. **Lock left/right elbow** captures the current elbow position relative to the figure: first position the upper arm on its support, then move the weight to curl. Locked weights follow the forearm's reach arc, including between keyframes, so the hand keeps contact. Locks do not automatically snap to a pad; incompatible supports report unreachable positions without stretching the arm. Benches expose a pad angle from 0° (flat) to 85°, independent of whole-object rotation. Highlights, isolation, camera view, support locks and bench angles survive saving, sharing and submission/render snapshots. Apply `202609300048_workshop_support_controls.sql` before saving these settings.

Cable controls offer **Beside left/right shoulder**, placing the pulley one meter laterally from the shoulder and following figure placement, bench seating and bench animation. Pulley height remains adjustable. Editing numeric placement or dragging the cable returns it to manual placement. **Frontal-plane lock** keeps both shoulders in sideways motion across all keyframes; elbow bends remain editable. Upper-arm cuffs offer shoulder and elbow shortcuts and remember their placement when switching attachments, including after saving. Apply `20260930194500_studio_alignment_and_plane.sql` before saving these controls.

The equipment library also includes a pulldown machine with a moving stack, a Smith machine with a guided bar, and a 45-degree leg press with a moving sled. **Use this machine** keeps the figure on its supports; edit **Machine travel** at each keyframe, or stop using the machine to pose freely. Pulldowns offer **Supinated** and **Pronated** grips. Pronated pulldowns keep shoulder motion in the frontal plane. Smith grips use separate wrist solving and articulated finger contact. Apply migrations through `20260930221640_pulldown_grips.sql` before saving machine scenes. `scripts/author-machine-drafts.mjs` creates private demonstrations for a verified local owner; it does not publish them. Local database records and rendered media are not included in a Git push.

Contributors can submit a private draft after saving a complete motion demo and either selecting or suggesting required classifications. Submission freezes a separate copy, records possible duplicates and reuse consent, and queues a private render. Requested changes create a linked new revision; the private draft remains editable.

The **Animate movement** timeline exposes **Edit keyframe**, **Delete keyframe**, and **Add keyframe** beside the selected moment. Edit selects the current machine, equipment, or body joint; its controls change that keyframe. Interior frames also offer **Frame time · seconds** and **Update time**, keeping linked equipment and phase markers aligned. Deleting Start or End promotes the next surviving pose to its boundary; at least two frames remain. Undo restores changes, and **Save scene** persists them privately.

## Render worker

Local Supabase Storage must be running. Set `SUPABASE_SERVICE_ROLE_KEY` in the ignored `.env.local` from local Supabase status and generate a random `RENDER_WORKER_TOKEN` of at least 32 characters. The app and worker must share that token. Set `RENDER_APP_URL` to the app origin. Keep both secrets out of client code and commits.

Run `npm run render:once` to process one queued job or `npm run render:worker` for continuous processing. The worker captures the Z-Anatomy scene with headless Chrome, encodes WebM, MP4 and a WebP poster with pinned FFmpeg, uploads to private Storage, then records the three assets in one database transaction. Rendered media includes anatomy attribution and ShareAlike license links. Failed jobs retry up to three times.

After applying migrations through `202609300041_full_body_render_credit.sql`, run `npm run render:refresh` against the local app to replace saved demonstrations with the corrected Z-Anatomy renderer. It uploads complete video/poster sets at versioned paths and switches readers through a replacement table; frozen source media and original files stay intact. The command resumes safely and reuses identical scene renders. Apply the migrations before starting the updated application.

To refresh selected published demos, pass `-- --slugs=dumbbell-shoulder-press,cable-lateral-raise,cable-triceps-pushdown`. The v4 renderer corrects press alignment, shoulder attachment weights, held D-handles, and bilateral straight-bar pushdowns facing the pulley.

For local demo curation, `node scripts/curate-local-demos.mjs prepare` prepares five original dumbbell/cable candidates through the normal submission workflow. Run `preview`, inspect the images in `.local-artifacts/catalog-curation`, then run `render` and `publish`. The manifest makes rendering/publication resumable. These steps require local Supabase, Docker, Chrome and the app; they refuse remote services. Media tests withdraw their published fixtures in `finally` so repeated runs do not fill Explore with duplicate test exercises.

Pass `--full-body` to each curation step for the second batch: incline dumbbell bench press, bent-over row, squat, Romanian deadlift and stationary lunge. Its separate manifest and previews live in `.local-artifacts/full-body-curation`. Explicit movement setups preserve foot contact and incline-bench placement through saving, sharing, review and video rendering. The stationary lunge demonstrates a split stance with a raised rear heel. These are simplified anatomical animations; they are not motion-capture recordings.

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
