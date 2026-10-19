# Workshop audit, 18 October 2026

## Implemented

- Equipment search recovery now opens the complete catalog. Previously, searching for a missing item and clicking Show all equipment returned only popular items. A browser regression failed before the fix and passed afterward.
- The More menu makes the covered editor, playback and mobile view controls inert while open. This removes partially obscured targets from keyboard navigation and accessibility scans. Escape restores editor access. Covered controls no longer intercept clicks while the menu is open.
- Readiness tests now account for No selection preceding Anatomical figure, the hidden mobile manipulation toolbar, and the mobile Preview/Edit controls switch.

## Evidence

The original server on port 3000 serves an older production build. Source verification uses an isolated development server on port 3001. Production checks use a separate build and server on port 3002. Neither replaced the original server.

- Unit: 93 files, 802 tests passed. A concurrent run timed out in two geometry tests; the complete two-worker rerun passed all 802.
- Database: 41 files, 725 tests passed using the isolated database runner.
- Lint, typecheck and isolated production builds passed.
- Desktop readiness: seven accessibility, modal focus, keyboard and 320px reflow tests passed. A separate More-menu focus regression passed.
- Mobile: both light/dark owner-page and workshop accessibility scans passed after correcting the audit's desktop-only assumptions. The 320px touch reflow check passed. The final More-menu focus regression passed on both desktop and Android touch, waiting for native toggle completion before restoring focus.
- Core/equipment browser batch: 22 passed, four failed. It covers barbell joints, bench placement, cable controls, interface cleanup, manipulation, picker recovery, saving, recording, shortcuts, shared dumbbells and usability.
- Production performance: blank, held-weight and machine rendering/solver/React budget tests passed. The combined resource/profile test failed its capture-validity assertion. The capture had enough frame intervals but reported unstable dimensions or foreground rendering. This does not establish a rendering regression or a speedup.
- Workshop MCP: created private draft `c9aa5b67-447f-498a-a9e1-72b67e15d32c`, added a right-hand dumbbell, captured start and a raised finish, played/paused, saved and reloaded. The name, equipment and captured finish persisted. No exercise was published or submitted.

Logs and screenshots are under ignored `.local-artifacts/`, using `workshop-audit-*` names and `workshop-audit/results/`. MCP screenshots are under `tools/workshop-mcp/.local-artifacts/`.

## Next changes, in order

1. **Resolve save/recovery ambiguity in the deep-barbell test.** Its failure snapshot shows Saved privately and an unfinished-device-draft notice, while the test waits for an older Saved at ... Private message. Reproduce with serial rendering, inspect the saved scene and compare recovery timestamps before changing either persistence or assertions. Preserve authored poses and recovery.
2. **Resolve selection after manipulation.** The manipulation test expects the dumbbell but receives Anatomical figure. Reproduce its exact pointer sequence at the measured viewport and check whether the hit target or selection reducer is wrong. Add a focused regression before changing selection.
3. **Repair recording and shortcut coverage.** Recording exceeded its timeout during a long host stall. Rerun alone. The shortcut test accepts a numbered Cable row copy in one assertion but selects the exact unnumbered label next; select the verified option by value, then rerun keyboard save and deletion only on its fixture account.
4. **Make profiling reproducible.** Run the combined production profile alone with fixed render dimensions and a foreground page. Record rejected-capture reasons explicitly. Compare repeated median measurements on the same workload before optimizing. Current evidence does not justify a runtime rewrite.
5. **Improve precise-placement readability.** Held equipment exposes long computed rotation decimals. Check whether localized display rounding can preserve the exact stored transform and intentional typed precision. Keep stepper and save/reload tests.
6. **Finish remaining coverage.** Run the rest of the workshop specs, media flows, Firefox/WebKit and real-device checks. This audit is broad, not exhaustive. Keep the Shoulder Abduction + Cable filter-to-detail path covered.

Review and commit only the scoped fixes and their tests. The workspace contains extensive unrelated edits; do not stage or push it wholesale.

## Implementation follow-up

- Deep-barbell save/reload, pointer selection and explicit recording all passed when rerun serially, before changes to those paths. The recording run completed in 21.5 seconds. No persistence or selection workaround was introduced.
- Fixed the shortcut regression to select the verified copied row's UUID, including numbered names. Its full keyboard save, Undo/Redo and fixture deletion flow now passes.
- Rotation fields display two decimal places. A regression first failed on the old long display, then passed while checking the exact authored value in recovery, save/reload and subsequent stepper increments. Displaying 23.35 does not replace the stored 23.348515.
- Transform steppers stack in one column inside the narrow inspector, leaving enough input width to read their values. The precision regression also checks usable input width.
- Profiling exports now include captureState.hidden and captureState.resized, and the browser test attaches the capture before assertions. It brings the profiling page to the front and requires stable dimensions and foreground rendering as well as enough frames. Rejected captures retain their original validation rules.
- Local browser tests default to one worker, matching CI and the existing software-rendering CPU-budget guidance. Avoid concurrent profiling and browser batches.

Follow-up evidence uses `.local-artifacts/workshop-followup-*` and `workshop-transform-precision-*` logs. These results replace the four unresolved failures from the earlier concurrent audit; they do not establish full browser/device coverage or a runtime speedup.

Final follow-up verification: all five targeted browser flows passed together, all four production performance tests passed, 802 unit tests and 725 isolated database checks passed. Lint, typecheck and the isolated production build passed. Physical hardware, the remaining full browser matrix and media suites were not rerun for these display, diagnostics and test-runner changes.

## Coverage continuation

Implemented two issues found by the next browser batch:

- At 390×844, a wrapping saved-status label pushed More onto a third header row and left only 214px for the canvas. Mobile saved status now remains available to screen readers without taking a row. The Save button shows Saving while busy, with its action name preserved. Duplicate pose status is also screen-reader-only on mobile, and playback padding is smaller. The existing useful-canvas-height test now passes across desktop, tablet, mobile and fullscreen.
- Intermediate entries in Editing pose now include their timestamp, such as Pose 2 · 1.07s. Start, Finish and Return retain their names. The scrub/edit/Undo/Redo/save/reload test passes, with a unit regression for the label.

Additional evidence:

- WebKit passed light/dark accessibility and all three interaction checks. One initial trace failure came from overlapping diagnostic output directories; its isolated rerun passed.
- Bundled Firefox failed to launch. A fresh browser was installed under ignored `.local-artifacts/playwright-browsers/`, leaving the user cache untouched. It passed light/dark accessibility, More-menu focus and equipment-dialog focus. Canvas double-click selection still fails. A center-point test change did not resolve it and was reverted.
- Three private-media flows passed rendering and playback: wide cable bar, automatic held dumbbells and shared goblet dumbbell.
- The 12-test Chromium continuation initially passed six flows and failed six. The intermediate-pose and mobile-layout failures are now fixed and pass separately. The other failures remain below.
- Full unit suite: 803 passed. Isolated database suite: 725 passed. Production build, lint and typecheck passed.
- Final desktop/mobile workshop accessibility and narrow reflow: six passed. The controlled Shoulder Abduction + Cable filter-to-result-to-detail flow passed at 320px in both themes, two tests.

Continue with these findings before calling the workshop fully verified:

1. Firefox camera-mode double-click fails to select the dumbbell. Trace its raycast/event sequence; do not replace selection logic based only on the failing test.
2. The new return-navigation test expects visible My exercises and Exercise details links in the header. These are absent; current exit navigation remains inside More. Resolve the navigation design without shrinking the mobile canvas again.
3. The placement-warning fixture does not produce the expected advisory. Check the current overlap bounds and fixture placement before changing warning thresholds.
4. The tools test still expects fullscreen actions outside More and older tab-container structure. Update it to the real menu flow while preserving fullscreen failure/recovery coverage. The tutorial test also stopped at a save-status assertion and needs isolated persistence verification.
5. Installed-Firefox fallback assumes an existing published Shoulder Abduction + Cable result and stops on an empty catalog. Give that standalone runner a controlled fixture rather than publishing development records.

Evidence for this continuation is under `.local-artifacts/workshop-coverage-*` and `.local-artifacts/workshop-coverage/`. Physical-device, remaining equipment variants and full media coverage are still outstanding.

## Navigation and tutorial repairs

- Added visible My exercises and Exercise details links to the header. Compact labeled icon links fit the existing mobile rows. Return navigation works in focus mode; the desktop/tablet/mobile/fullscreen canvas-size regression still passes.
- Inspect placement now switches mobile users from Preview to editing controls before focusing the item. The advisory test also follows the actual Preview/Edit flow. Warning geometry and thresholds were unchanged; desktop and mobile overlay/inspection/repair checks pass.
- First-save route updates were closing an active tutorial after account eligibility changed. The tutorial now retains active progress for the current browser session, while fresh contexts and later visits still follow eligibility. The full tutorial test passes, including saving, finishing, reopening, fresh-context behavior, Hebrew and mobile.
- Updated the tools test to open fullscreen actions through More and inspect secondary tabs after their menu closes. Fullscreen success, timeout, rejection and recovery all pass.
- Firefox canvas selection was using resized CSS bounds before the renderer/camera had caught up. The readiness test now waits for matching canvas aspect and two animation frames before projecting its pointer target. The previously failing Firefox case passes without changing selection or raycasting code.

Verification for this batch: 803 unit tests, 725 isolated database checks, lint, typecheck and the isolated production build passed. Firefox and WebKit passed all 10 light/dark accessibility, focus and canvas-selection checks; Chromium and Android passed six accessibility/reflow checks. The return-navigation, canvas-size, placement-warning, tutorial and fullscreen/tools flows also pass. Logs and screenshots use `.local-artifacts/workshop-navigation-*` and `.local-artifacts/workshop-navigation/`.

The standalone installed-Firefox runner still needs its own controlled public catalog fixture. Full physical-device and remaining equipment/media coverage also remain; the browser failures above should not be repeated as unresolved defects.

## Standalone Firefox and catalog fixtures

- Extracted the catalog tests' rendered publication fixture into a shared local-only helper. Installed Firefox now creates its own Shoulder Abduction + Cable result and follows that exact exercise link. Cleanup withdraws only the fixture and removes its reviewer role, retaining review history.
- Added checks that reject remote, credential-bearing and path-bearing application/database URLs before creating records. A browser regression also verifies withdrawal when the fixture consumer throws.
- Updated the standalone runner's recovery action, equipment selection and dialog focus checks to the current controls. Accessibility scans wait for loaded fonts and completed color transitions. Canvas checks wait for matching renderer dimensions and retain native pointer events in their evidence.
- Installed Firefox 157.0.1 passed eight interaction checks and 14 accessibility scans across light and dark themes. The report confirms catalog withdrawal, private-fixture removal, browser shutdown and profile removal. Existing catalog/filter regressions and failure cleanup passed four tests.

Evidence: `.local-artifacts/workshop-fixture-*`, `.local-artifacts/workshop-fixture/`, and `.local-artifacts/firefox-installed/cc24fbff-2439-44a7-8e21-fcd95a3bcdfe/results.json`. This supersedes the standalone Firefox fixture item above.

## Remaining equipment media

All 18 remaining variants passed saved-scene rendering and private playback in a serial seven-minute run. Coverage includes seated-row rope, free row/deadlift, one-hand/custom/joint-driven barbells, custom rope/machine, lat pulldown, leg press, pec deck, resting/joint-driven/carried/lying-front-raise dumbbells, and shared pullover/near-limit/varying-elbow/left-arm dumbbells. Together with the three previously verified variants, all 21 cases in `tests/media/workshop-cable.spec.ts` have passed during this audit. The custom-machine poster and a lying-front-raise video frame were also inspected.

Final checks for this continuation: 803 unit tests, 71 worker checks, 725 isolated database checks, four catalog regressions, lint, typecheck and an isolated production build passed. No runtime speedup is claimed. Full workshop browser coverage and physical-device checks remain outstanding; the 21-case equipment-media file does not cover every application media flow.

## Workshop browser completion and final review

The full 82-case Chromium workshop batch initially passed 60 cases. All 22 failures subsequently passed in serial reruns after the following repairs. This is aggregate coverage across runs, not a single clean full-suite run. A new delayed-mount helper regression also passes.

- Right-clicking from Camera now enters arrow-based Move. It previously entered Free drag despite showing the Move action. The native pointer regression passes.
- Imported legacy barbells now use a stable scene-local UUID during server rendering and hydration. Random IDs left the dropdown pointing at an object ID absent from client state. The regression checks selection, the original 1.02m position, a 0.1m increment, saving and reloading at 1.12m.
- The shared browser helper waits for the editor to mount before checking mobile Edit controls. Its delayed-mount regression fails before the change and passes afterward. The mobile leave-machine flow passes independent movement, Undo/Redo, saving and reloading.
- Updated stale test controls and fixtures to current tools, menu, mobile Preview/Edit, authentication feedback and timestamped pose labels. Pose screenshot comparisons mask HTML selection overlays while preserving the rendered canvas and exact Cancel/Undo/Redo comparisons. Existing pose, persistence, queue and equipment assertions remain.
- Private-details fixtures use confirmed local test accounts. Two empty unconfirmed accounts from the failed run were individually verified and removed; development exercises were preserved.

Evidence uses `.local-artifacts/workshop-final-*` and `.local-artifacts/workshop-final/`. The repaired browser batches also pass catalog paging, moderation, metadata, templates, auth recovery and clipboard feedback checks.

Final verification: 803 unit tests, 71 worker checks, 725 isolated database checks, lint, typecheck and the isolated production build pass. All 12 interaction checks pass across Chromium, Firefox, WebKit and iPhone touch emulation; public accessibility passes in both themes. Both runtime fixes also pass their full regressions against the production build. `.local-artifacts/workshop-final/coverage-summary.json` accounts for all 82 original workshop cases, including the renamed mobile release test. The new helper regression adds one case. Generated build includes were removed from `tsconfig.json`, preserving its pre-existing entries.

Dependency review found no production alerts. Eight development alerts share an unpatched transitive `braces@3.0.3` advisory, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The registry still offers 3.0.3; forcing audit fixes would downgrade unrelated toolchains. No dependency versions were changed.

Before pushing, review the workshop changes together with their imported modules and shared fixtures. The workspace also contains substantial unrelated authentication, administration, design and asset changes; those have not received this review's full scope. Do not stage the whole workspace or the main workshop component alone. Physical-device checks and the complete application/browser/media matrix remain outside this audit.

## Fresh-database CI follow-up

CI exposed missing Smith-machine and leg-press taxonomy rows: the original machine migration ran before taxonomy seeding, and the seed omitted both. Migration `20261019060143_workshop_machine_taxonomy.sql` inserts the category and equipment idempotently; the seed now includes both machines. Two owner-save regressions fail before the repair and pass afterward. All 727 database checks pass with the full migration chain applied to an empty application schema. Apply the forward migration without resetting existing records.

The isolated candidate also passes all 23 media tests and all four performance checks using the default Turbopack builder. Catalog initial JavaScript measures 169,126 bytes against the 200,000-byte limit. Local readiness records 66 passes and two skips across Chromium, WebKit and touch emulation; the 17 bundled-Firefox cases fail at process launch on this Windows host and require Linux CI. No performance budgets were raised.
