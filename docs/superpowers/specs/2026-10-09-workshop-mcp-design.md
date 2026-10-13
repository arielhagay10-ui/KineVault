# Local workshop MCP

Let agents try the actual workshop through its visible controls. Use a standalone TypeScript stdio MCP under `tools/workshop-mcp`, backed by Playwright. The app remains unchanged.

Each server owns one browser and context. A one-time headed login writes ignored authentication state; agent sessions read it without sharing a browser profile. A new draft is the default. Existing drafts require an explicit UUID. The normal app controls, autosave, actions and RLS govern edits.

Tools open/reload the workshop, inspect its accessible controls, edit named controls, perform viewport pointer gestures, capture images, wait for named controls, and close the browser. Snapshots include URL, viewport, preview readiness and bounded error diagnostics. A resource and prompt explain the workflow and review checklist. No arbitrary JavaScript or privileged database access is exposed.

Restrict navigation to the configured loopback origin. Dismiss unexpected dialogs and popups. Use a serial operation queue so concurrent calls cannot corrupt a drag or navigation. Release the browser on close, EOF or signals. Store screenshots and auth in `.local-artifacts/`.

Deliver the standalone folder, MCP config examples and an agent handoff. Verify through a real MCP client and Chromium against a controlled HTTP page, then attempt the local workshop flow. Report unavailable application/database dependencies accurately.
