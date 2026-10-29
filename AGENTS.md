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

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->

## Tooling routes

- When the user asks to open or show the workshop/editor, read and follow `C:/Users/ariel/.codex/skills/kinevault-open-workshop/SKILL.md` before using any workshop or browser tool. This applies to requests like "open the workshop" and "show the editor".
- Repository discovery and blast radius → Graft.
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
