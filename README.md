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

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Database](DATABASE.md)
- [Biomechanics](BIOMECHANICS.md)
- [Moderation](MODERATION.md)
- [Product specification](SPEC.md)
