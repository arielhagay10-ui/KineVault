# Browser and accessibility readiness

The readiness suite covers Chromium, Firefox, WebKit, Android touch emulation and iPhone touch emulation. WebKit automation does not verify shipping Safari, iOS hardware or VoiceOver. Touch emulation does not verify physical touch, gestures or the on-screen keyboard.

## Automated checks

Use a running local app and local Supabase with the repository's seed data and `.env.local`. The suite creates a separate owner and private workshop draft for each authenticated test. It rejects remote app/database URLs, closes the page before cleanup and removes only the fixture owner's records through the existing cleanup helper. It never resets the database.

```powershell
npx playwright install chromium firefox webkit
npm run test:readiness
```

Use `PLAYWRIGHT_BASE_URL` when the local app uses another port. The readiness config does not start or stop a server. Coordinate builds with the app process, and run against the production build for release evidence.

For one browser or area:

```powershell
npm run test:readiness -- --project=firefox
npm run test:readiness -- tests/readiness/workshop-interactions.spec.ts --project=iphone-touch
```

CI needs all three Playwright browser binaries, the production server, local Supabase and the same fixture environment. Use `npx playwright install --with-deps chromium firefox webkit` on Linux. Run `npm run test:readiness` after the server is ready. Reports include JSON, HTML, failure screenshots and video. Network traces are disabled in CI because they can contain auth payloads and signed media URLs; local failure traces stay ignored and private. Axe evidence redacts URL credentials. Do not run two readiness jobs against the same output directory.

The suite checks:

- Light and dark home, catalog with expanded mobile filters, sign-in/sign-up, password reset request, joint action, combined Shoulder Abduction + Cable results, matching exercise detail, invalid filters and authentication errors.
- Signed-in dashboard, private library, draft details, password update form, quick workshop, Equipment, Position, Pose, Timeline and Settings, start/finish comparison, equipment search/empty results and Hebrew workshop.
- Admin dashboard, candidates, exercises/editor, taxonomies, roles, assets, review queue, owner submission/notification lists, submission readiness form, anonymous shared draft and revoked-share response.
- Populated submission forms, active reviewer classification/annotation editors, correction history, approval, contributor diffs, change requests, notifications and signed private/public videos in both themes.
- Public content at 320 CSS pixels, named workshop groups/landmarks, an accessibility-tree reading-order artifact and unobscured 24px playback targets after focus/scroll.
- Native navigation and equipment dialog names, keyboard focus containment, Escape dismissal and focus restoration.
- Touch navigation/filtering/detail, desktop canvas double-click selection, touch selection in Move mode, unchanged placement and keyboard selection through named scene-object buttons.
- Axe WCAG A/AA checks including color contrast, accessible names, form labels and semantics. No rule exclusions are configured.

Every axe scan attaches violations and `incomplete` results. A passing automated scan requires zero violations and no unresolved `aria-prohibited-attr` warning. Labelled preview/editor/control containers now have group or region roles. Review every remaining incomplete result manually. Axe cannot verify visual focus, canvas geometry, clear announcements, coherent reading order or actual screen-reader behavior.

The narrow-screen regression found clipped workshop playback controls. The mobile preview now uses natural height and scrolls with its controls; desktop sizing is preserved. Native review video has a name and explicit metadata preload.

Windows WebKit did not load the signed videos. Independent valid MP4/WebM data-URL probes also returned `MEDIA_ERR_SRC_NOT_SUPPORTED`, despite `canPlayType` reporting support. For these Windows projects, populated-media scans verify signed HTTP bytes, declared media types and accessible controls, and attach `unverified-media-playback` annotations. Chromium/Android and Linux/macOS runs require decoded frames. Do not count the Windows annotations as playback passes. The probe is `.local-artifacts/readiness/webkit-decoder-probe.json`; [Playwright documents platform-dependent media support](https://playwright.dev/docs/browsers#webkit) and recommends macOS for Safari video coverage.

## Manual browser and physical-touch checks

Run on an approved test deployment reachable from the device. Use disposable private drafts and do not edit community records. Record app revision, date, tester, OS, exact browser version, device, orientation, assistive technology/settings and artifact paths. Store screenshots or recordings in ignored `.local-artifacts/readiness/manual/`.

| Environment | Required checks | Recorded status |
| --- | --- | --- |
| macOS Safari | Catalog filters/detail, both dialogs, keyboard canvas alternative, save/reload | Pending |
| Firefox desktop | Same flows, canvas selection, drag cancellation, save/reload | Installed Firefox automation passed; manual drag/save/reload pending |
| Physical iPhone, Safari | Portrait/landscape, taps, dialog scroll, on-screen keyboard, canvas Move selection, orbit/pinch, save/reload | Pending |
| Physical Android, Chrome | Same physical-touch flows, pointer cancellation and back navigation | Pending |

1. In each theme, open catalog filters. Select Shoulder Abduction and Cable, apply, open a result and navigate back. Confirm retained filters, readable labels and no horizontal scrolling.
2. Open the site menu. Scroll it, choose appearance, close with its button and tap its backdrop. Confirm no activation of content beneath it and usable close controls after rotation.
3. In a private workshop, open Add equipment. Search with the software keyboard, scroll results, choose an item, reopen and dismiss. Confirm focus returns to the opener and the page beneath does not receive taps. On desktop also test Escape while the search contains text.
4. In Camera mode, orbit and pinch/zoom. On desktop double-click equipment. On touch choose Move, then tap equipment. Confirm the correct selected-item label and unchanged placement after selection. Select the same equipment through Scene objects without using the canvas.
5. Move an item, cancel a drag, Undo, Redo, save and reload. Confirm placement and current start/finish poses survive. Interrupt a touch with rotation or app switching and confirm no stuck drag or blocked scrolling.
6. Open both dialogs while zoomed and with the software keyboard visible. Confirm search, close and selected result stay reachable. Check visible focus and text at 200% zoom and reflow at 400% desktop zoom.

## Screen-reader and contrast checks

| Combination | Recorded status |
| --- | --- |
| NVDA + Firefox on Windows | Pending |
| VoiceOver + Safari on macOS | Pending |
| VoiceOver + Safari on physical iPhone | Pending |
| TalkBack + Chrome on physical Android | Pending |

1. Navigate headings and landmarks on the home page, catalog and exercise detail. Confirm the main content and page name are understandable, the skip link works and exercise cards have useful names.
2. Read, change and apply both catalog filters. Confirm checkbox state, validation/errors and matching results are understandable without visual context.
3. Open each dialog with keyboard or the reader's activation gesture. Confirm its name is announced, focus moves inside, background controls cannot be reached, Close/Escape dismisses it where supported and focus returns to the opener.
4. In the workshop, select the figure and equipment through named controls, switch tools and adjust numeric placement or pose controls without the canvas. Confirm selected-item state, units, Start/Finish, Undo and save status are understandable. Inspect the text scene summary as well as the rendered preview. Record any missing or repeated status announcement.
5. Repeat equipment search with no matches and authentication validation. Confirm the error/status is announced once and its corrective action is reachable. Repeat the workshop in Hebrew and confirm language, reading direction and translated control names.
6. Review axe `incomplete` contrast nodes in both themes. Measure text against the actual composed background, including transparent overlays. Require at least 4.5:1 for normal text and 3:1 for large text. Check meaningful controls and focus indicators at 3:1 against adjacent colors. Inspect canvas selection outlines and handles directly because axe cannot measure their rendered pixels.

Use this record for every manual run or unresolved axe result:

```text
Revision / deployment:
Date / tester:
OS / browser version / device / orientation:
Screen reader / version / settings:
Theme / language / zoom:
Scenario / axe rule and target:
Expected / observed:
Contrast foreground / background / measured ratio, if relevant:
Pass / fail / blocked:
Screenshot or recording path:
Issue / owner / retest evidence:
```

Manual rows remain Pending until recorded evidence exists. An automated pass does not close these rows.

## Installed Firefox, 7 October 2026

Playwright's Windows Firefox binary still cannot launch because Windows SideBySide reports a missing `mozglue` assembly. Installed Firefox 157.0.1 runs through Puppeteer's supported WebDriver BiDi protocol: eight catalog/canvas/dialog checks and 14 light/dark axe scans passed, with zero violations and ten incomplete instances retained for manual review. Fixture, draft, browser and profile cleanup were verified. Final-build artifact: `.local-artifacts/firefox-installed/be85be05-3277-4f5a-ac8e-a7c6ef2d81f9/results.json`. Run `npm run test:firefox -- --origin=http://127.0.0.1:3001`; see `firefox-testing.md` for driver isolation and scope. Linux CI still runs the ordinary Playwright Firefox suite. Neither automation certifies physical touch or screen-reader behavior.

## Axe incomplete review, 7 November 2026

Run on a production webpack build at `127.0.0.1:3000` with local Supabase on Linux. `npm run test:readiness` covered Chromium, Firefox and Android touch emulation: 336 axe scans, zero violations, 634 incomplete nodes. WebKit and iPhone touch emulation did not launch on this host (Playwright reports missing `libicu74`, `libxml2` and `libflite`), so this review has no WebKit results. `workshop controls remain named and operable in narrow reflow` fails in all three projects because it waits for the `Editing pose` combobox that commit 8779fcc removed. That test runs no axe scan and was left unchanged.

For each incomplete `color-contrast` node, the review composed the node's background layers up to the first opaque surface. Layers over a canvas, video or image were composed over both black and white, and the lower ratio was kept.

Fixed:

- Placeholders used Tailwind's 50% `currentColor` default, which measured 3.04:1 in the light equipment search. A base `::placeholder` rule now uses `muted-foreground`: 6.27:1 light, 10.04:1 dark.
- On narrow screens the Hebrew workshop Save button showed "שמירה" but was named "שמירת תרגיל" (a `label-content-name-mismatch` violation on Android). The Hebrew short label now matches the name.
- Scans run right after a theme switch measured links and buttons mid-transition (1.21–3.88:1 in `dark-media-publication-confirmation`). The audit helper now waits for running CSS transitions before scanning. Settled colors pass.

Justified:

| Rule and reason | Where | Justification |
| --- | --- | --- |
| `color-contrast`, overlapped background | Equipment dialog and empty search | Axe cannot resolve the stacking of the native modal dialog. Text sits on the opaque dialog or card surface, measuring at least 6.27:1. Equipment names sit below their in-flow thumbnails, on the card (15.19:1 light, 14.15:1 dark). |
| `color-contrast`, partially obscured | Classification lists in the admin and review editors, workshop tool panels on Android | Scroll containers clip these elements. They sit on opaque token surfaces, measuring at least 5.76:1. |
| `color-contrast`, image node | Anatomy credit (`bg-card/90`) and "Drag an arrow to move" (`bg-card/95`) over the WebGL canvas | Worst case over black or white: 6.67:1 for the credit, 14.02:1 for the hint. |
| `color-contrast`, non-text content | ◐ appearance glyph, −/+ stepper glyphs | Symbols need 3:1 as graphics. They measure at least 8.04:1. |
| `label-content-name-mismatch`, undetermined | Account/Appearance button (◐ only on narrow screens), −/+ steppers | The visible content is a symbol, not a text label. The names are "Appearance"/"Account" and "Decrease/Increase … by 0.1". |
| `video-caption` | Exercise detail, submission review and contributor diff videos | Renders are encoded without audio (`-an` in `scripts/lib/capture-motion.mjs`), so captions do not apply. |

Still open: WebKit and iPhone touch emulation results; canvas outlines and handles, which axe cannot measure; and the workshop Save button while saving, whose name stays "Save exercise" while it shows "Saving…" (not scanned). The manual browser, device and screen-reader rows above remain Pending.

Evidence is in `.local-artifacts/readiness/2026-11-07/`: `baseline-chromium.json` (before fixes), `run3-final.json` (after fixes), `run3-incomplete.json`, `run3-measured.json`, and the scripts that produced them.
