# Workshop audit implementation, 15 October 2026

Implemented against the audited working tree. Existing authentication changes, workshop work and user drafts were preserved. No schema changes, database reset, publication or deployment.

## Changes

| Audit items | Implementation |
| --- | --- |
| 1, 3, 10 | Combined actions/status, compact recovery, camera presets, shared compact playback footer, mobile Preview/Edit controls, truthful Select/Drag endpoint labels and local direction help. Layout tests require settled canvas heights of 300px at 1280×720 and 280px at 390×844, including fullscreen. |
| 2 | Visible edit alerts; rejected numeric placement retains the entered value. A browser regression creates the 24-moment failure, repairs the scene, then applies a successful edit. |
| 4 | External gesture preview consumed in frame order. Limb, cable, machine, body and object transforms publish live previews; release records one history transaction. Recovery checkpoints every 500ms and flushes at completion, cancellation and lifecycle boundaries. |
| 5, 6, 13 | Playback time updates only playback controls and the active joint inspector. One lazily allocated inspector solver is reused and disposed by its owner. Hidden joint inspectors unsubscribe. Expensive panel bodies mount on first use and retain form state. The View portal anchor mounts eagerly. Machine repair reports update for the paused editable pose. |
| 7 | Auto/Economy use a 4,919,672-byte licensed anatomy derivative instead of the 9,920,700-byte full compressed GLB. Every named muscle remains selectable; hand/foot geometry is preserved. Auto adjusts pixel ratio; Contact detail and non-editor rendering retain full detail. Thresholds remain provisional pending physical-device calibration. |
| 8, 9, 17 | Dismissible creation guidance, Capture start/Capture pose versus Save exercise, device/account status and a visible Add exercise details continuation after saving. Metadata remains optional and saving remains private. |
| 11, 12, 14, 15, 16 | One Selected item selector and movement toolbar, typed interaction modes, secondary View/Setups/Settings navigation, advanced pose utilities under disclosure, and removal of the legacy creation selector. Existing legacy scenes still load/render. |
| 18, 19, 20 | Verified production build identity and separate blank/held/machine performance workloads; measurements persist on failure. Picker groups deduplicate in priority order. Recovery choices distinguish saved exercises from blank drafts and explain disposal of the device copy. |

## Verification

- Lint and strict TypeScript checks.
- 641 unit tests across 86 files; 64 worker tests.
- Isolated database checks: 708 assertions across 40 files. Development records preserved.
- Browser coverage: settled desktop/800px/mobile/fullscreen layouts; long object drag with device checkpoint, one-step Undo and blur cancellation; machine cancellation; constrained nudges; numeric edits queued behind autosave; unnamed saves; capture/save/reload; tutorial; picker deduplication; detail switching; live joint values; WebGL fallback/retry.
- Accessibility: light/dark tools and equipment dialog, 320px reflow, keyboard dialog focus and Android touch selection.
- Shoulder Abduction + Cable filtering through matching exercise detail at 1440px and 1024px.
- Saved carried-dumbbell and seated-row-rope media rendered and played, with 17 sampled frames per motion. Evidence remains under ignored `.local-artifacts/`.
- Production build verified separately in `.next-workshop-audit`. Turbopack's CSS worker crashed on this host; the supported Webpack production build passed.

The temporary production server was stopped. The existing development checkout/server and unrelated uncommitted changes were preserved. Next.js's automatic temporary-dist additions to `tsconfig.json` were removed after verification.

The final production performance scenarios use Chrome/SwiftShader, the same authored scenes, 1440×1000, fixed Economy resolution and 15-second captures. These are software-renderer smoke tests, not physical-device budgets or a direct FPS comparison with the audit's development-mode 1280×720 measurements.

| Workload | Editor commits during measured playback | Pose solves per rendered frame | Mean measured solve time |
| --- | ---: | ---: | ---: |
| Blank | 0 | 1 | 0.42ms |
| Held dumbbells | 0 | 1 | 0.73ms |
| Cable-row machine | 0 | 1 | 0.93ms |

All three fixed-resolution profiles were valid. Initial Auto captures correctly flagged their adaptive resolution changes; tests now fix resolution before collecting comparable profiles. Source measurements: `.local-artifacts/efficiency-review/{blank,held,machine}-performance.json`.

## Remaining validation

Physical low/mid-range devices, constrained-network transfer/decode timings and an uncoached new-user trial require external testing. No hardware thresholds or usability success claims were inferred from software rendering or automated checks. Firefox/Safari were not rerun for this change.

Before a new-user trial, use these proposed thresholds: at least four of five unfamiliar participants capture Start within three minutes, capture Finish and save/reload within eight minutes, and complete without coaching. Each participant must recover from one incorrect edit using Undo. Record time to first capture, misclicks, help requests, recovery and successful reload. Revisit thresholds before recruitment if the intended audience changes.
