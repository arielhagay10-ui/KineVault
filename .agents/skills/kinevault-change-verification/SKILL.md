---
name: kinevault-change-verification
description: Use when selecting checks for changed KineVault files or affected behavior.
---

# KineVault change verification

Use Graft to map callers and affected systems for cross-cutting changes. Select checks by the changed surface; do not run the full expensive suite for a small isolated edit.

- TypeScript/React/routes: `npm run lint`, `npm run typecheck`, and focused Vitest tests.
- Worker scripts: `npm run test:worker` and focused worker tests.
- SQL/RLS/migrations: `npm run db:test -- --migrations`; use `npm run db:load` only for performance-relevant query changes.
- Browser/UI/auth/catalog/admin: focused `npm run test:e2e -- <spec>`; use `npm run test:readiness` for accessibility/readiness changes.
- Workshop motion/equipment/persistence: focused browser/media tests and Workshop MCP save/reload checks; use `npm run test:hardware` only for device-specific changes.
- Render/media pipeline: `npm run test:media`; performance changes: `npm run test:performance`.
- Release only: use `kinevault-release-readiness` for the full required suite and production build.

Read `package.json` for current script names. Preserve local development records and use `.local-artifacts/` for generated evidence.
