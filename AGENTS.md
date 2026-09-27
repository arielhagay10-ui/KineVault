# Repository Guidelines

## Project Structure & Module Organization

KineVault is a community exercise encyclopedia, not a workout tracker. Currently, only `SPEC.md` defines the product; application code, tests, assets, and tooling have not been created. Treat it as the implementation reference.

When scaffolding the specified Next.js App Router application, use this proposed layout:

- `src/app/`: routes, layouts, and server endpoints.
- `src/components/`: shared React components and shadcn/ui primitives.
- `src/lib/`: validation, search, authorization, and Supabase clients.
- `supabase/migrations/`: schema, indexes, and RLS policies.
- `supabase/seed.sql`: original demo data.
- `public/`: static assets; `tests/`: integration and Playwright tests.

## Build, Test, and Development Commands

No package manifest or runnable commands exist yet. When scaffolding, define and document these proposed npm scripts:

- `npm run dev`: start local development.
- `npm run build`: build the production application.
- `npm run lint`: check lint rules.
- `npm run typecheck`: check strict TypeScript without emitting files.
- `npm test`: run Vitest unit/integration tests.
- `npm run test:e2e`: run Playwright flows.

Run lint, type checking, and relevant tests after each implementation phase; fix failures before proceeding.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, PascalCase React components, and camelCase functions and variables. Use snake_case SQL identifiers, UUID record IDs, and readable URL slugs. Validate inputs with Zod. No formatter or linter is configured yet; establish shared configuration during scaffolding.

Keep muscles, joints, joint actions, and movement patterns as separate normalized taxonomies. Execute filtering and pagination in PostgreSQL; encode filters in URL parameters.

## Testing Guidelines

Use Vitest (`*.test.ts`) and Playwright (`*.spec.ts`). No numeric coverage threshold is specified. Cover ownership, role authorization, moderation transitions, duplicates, and combined filters. Include the specified Explore flow: Shoulder Abduction + Cable, matching results, then exercise details.

## Commit & Pull Request Guidelines

No Git history exists to establish conventions. Use concise imperative commit subjects, such as `Add joint-action filtering`. Keep changes scoped. PRs should describe behavior, reference relevant specification sections or issues, report checks, and include screenshots for UI changes and migration notes for schema changes.

## Security & Content

Enforce authorization server-side and through Supabase RLS. Keep secrets out of commits. Publish submissions only after approval and preserve audit history. Use original or properly licensed descriptions and media.
