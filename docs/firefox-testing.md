# Installed Firefox verification

Run against a local production server and local Supabase:

```powershell
npm run test:firefox -- --origin=http://127.0.0.1:3001
```

The direct command is `node scripts/check-firefox.mjs`. Node 24 is required for loading the repository's TypeScript scene and fixture helpers. `.env.local` supplies local Supabase keys. The script rejects remote app and Supabase destinations before creating fixtures. It creates one `@example.test` account and private workshop draft, then uses the existing ownership-aware cleanup helper. It preserves unrelated records and audit history.

The Windows default executable is `C:/Program Files/Mozilla Firefox/firefox.exe`. Override it with `--firefox=/absolute/path` or `FIREFOX_EXECUTABLE`. `--timeout-seconds=600` bounds the full check, with a permitted range of 60–900. The browser always uses a fresh profile under the UUID artifact directory. No user profile can be supplied. Browser launch receives only required operating-system environment variables, excluding server credentials.

Puppeteer drives installed Firefox through [WebDriver BiDi](https://pptr.dev/webdriver-bidi). This verifies the installed browser when the separate Playwright Firefox binary cannot launch. It supplements the regular Playwright readiness matrix. The executable and reported Firefox version are recorded so results cannot be confused with the Playwright build. Scenarios use fresh tabs within the disposable browser context, because native Tab can enter Firefox's browser chrome and leave later navigations without document focus. A native pointer setup returns focus to content if needed before keyboard activation. Modal checks permit browser chrome focus, but reject focus on background page controls.

Light and dark checks cover Shoulder Abduction + Cable filters, matching exercise details, site navigation keyboard focus and Escape, workshop canvas double-click selection, keyboard equipment selection, equipment dialog Tab/Shift+Tab containment, blocked background focus, Escape dismissal and restored trigger focus. Axe scans cover the home page, catalog, detail, navigation dialog, quick workshop, selected equipment and equipment dialog in both themes. Any violation or unresolved `aria-prohibited-attr` check fails the run. Other incomplete checks remain in the artifacts for manual review.

Evidence is saved in `.local-artifacts/firefox-installed/<run-id>/`: `results.json`, individual axe reports and workshop/failure screenshots. JSON evidence redacts signed-media/authentication query credentials and shared bearer paths through the shared evidence serializer. No network traces or browser profiles are retained. Results include browser, fixture and profile cleanup status. This desktop check does not certify physical touch, screen readers, display contrast or remote deployment. See [Puppeteer launch options](https://pptr.dev/api/puppeteer.launchoptions) for executable/profile support and installed-browser compatibility limits.

The 7 October final-build production-server run passed all eight interaction checks and 14 light/dark axe scans on Firefox 157.0.1. Violations were zero; ten incomplete results remain for manual review. Artifact: `.local-artifacts/firefox-installed/be85be05-3277-4f5a-ac8e-a7c6ef2d81f9/results.json`. Fixture, browser and profile cleanup passed; the previous run also independently confirmed the fixture user and private draft were absent. JSON evidence contained no unredacted query credentials. The workshop check dismisses only its own recovery prompt with "Keep server version" and fits the scene before the canvas selection measurement.
