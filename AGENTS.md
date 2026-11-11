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

## Tooling routes

- When the user asks to open or show the workshop/editor, read and follow `C:/Users/ariel/.codex/skills/kinevault-open-workshop/SKILL.md` before using any workshop or browser tool. This applies to requests like "open the workshop" and "show the editor".
- Current dependency docs → `context7-cli` skill (`ctx7`).
- React/Next.js implementation → `vercel-react-best-practices`; route bundle audits → `next-bundle-optimizer` + `kinevault-bundle-audit`.
- Visual review or redesign → `kinevault-visual-review` with `frontend-design` or `web-design-guidelines` as needed.
- General browser work → `playwright-cli` skill; workshop interaction → Workshop MCP + `kinevault-workshop-qa`.
- Workshop playback/render performance → `kinevault-workshop-performance` + `kinevault-3d-workshop`.
- Database changes → official Supabase skills + `kinevault-db-migration`; security-sensitive changes → `kinevault-security-review`.
- Exercise classification → `kinevault-biomechanics-review`; 3D runtime/assets → `kinevault-3d-workshop` / `kinevault-3d-asset-pipeline`.
- Equipment concepts, reference photos, grips or seated posing → `C:/Users/ariel/.codex/skills/kinevault-equipment-quality/SKILL.md`.
- Verification and release checks → `kinevault-change-verification` / `kinevault-release-readiness`.

## Skill routing and writing preferences

- Coding tasks, including implementation, fixes, refactors and reviews → `ponytail`. Keep changes simple and maintainable without cutting validation, error handling, security, accessibility or needed tests.
- Prose, including docs, comments and commit/PR text → `unslop`. For code plus prose, use Ponytail for code and Unslop for writing.
- Omit tool or agent authorship and co-author trailers from project artifacts. Add them only when explicitly requested.
