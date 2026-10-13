# Workshop MCP implementation plan

**Goal:** Give local agents tools to try the workshop independently.

**Architecture:** Standalone stdio MCP with one isolated Playwright context per process; use ordinary app UI and account permissions.

**Spec:** `docs/superpowers/specs/2026-10-09-workshop-mcp-design.md`

## Tasks

- [x] Create `tools/workshop-mcp/package.json` and strict TypeScript build configuration. Write integration tests using an HTTP fixture and the real MCP client. Verify that missing server implementation fails.
- [x] Implement loopback configuration, browser lifecycle and a serial queue in `src/browser.ts`; register tools, resource and prompt in `src/server.ts`. Verify named editing, viewport gestures, snapshots, navigation boundaries, errors and independent sessions through MCP.
- [x] Add one-time headed authentication in `src/login.ts`, client configuration examples, and a concise `README.md` with a copyable agent handoff.
- [x] Run standalone build/tests, repository lint/typecheck/unit/database checks and production build. Attempt the real workshop browser flow without touching unrelated editor work. Record environmental limitations.

Validation: standalone install/build and MCP browser tests pass. Repository lint/typecheck and 416 unit tests pass. Production build passes using `npm run build -- --webpack`; default Turbopack failed starting a CSS subprocess after its sandboxed font fetch failed. Real app MCP smoke verifies the unauthenticated workshop redirects to sign-in and screenshots work. Database checks and authenticated exercise save/reload/media flows remain unverified because Docker is stopped. One-time interactive login remains for the operator.
