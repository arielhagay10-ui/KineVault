# Workshop MCP

Give local agents this MCP to try the real workshop. Each process owns a separate browser context. It uses visible controls and normal account permissions. Edits create real private drafts through app autosave.

## Setup

Requires Node 22+, the local KineVault app and its database. From `C:/KineVault` start the app with `npm run dev`.

In another terminal:

```powershell
cd C:/KineVault/tools/workshop-mcp
npm install
npm run build
npm run login
```

Login opens Chrome on Windows, bundled Chromium elsewhere. Sign in with a test account. Once the workshop opens, the browser closes and saves authentication to this package's ignored `.local-artifacts/auth.json`. Keep this file private. To install Chromium, run `npm run browser:install` and set `KV_WORKSHOP_CHANNEL=chromium`. Existing KineVault installs may already have the dependencies available through the parent `node_modules`.

Add [mcp.example.json](mcp.example.json) to the agent client's MCP configuration. Adjust the absolute server path if you move the folder. Restart/reconnect the client. Launch `node dist/server.js` directly through the client; stdio is reserved for MCP messages.

Share this folder and the configuration with agents on this computer. Other computers need their own local app and login. A stdio server is launched by each client, so there is no MCP port to expose.

## Give agents this instruction

```text
Use the kinevault-workshop MCP. Read workshop://guide or invoke the
try-workshop prompt. Open a fresh private draft, try the workshop's actual
controls, and inspect the 3D preview with screenshots. Create a simple
movement, play it, save privately, reload and check persistence. Report
verified issues with draft URL, reproduction steps and screenshot paths.
Keep experiments in your own draft. Do not publish, submit or delete.
```

## Tools

| Tool | Use |
| --- | --- |
| `workshop_open` | Fresh draft by default; optional existing `draftId` UUID |
| `workshop_snapshot` | Accessible controls, URL, viewport, preview readiness, errors |
| `workshop_control` | Click, fill/blur, select, check, press keys, hover by exact name |
| `workshop_pointer` | Click, double-click, drag, right-drag camera, scroll |
| `workshop_screenshot` | Return a PNG and save an evidence file |
| `workshop_wait` | Wait for a named control to appear/disappear |
| `workshop_reload` | Reload after save confirmation to check persistence |
| `workshop_close` | Release the browser; private drafts remain |

Example control arguments:

```json
{"action":"fill","target":{"by":"label","name":"Exercise name"},"value":"Agent trial"}
```

Snapshots supply current names. `target.by` supports `role`, `label`, or `text`; `role` requires `target.role`. Optional `region` scopes duplicates, and `index` selects an explicit zero-based match. Pointer coordinates use viewport CSS pixels from the latest screenshot.

## Configuration

| Environment variable | Default |
| --- | --- |
| `KV_WORKSHOP_URL` | `http://127.0.0.1:3000`, loopback HTTP origin only |
| `KV_WORKSHOP_AUTH` | This package's `.local-artifacts/auth.json`; empty disables loading auth |
| `KV_WORKSHOP_ARTIFACTS` | This package's `.local-artifacts` |
| `KV_WORKSHOP_CHANNEL` | `chrome` on Windows, bundled Chromium elsewhere; `chromium` selects bundled Chromium explicitly |
| `KV_WORKSHOP_HEADLESS` | `1`; set `0` to watch agents use the browser |

Use a different test account/auth file per agent when account isolation matters. Agents using one login share draft ownership but have independent browser storage; each should start a new draft. Sessions do not export refreshed credentials, so rerun login if the saved session expires. Reload verifies server saves; local recovery belongs to the current browser context and ends when it closes.

If sign-in appears, run login and restart the MCP. If the connection fails, check the app URL and database. If Chrome is missing, install bundled Chromium as above. Navigation outside the configured origin is blocked. Tools serialize operations, release pointer buttons after drags, and close the browser on disconnect. They expose no arbitrary JavaScript or database credentials. Account permissions still permit any action available in the UI; use a test account and the handoff's private-draft scope.

## Verify

```powershell
npm run build
npm test
```

Tests use a real MCP client, Chromium and temporary local HTTP fixtures. They verify editing, images, dragging, reloads, serialized calls, errors, independent browser storage, invalid inputs, and redirect/popup isolation. They do not substitute for a saved/reloaded exercise test against the running app. `evaluation.xml` supplies ten read-only questions for checking tool discovery and guide comprehension with another agent.

Built with the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x) and [Playwright](https://playwright.dev/docs/api/class-locator).
