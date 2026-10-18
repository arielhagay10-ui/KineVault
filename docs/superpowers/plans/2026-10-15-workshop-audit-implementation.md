# Workshop audit implementation plan

**Goal:** Implement the 15 October workshop audit against the existing working tree.

**Authority:** `docs/workshop-audit-2026-10-15.md`, especially its acceptance order and preservation requirements.

**Global constraints:** One scene owner; serial saves, stable UUIDs, owner-scoped recovery and Undo; preserve contact constraints, keyboard/numeric alternatives, localization, private saving and WebGL recovery. Preserve unrelated changes. Work in this checkout because the audited behavior includes uncommitted changes. No database reset, publication or unrelated commits.

## Tasks

- [x] 1. Workspace and interaction clarity. Consolidate header, compact recovery, protect preview height, truthful endpoint labels, visible rejected-edit alerts. Verify desktop/mobile/fullscreen and failure recovery.
- [x] 2. Creation workflow. Capture terminology, persistent dismissible task guidance, account/device save distinction, details continuation, mobile preview/edit navigation, primary/secondary navigation, one scene selector, advanced pose actions, remove legacy creation controls, deduplicate picker.
- [x] 3. Playback and anatomy. Isolate clock subscriptions from the shell, solve grip values only for the active joint inspector, stable solver ownership, configurable economical rendering with high detail available, repair performance workload/build-mode contracts.
- [x] 4. Gesture persistence. Immediate external scene preview, one commit/history transaction on completion, throttled device recovery, lifecycle flush and cancellation. Verify long gesture, blur/release and Undo.
- [x] 5. State and panels. Typed legal manipulation transitions, focused subscriptions and retained form state without eagerly mounting expensive bodies.
- [x] 6. Verification and docs. Unit, lint, typecheck, database, affected browser/accessibility/media, isolated production build; refresh graft; document benchmark evidence and remaining physical-device/new-user validation.

## Ownership and interfaces

The primary implementer owns `motion-workshop.tsx`, interaction integration, UI and documentation. Independent workers may own canvas/solver quality, gesture infrastructure, and performance/browser contracts, with explicit file boundaries. Integrate cross-file interfaces sequentially. New hooks expose external clocks/scenes without creating a second authoritative scene.

## Verification

Use workspace-local TEMP/TMP. Capture the initial diff under ignored `.local-artifacts/workshop-implementation/`. Use existing disposable browser fixtures and preserve user drafts. Production build must use a separate dist directory from the active dev server. Hardware/network budgets require actual devices; record unperformed validation explicitly rather than inventing results.

## Handoff

Implementation and automated checks are recorded in `docs/workshop-audit-implementation-2026-10-15.md`. Physical-device/network calibration and uncoached user trials remain external validation, explicitly unclaimed.
