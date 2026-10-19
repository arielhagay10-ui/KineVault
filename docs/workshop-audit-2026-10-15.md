# Workshop audit, 15 October 2026

The workshop's editing and saving foundations work. Its main problems are the small working canvas, confusing interaction and save concepts, and unnecessary work in the editing/render path. Improve those before adding features.

Scope: current working tree, including uncommitted workshop changes. Audit only; application code and existing user drafts were preserved. Browser fixtures created disposable local accounts and cleaned them up.

The interface is recognizably an exercise-authoring tool and uses a consistent visual system. Its hierarchy and interaction model need simplification. Provisional technical audit score: 12/20. Accessibility 3/4, performance 2/4, responsive usability 2/4, theming 3/4, implementation integrity 2/4. Scores reflect this bounded review, not accessibility certification. Backlog: 0 P0, 7 P1, 11 P2, 2 P3.

## Verification

| Check | Result |
|---|---|
| Workshop/motion unit tests | 514 passed across 60 files |
| Lint | Passed |
| Typecheck | Passed |
| Existing browser checks | 19 passed, 1 failed |
| Additional performance probe | Passed; diagnostic measurements below |
| Automated accessibility | Light/dark workshop tools, equipment dialog, Hebrew checks and 320px playback reflow passed |
| Interaction coverage | Selection, constrained nudges, Undo, cancellation, numeric edits queued behind autosave, unnamed saves, saved/reloaded placement, tutorial, keyboard dialog focus and Android touch selection |
| Graphics recovery | WebGL-unavailable fallback, usable Save and retry-to-ready passed |
| Impeccable detector | Zero findings across workshop shell, manipulation controls, playback controls and equipment picker |

The failing browser test is `tests/e2e/workshop-mode-layout.spec.ts:48`. It expects limb instructions inside the preview. The current implementation renders them in the inspector at `motion-workshop.tsx:872`; the expected direction-lock sentence is absent. This is a stale test contract and a guidance/discoverability problem, not evidence that limb manipulation itself is broken. The test stops before its remaining mobile/fullscreen checks.

Initial unit execution hit sandbox temporary-file errors. Rerunning with a workspace-local TEMP/TMP passed. Browser tests needed access outside sandbox isolation to reuse the existing development server. Neither initial infrastructure failure is counted as an application defect.

No production build, database suite, physical-device benchmark, Firefox/Safari run, or rendered-media review was performed. This audit did not change implementation or schema. Existing development server remained running.

## Measurements

Source: `.local-artifacts/workshop-audit/measurements.json`. Chrome with SwiftShader against Next development mode, 1280 x 720. These numbers describe software rendering and development overhead, not production hardware performance.

| Measurement | Observed |
|---|---:|
| Canvas without recovery banner | 904 x 240px |
| Canvas with existing recovery banner, separate UI inspection | 904 x 177px |
| Mobile canvas, probe at 390 x 844 | 374 x 240px |
| Anatomy response encoded body | 8,156,644 bytes |
| Anatomy GLB decoded body | 9,920,700 bytes |
| Anatomy resource duration on localhost | 243ms |
| Idle main-thread task time | 0.41ms per second |
| Idle JS heap | 71.9MB |
| Held-dumbbell playback frame interval, median / p95 | 133.3ms / 137.6ms |
| Equivalent median frame rate | About 7.5fps |
| Playback main-thread task time | 369ms per second |
| Editor React commits during 15.94 seconds of playback | 119, about 7.5 per second |
| Playback renderer sample | 6 calls, 20 geometries, 2 textures |

Idle behavior is good. The renderer already uses demand rendering, pose reuse on camera-only frames and shared anatomy preparation. Preserve these optimizations. Do not treat geometry count or software-rendered frame rate alone as proof of a GPU bottleneck or memory leak.

## Ordered backlog

P1 means address before calling the workshop broadly ready. P2 means the next simplification/performance pass. Observed behavior, source-confirmed costs, and proposals are distinguished below. Order combines user impact and confidence; performance savings remain to be profiled individually.

### 1. P1: Give the canvas enough room to work

Observed: at a common laptop size, the canvas is only 240px tall, falling to 177px with recovery. The body and its joints become tiny while header, toolbars, camera buttons and playback consume most vertical space. Mobile initially puts playback and the inspector below the viewport.

Evidence: `src/components/character/motion-workshop.tsx:769`, `:783`, `:812`, `:823`, `:833`, `:843`. Screenshots: `.local-artifacts/workshop-audit/desktop-1280.png` and `mobile-390.png`.

Change: combine header/action rows, make recovery a compact expandable notice, integrate camera presets and compact playback, and give the canvas a protected useful height. Retain 44px touch targets by removing redundant rows rather than shrinking every button. Accept when 1280 x 720 and 390 x 844 let a user select a wrist and inspect contact without first discovering fullscreen or extensive scrolling.

### 2. P1: Show failed edits visibly

Source-confirmed: failed weight carrying and contact edits call `setStatus`, but the status footer becomes `sr-only` unless the message starts with Removed or the tutorial is open. Sighted users can receive no explanation when an operation is rejected.

Evidence: `motion-workshop.tsx:236`, `:249`, `:1069`.

Change: separate error, warning and routine status. Show actionable failures beside the affected controls with an alert announcement and preserve input. Test a rejected movement requiring more than 24 moments, then a successful repair. Keep routine Undo chatter unobtrusive.

### 3. P1: Make hand/foot controls describe their actual action

Source-confirmed and visually inspected: round endpoint buttons always have Drag labels/tooltips, but in the default arrow workflow pointer-down selects the endpoint and returns before starting a drag. Actual free dragging requires Drag options > Free drag. The screen shows four prominent movement icons without explaining this distinction beside them.

Evidence: `src/components/character/studio-limb-drag.tsx:66`, `:70`, `:80`; `motion-workshop.tsx:872`; failing layout test above.

Change: default labels should say Select left hand, then show the arrows and a local instruction. Use Drag labels only while free dragging is active. Keep direction-lock help beside the preview. Update and complete the layout test after settling that behavior.

### 4. P1: Remove whole-scene persistence work from live gestures

Source-confirmed: limb pointer moves call into the scene owner. Each scene update normalizes/carries equipment, compares whole JSON scenes, recomputes pose signatures across authored moments and builds a serialized draft snapshot. Recovery synchronously writes localStorage on scene changes even while the autosave paused flag is set.

Evidence: `studio-limb-drag.tsx:60`, `:84`; `motion-workshop.tsx:184`, `:236`, `:551`; `src/components/character/use-workshop-draft.ts:24`, `:46`.

Change: retain an immediate pose/gesture preview outside React, commit one scene/history transaction at gesture end, and rate-limit recovery checkpoints during long gestures. Flush recovery at completion and lifecycle boundaries. Replace repeated whole-scene equality checks with explicit change results/revisions where safe. Test cancellation, long-gesture recovery, release/blur and one-step Undo before accepting the optimization.

### 5. P1: Keep playback updates out of the full editor tree

Source-confirmed and measured: the clock limits display updates to 100ms, but `useMotionPlayback` lives in the 979-line editor component, so every display tick re-executes its controls and derived logic. The probe recorded 119 editor commits in 15.94 seconds.

Evidence: `src/components/character/use-motion-playback.ts:6`, `:15`; `motion-workshop.tsx:177`, `:734`.

Change: subscribe the time label, scrubber and relevant inspector values to the external clock independently. Keep the editor shell and inactive controls stable during playback. Verify with commit instrumentation and the same motion; throttling the clock more would hide work rather than remove it.

### 6. P1: Avoid rebuilding a second rig for display-only grip values

Source-confirmed: `sampleHeldWeightPose(scene, timeMs)` runs from the editor on time changes, even when no joint inspector is in use. For eligible held weights it constructs a rig and solves grips, while the visible figure separately performs its own solve. This is redundant work; its share of frame time was not isolated.

Evidence: `motion-workshop.tsx:216`; `src/lib/motion/held-weight-pose.ts:18`; `src/components/character/motion-canvas.tsx:133`.

Change: request solved inspector values only when needed, and reuse a stable solver/solved result with explicit ownership. Preserve the shared authoring/viewer/render result and contact constraints. Benchmark dumbbell and shared-bar cases before and after; do not cache away scene/time changes.

### 7. P1: Offer a cheaper anatomy path for slow devices and networks

Measured: the model response is 8.16MB encoded, with a 9.92MB decoded GLB. Software-rendered playback is about 7.5fps. Localhost resource duration says nothing about a mobile connection. A text fallback exists for unavailable WebGL, but it does not address supported WebGL that runs slowly.

Evidence: `src/lib/motion/anatomy.ts:5`; `motion-canvas.tsx:117`, `:403`; measurement JSON.

Change: evaluate a lower-detail model and adaptive pixel ratio, preserving muscle selection and licenses. Keep high detail available for contact inspection. Establish budgets on physical low/mid-range devices and constrained networking before choosing thresholds. Measure decode, rig preparation, solver and draw costs separately.

### 8. P2: Give first-time creators a visible task sequence

Observed: the blank editor presents five movement tools, a seven-choice direction menu and eight inspector tabs. After dismissing the tour, there is no persistent explanation of how to complete a simple exercise.

Evidence: `src/components/character/workshop-tool-navigation.tsx:6`; `src/components/character/workshop-manipulation-controls.tsx:28`; blank-editor UI.

Proposal: add a compact Setup > Start pose > Finish pose > Preview > Save progression using the existing editor. Explain the current next action and allow experienced users to dismiss it. Test whether a new user can complete one exercise without coaching; the tutorial test alone cannot establish this.

### 9. P2: Clarify recording versus saving

Observed/source-confirmed: Save first pose/Save pose records a position, Save persists the draft, and background autosave pauses while pose signatures are unrecorded. Both actions use Save language and can compete for primary emphasis. Header Save can also persist the scene and mark its poses recorded.

Evidence: `motion-workshop.tsx:185`, `:306`, `:523`; `src/components/character/workshop-playback-controls.tsx:31`; `use-workshop-draft.ts:92`.

Change: choose one explicit model. Prefer Capture start/Capture pose for recording, and Save exercise for persistence. Show whether edits are captured, stored on this device or saved to the account. Preserve the tested serial save queue and stable draft IDs.

### 10. P2: Keep mobile editing context within reach

Observed: at 390 x 844, scrolling to inspector controls moves the figure and top Save action away. Choosing a tab scrolls its panel into view, further separating controls from their result. Wheel input over the canvas also controls the camera rather than scrolling the page.

Evidence: `motion-workshop.tsx:735`, `:749`, `:769`, `:833`; mobile inspection.

Proposal: use a compact persistent preview or an explicit Preview/Edit switch with a clear return action. Keep capture and save reachable while the keyboard is open. Validate one-handed touch editing and 200% text scaling; passing horizontal-overflow checks is insufficient.

### 11. P2: Unify repeated controls and selection language

Observed/source-confirmed: selection appears in both Selected equipment and the scene list; the figure is listed as equipment. Move/Rotate exist in both the preview toolbar and Position, with 3D arrows under precise placement. Direction appears before there is a selected target to move.

Evidence: `motion-workshop.tsx:873`, `:876`, `:1037`, `:1044`; `workshop-manipulation-controls.tsx:53`.

Change: one scene selector labeled Selected item, one movement toolbar, and an inspector that changes with selection. Display movement direction only when useful. Keep numeric precision and keyboard alternatives.

### 12. P2: Replace overlapping mode flags with explicit editor state

Source-confirmed: interactionMode, tool, posing, limbPosing, freeDragging, panel and selection jointly determine behavior. `selectObject`, `chooseTool`, `chooseManipulation` and `openTool` each change overlapping subsets. This is a maintenance risk rather than a demonstrated invalid-state bug.

Evidence: `motion-workshop.tsx:93`, `:332`, `:606`, `:611`, `:735`, `:837`.

Change: define legal interaction modes and transition events in a typed reducer/controller. Derive toolbar state and allowed actions from it. Keep exactly one scene owner. Extract focused panels only after clarifying state ownership; splitting files alone will not reduce the number of concepts.

### 13. P2: Stop updating inactive inspector panels

Source-confirmed: `WorkshopToolPanel` applies hidden but always renders children. Hidden panels, expanded personal setups and their forms remain mounted as the parent playback state updates.

Evidence: `workshop-tool-navigation.tsx:29`; `motion-workshop.tsx:880`; `src/components/character/workshop-setups.tsx:10`.

Change: memoize/subdivide panel subscriptions and mount expensive panel bodies on demand. Preserve unsaved form fields and focus when switching tabs. Retain cheap mounted content when measurements show it helps state continuity; this is not a reason to indiscriminately unmount every panel.

### 14. P2: Demote secondary tools from the main navigation

Observed: eight tabs wrap into three desktop rows. Setups, View and Settings have equal prominence to Pose and Contacts. The Setups panel initially presents a save-name form even on an empty scene.

Evidence: `workshop-tool-navigation.tsx:6`, `:16`; `motion-workshop.tsx:880`; `workshop-setups.tsx:28`.

Proposal: keep the common creation tasks primary and place reusable setups and infrequent preferences in a secondary menu. Expose useful starting examples near the empty state. Do not delete setups or comparison merely because usage has not been measured.

### 15. P2: Reduce default timeline complexity

Observed: Timeline mixes saved-pose navigation, keyframe terminology, shortcut instructions, a 3/5/9 spacing generator and pose editing. Playback already offers a pose selector. New creators must learn multiple ways of revisiting the same positions.

Evidence: `motion-workshop.tsx:905`, `:917`, `:922`; `workshop-playback-controls.tsx:26`.

Change: begin with Start, Finish and Return using the same names throughout. Put evenly spaced generation, copying, mirroring and exact timing under advanced pose actions. Keep power-user shortcuts. Use pose consistently in user-facing language unless explaining a keyframe.

### 16. P2: Remove legacy authoring controls from ordinary settings

Source-confirmed: Advanced settings exposes Legacy demo equipment alongside scene objects. The renderer also retains separate scene.equipment and studio.objects paths plus motion-style-specific props. Historical compatibility is legitimate; exposing the older representation invites confusing combinations.

Evidence: `motion-workshop.tsx:1055`, `:1061`; `motion-canvas.tsx:173`, `:174`, `:190`, `:194`.

Change: remove the legacy creation selector from the normal workshop. Preserve loaders/migrations and saved-scene compatibility. Normalize into the canonical authoring model when parity has been proven; do not delete historical rendering support blindly.

### 17. P2: Make the next step after movement creation obvious

Observed/source-confirmed: Save & add details is buried in More, while Save stays prominent. A first-time creator has little visible indication of the optional name/instructions/classification stage after movement authoring.

Evidence: `motion-workshop.tsx:810`, `:829`.

Change: after successful saving, offer Add exercise details next to the saved status, with a clear continue-editing option. Keep metadata optional and distinguish private saving from publication.

### 18. P2: Repair the performance and layout test contracts

Source-confirmed: the performance suite labels results production without asserting build mode and clicks a Preview button absent from the current editor. Its four-call/four-geometry limits do not match the probe's held-equipment workload. The layout test stops on relocated instructions.

Evidence: `tests/performance/browser.spec.ts:18`, `:88`, `:134`; `tests/e2e/workshop-mode-layout.spec.ts:48`; measured renderer values.

Change: identify build mode reliably, target current controls, separate blank/held/machine workloads and collect measurements even when a later assertion fails. Budget rendering, solver work and React commits independently. Restore a completed 1280px/800px/mobile/fullscreen layout matrix rather than loosening assertions simply to get green.

### 19. P3: Stop repeating equipment cards across picker sections

Source-confirmed: recent and favorite lists exclude Essentials but not each other. The full catalog excludes only Essentials, so the same equipment can appear in Recent, Favorites and its catalog group. Each repetition includes another large card and favorite action.

Evidence: `src/components/character/workshop-equipment-picker.tsx:70`, `:71`, `:94`.

Change: render each result once with recent/favorite badges or deduplicate groups in priority order. Keep search and common equipment quick to reach. This is UI length and maintenance reduction; no large runtime saving was measured.

### 20. P3: Make recovery choices accurate for new drafts

Observed/source-confirmed: /my-exercises/new can show Keep server version even when the current scene has no saved draft ID. The wording implies that a server copy exists and hides the consequence of discarding recovery.

Evidence: `motion-workshop.tsx:814`, `:816`; `use-workshop-draft.ts:114`.

Change: use context-specific choices such as Restore device draft and Continue with blank exercise. Explain what happens to the recovery copy. Keep the notice compact without weakening recovery.

## What to preserve

- One scene owner, serial saves, persistent UUIDs, owner-scoped recovery and Undo.
- Numeric and keyboard alternatives, touch-sized controls, native dialog focus and Escape handling.
- Demand rendering, shared immutable anatomy geometry and cleanup ownership.
- Accurate grip, foot and bench constraints. Optimize their execution without removing correctness.
- Optional tutorial, localization, private-first saving and explicit WebGL fallback.

There is no usage evidence here proving favorites, saved setups or comparison are useless. Demote their prominence and measure actual use before removal. The strongest deletion candidates are duplicate controls, repeated cards, unnecessary recomputation and the user-facing legacy authoring selector.

## Acceptance order

1. Fix working space, visible failures and truthful hand/foot instructions.
2. Simplify the creation/save sequence and mobile preview-to-controls navigation.
3. Remove gesture serialization, full-editor playback updates and redundant grip solves; repeat identical benchmarks.
4. Simplify state ownership and inactive panels, then remove redundant/legacy UI.
5. Re-run layout, touch, keyboard, accessibility, save/recovery and geometry/media checks affected by each change. Validate a production build separately from the active dev server, then run physical-device and constrained-network benchmarks.

For a new-user trial, ask several people unfamiliar with 3D editors to create and save a simple two-pose exercise without coaching. Record time to first captured pose, misclicks, requests for help, recovery from mistakes and successful save/reload. Set success thresholds before the trial. Automated correctness tests cannot establish that the workflow feels easy.

Suggested Impeccable passes: harden, adapt, clarify/onboard, optimize, distill, then polish. Questions skipped: the requested deliverable is an ordered audit; no product decision or implementation approval is needed to deliver it.
