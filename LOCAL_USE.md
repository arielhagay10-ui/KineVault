# Using KineVault on this computer

Open **http://127.0.0.1:3000**. No hosted application or database is required.

## Start

Keep Docker Desktop running. From the project folder:

```sh
npx supabase start
npm run dev
```

In a second terminal:

```sh
npm run render:worker
```

The ignored `.env.local` supplies local Supabase and renderer settings. Workers need the service key and renderer token; neither belongs in public variables or commits. Rendering processes queued submissions while the app runs.

For the optimized app, use `npm run build` then `npm start`. App commands bind to this computer's loopback address. Leave the app and renderer terminals open; Ctrl+C stops each process.

## Account and review access

1. Open `/sign-up` and create your account. Local development does not require confirmation email.
2. Run `npm run setup:admin` and enter that email in the terminal. This local-only command grants the first admin role and records an audit event. It refuses to run once an admin exists.
3. Open `/admin`. Later role assignments use the Roles page with a reason.

Development tests create synthetic accounts and exercises. These are fixtures, not a curated launch catalog.

## Original catalog

`/admin/candidates` lists the 20 original candidates. Choose **Prepare demonstration**, refine the private copy, save its motion, and submit it. Reviewers inspect the render, correct classifications with a reason, and approve the original candidate. Its UUID, URL, and existing relationships are preserved. Preparation alone does not publish anything.

The original figure supports nine posed joints and dumbbell, barbell, or single-cable equipment. Some movements need richer equipment or rig assets before publication. Review demonstration clarity; biomechanical classifications are never inferred automatically.

## Sharing and notifications

Private links are revocable and require no sign-in. Friends on other devices cannot open these local links while the app stays on this computer. Public hosting can be added later.

Review updates appear in the account inbox. External emails require a verified sender and provider credentials; keep the email worker stopped until configured. No external review emails have been sent during development.

## Updates and checks

```sh
npx supabase migration up --local
npm run db:types
npm run lint
npm run typecheck
npm test
npm run db:test -- --migrations
npm run test:e2e
npm run test:media
```

Database checks rebuild only their new temporary database. Working records remain intact. `db:reset` erases local data and is unnecessary for routine updates.
