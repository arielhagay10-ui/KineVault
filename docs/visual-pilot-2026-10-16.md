# Visual pilot, 16 October 2026

## Scope and review gate

Implement the baseline and one complete pilot before expanding the equipment system or redesigning remaining routes. Preserve the educational identity, the existing solver and saved scenes. No migrations, public API changes, account upgrades, publishing or deployment.

The pilot covers Explore, exercise detail, workshop and a Blender-authored lat-pulldown. The remaining equipment and screens are intentionally held for the user's visual feedback.

## Baseline inventory

| Area | Existing routes and responsibilities | Pilot observations |
| --- | --- | --- |
| Browsing | Home, `/exercises`, exercise detail, muscle/joint/joint-action/equipment/family pages | Small demonstrations and long filter groups compete for space; creation is mainly in navigation. Detail puts actions ahead of instruction hierarchy. |
| Creation | New/existing workshop, private exercise metadata, personal exercises | Strong canvas and complete controls; selected tools and inspector groups need clearer distinction. Preserve English/Hebrew layout and keyboard behavior. |
| Account and community | Dashboard, sharing, submission list/detail, notifications, sign-in/up, password reset and confirmation | Shared visual treatment follows after pilot approval; authorization and moderation remain intact. |
| Administration | Review, candidates, exercise/taxonomy/asset/role management | Hold changes until pilot approval. |
| Rendering | Shared workshop/public/comparison/internal media renderer | Equipment must retain solver scale, grips, support coordinates, dynamic cables, independent instances and resource cleanup. |

Equipment inventory: five machine families, cable tower, bench, squat rack, barbell, dumbbell, kettlebell, and seven cable attachments. Only lat-pulldown receives the asset treatment in this pilot. Other geometry remains the compatibility baseline.

Baseline evidence lives in `.local-artifacts/visual-pilot/before/`: twelve screenshots across the three screens, desktop/mobile and light/dark; equipment-picker screenshot; navigation/layout measurements; source snapshots. The baseline browser flow passed Shoulder Abduction + Cable → matching result → detail, workshop playback and equipment selection. Timings are local development observations, not production budgets or hardware frame-rate claims.

## Direction

Retain Comfortaa, slate actions, neutral panels and anatomy-specific muscle highlights. Prioritize readable demonstrations and instructions. Give browsing and creation visible access. Distinguish canvas, inspector, selected tools and playback through spacing and semantic surfaces. Use logical spacing for the Hebrew workshop.

The generated equipment-only reference remains a construction guide. Generated page illustrations were withdrawn after the user identified their substituted figures. All figure imagery in the review and Figma now comes from real KineVault captures using the bundled Z-Anatomy asset. Earlier generated page references are archived outside the visible review. Actual screenshots and rendered media determine acceptance.

## Tools and provenance

Use the [official Blender distribution](https://www.blender.org/download/) with checksum verification and a project-local portable install under ignored artifacts. Original generated geometry and scripts remain in the repository; downloaded tools remain ignored.

Figma file creation and Plugin API reads succeeded on the connected Starter account without an upgrade: [KineVault visual pilot](https://www.figma.com/design/0gCV1Dee0p2OKB0swOZmfJ). The browser remains the interaction reference.

[Poly Haven](https://polyhaven.com/) supplies CC0 assets under its [license guidance](https://docs.polyhaven.com/en/faq). Record individual asset sources and licenses if incorporated. Avoid texture downloads that add cost without improving the teaching model. Preserve existing anatomy attribution.

## Verification ledger

- Baseline unit tests: 87 files, 642 tests passed with `TEMP` and `TMP` pointing to `.local-artifacts/tmp`. The initial sandbox temp directory caused ENOENT failures; no source fix was required.
- Isolated database checks: 40 files, 708 assertions passed through `npm run db:test`. Development records were not reset.
- Worker tests: 64 passed outside sandbox network isolation. Initial sandbox loopback/temporary-file errors disappeared with normal host execution and workspace-local temporary files.
- Browser baseline: all twelve screen combinations fit their viewport; combined filters → exercise detail, playback and picker passed.

Final pilot checks, asset statistics and review findings are recorded below after integration.

## Integrated pilot

- Blender 4.5.14 LTS portable archive SHA-256 matches the official checksum: `b9533d2397ac1984db4466fb23a7a4649391cca93f6e84209f9bcc60d071c8b9`. Headless export succeeded. Rebuild steps and runtime contracts are in `docs/equipment-assets.md`.
- Shipped GLB: 791,468 bytes, 10 meshes/material primitives, 16,400 actual exported triangles, 21,349 vertices. Exactly one `Static`, `Weights` and `Handles` group. Source mesh polygon counts are not used as exported triangle counts.
- Both grips were captured in side and three-quarter views at 17 samples, plus continuous playback. Existing contact tests also sample anatomical world geometry. Save/reload and both grip variants passed their browser checks.
- Browser request evidence records `/models/z-anatomy/model.economy.meshopt.e140790f.glb` and `/models/equipment/lat-pulldown.v1.glb` in the workshop. Exported media uses the full existing Z-Anatomy renderer. The equipment GLB contains no human model.
- Private poster, MP4 and WebM render succeeded; the MP4 played and was captured at 17 positions. Evidence: `.local-artifacts/workshop/cable-freedom/lat-pulldown-*`.
- Corrected UI confirmation passed all three screens in desktop/mobile and light/dark, plus Hebrew RTL, keyboard tab navigation, equipment picker, playback and combined filter → exercise-detail flow. Six existing catalog/filter browser tests passed.
- Figma has 177 editable descendants, including 79 text nodes and 27 component instances. All text uses Comfortaa. Its three media wells use actual model captures; the temporary full-page capture was removed. The temporary source capture tag was removed and `src/app/layout.tsx` has no diff.
- Independent code review found and closed an isolation/readiness defect. Anatomy-only viewers no longer wait for hidden equipment. A failing-then-passing regression covers isolated viewers and editors.
- Production build passed. Explore initially transferred 242,907 bytes of JavaScript with the full Radix barrel. Package-import optimization reduces the measured initial transfer to 167,476 bytes with zero model requests. Authoring-link prefetch is disabled so browsing does not prefetch the creation flow.

The rejected generated figure references do not establish implementation fidelity. Use the actual rendered evidence and recorded model URLs.

## Physical GPU observation

A quiet local Chrome capture reported the NVIDIA GeForce RTX 5070 Ti Laptop GPU
through ANGLE/Direct3D 11, excluding software rendering. Each quality mode ran
for 15 seconds at a 1440×1000 viewport with a 1056×695 canvas and pixel ratio 1.
Both economy and contact-detail modes recorded a 4.5 ms p95 rendered-frame
interval, 18 draw calls and 18 allocated geometries. Mean pose-solve time was
approximately 0.72 ms and 0.76 ms respectively. Both captures were valid with
more than 3,500 frame intervals; neither exceeded the plan's 33.3 ms investigation
threshold. These are local rendered-frame cadence observations, not GPU execution
timings or a universal FPS guarantee. Raw results and model URLs are in
`.local-artifacts/visual-pilot/hardware/`.

The first hardware attempt waited on a hidden quality control and timed out.
The corrected diagnostic opens View first and uses the verified Direct3D backend.

## Export and test repairs

Actual export inspection found the global floating site menu overlapping the
capture region. Capture-only screenshot styling now hides that overlay; encoded
pixel checks first failed against the menu and then passed with the correction.
The final private render was regenerated and inspected without the menu.

The route performance smoke test also needed maintenance for existing workshop
changes: its Password locator now matches the field exactly rather than the
Show password button, and its recorder selects Economy to hold pixel dimensions
fixed. Auto deliberately adjusts pixel ratio during slow software rendering,
which invalidates a fixed-dimension device capture. Budgets were not raised.

## Comparison memory diagnosis

The initial comparison check measured a cold Contact anatomy cache against an
Economy-only baseline. Public-page navigation did not warm that cache: subsequent
`page.goto` calls replace the document. `useGLTF` retains its source asset, and the
prepared anatomy cache retains immutable CPU geometry for that source. Rig
disposal still releases instance GPU resources.

A same-document Contact → Economy warmup distinguished cache growth from instance
retention. Three comparison cycles measured 25,757,720 bytes before and
24,110,904 / 24,624,872 / 25,446,448 bytes after collection. Both comparison WebGL
contexts reported loss on every close. The separate cold diagnostic retained
5,780,324 bytes after five seconds. The performance test now records first-use
Contact heap separately and warms both existing quality levels before measuring
instance teardown. The 3 MB retention threshold is unchanged. No application
quality or anatomy assets were changed to satisfy this check. Independent review
confirmed the cache-state correction and found no surviving rig subscriptions,
camera listeners or metrics timers.

Raw diagnostics: `.local-artifacts/visual-pilot/memory-comparison.json` and
`memory-comparison-warm.json`. These are local measurements; keep the repeated
cycle check when investigating future resource changes.

## Final pilot checks

- Lint and typecheck passed after the final changes.
- Unit suite: 88 files, 649 tests passed.
- Worker suite: 64 tests passed, including capture readiness and overlay pixels.
- Isolated database: 40 files, 708 assertions passed.
- Catalog/filter browser flows: 6 passed. Both machine grip save/reload flows: 2 passed.
- UI confirmation and private poster/video render: passed against the production build.
- Production build passed; three workload render/solver budget checks passed.
- Final production route check passed, including lazy anatomy, transfer budgets,
  comparison retention, both themes, both viewport sizes and Hebrew/English views.
- A forced machine-GLB failure preserved procedural rendering with the original anatomy.
- The Graft graph was refreshed after integration.

Review the actual before/after screens and exported movement at the local pilot
review (`http://127.0.0.1:3100/review.html`). The review's raw evidence remains in
ignored `.local-artifacts/visual-pilot/`. Wider rollout awaits the requested early
visual feedback.
