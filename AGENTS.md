# KineVault repository guidelines

Keep communication concise. KineVault is a community exercise encyclopedia.

## References and structure

`SPEC.md` defines the product; `ARCHITECTURE.md` describes the implementation; `DESIGN.md` defines the visual system; `docs/workshop.md` describes the current editor. Historical workshop proposals are in `docs/archive/workshop/`.

Next.js App Router routes/actions live in `src/app/`, shared React components in `src/components/`, validation/authorization/Supabase/motion in `src/lib/`, migrations/pgTAP in `supabase/`, workers in `scripts/`, and browser/media tests in `tests/`. Keep licensed assets in `public/`.

## Implementation and checks

Use strict TypeScript, two-space indentation, PascalCase components, camelCase functions, snake_case SQL, UUID records and readable URL slugs. Validate with Zod. Keep muscles, joints, actions and movement patterns normalized. Filter/paginate in PostgreSQL; encode catalog filters in URLs.

Use `package.json` scripts. After each implementation phase run lint, typecheck and relevant tests. Before delivery run all unit tests, database checks, affected browser/media flows and a production build. Keep screenshots/measurements in ignored `.local-artifacts/`. Coordinate builds with any active development server.

`npm run db:test` uses an isolated temporary database. Preserve development records; apply reviewed migrations without resetting the database. Regenerate `src/lib/database.types.ts` after schema changes. Cover ownership, authorization, moderation, duplicates and combined filters. Preserve Shoulder Abduction + Cable -> matching results -> exercise detail coverage.

## Boundaries

Enforce authorization in actions and RLS. Cache only public taxonomy data; scope identity memoization to one request. Keep secrets server-only and out of logs/commits. Publish submissions after approval and retain audit history. Use original/licensed content with attribution.

The workshop has one scene owner. Keep frame updates outside React state, solve poses before equipment/contact consumers, preserve recovery, release GPU resources. Verify saved/reloaded movement and rendered media after motion changes.

## Changes

Preserve unrelated work. Use concise imperative commit subjects. PRs explain behavior, checks, specification references, UI screenshots and migration/deployment notes.
