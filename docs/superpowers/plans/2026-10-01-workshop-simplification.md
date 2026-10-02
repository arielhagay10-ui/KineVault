# Workshop simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement the approved workshop simplification review while preserving private exercises and creator-selected anatomy.

**Architecture:** Keep the current scene format and advanced editor. Add small components/helpers for equipment discovery, guided creation, durable saving and camera controls; integrate them through the workshop shell. Extend the scene schema only for independently adjustable grip/elbow choices.

**Tech Stack:** Next.js, React, TypeScript, Three.js, Supabase, Vitest, Playwright.

**Spec:** C:/KineVault/WORKSHOP_SIMPLIFICATION_REVIEW.md

## Global Constraints

- Default flow: Choose equipment → Adjust start and finish → Preview → Name and save.
- Keep existing private IDs, saved scenes, deliberate muscle selections and advanced capabilities.
- Preserve the existing visual system; use 16px common labels, 14px secondary text, 44px controls.
- Validate every server write and enforce account ownership; do not publish.
- Existing unrelated working changes must remain intact. No commits or checkout changes.
- Human novice/older-adult participation and actual screen-reader speech require people; record these checks as unperformed.

### Task 1: Equipment discovery and creation helpers

**Files:** new src/lib/motion/quick-create.ts and .test.ts; new src/components/character/workshop-equipment-picker.tsx; new workshop-number-field.tsx.
**Interfaces:** export EquipmentOption {slug:string;label:string;active?:boolean}; WorkshopEquipmentPicker({options,onSelect,onClose,ownerKey}); WorkshopNumberField({label,value,onChange,min?,max?,step?,disabled?}); helpers searchWorkshopEquipment(options,query), createQuickScene(slug), generateMachineRepetition(scene,objectId,start,finish), copyWorkshopPose(scene,sourceIndex,targetIndex), mirrorWorkshopPose(scene,index), matchWorkshopLoop(scene).
- [x] Test fuzzy matching, repetition loop, copy preservation and mirror correctness.
- [x] Implement grouped pictorial equipment picker, recent/favorites, Escape/outside close, meaningful empty results.
- [x] Implement numeric transient text with blur/Enter validation and labeled large increment controls.
- [x] Cover review 2,5–8,10,19–20,23–24,29,60,65; run focused tests, lint/typecheck.

### Task 2: Camera and accessible preview

**Files:** motion-canvas.tsx, anatomy-controls.tsx; new workshop-camera-controls.tsx and camera helper/test as needed.
**Interfaces:** preserve MotionCanvas current props and add optional simplifiedControls?:boolean, interactionMode?:'camera'|'edit', onInteractionModeChange?; root uses simplifiedControls and camera/edit callback. Controls own camera view, zoom, fit, reset, selected focus, opposite side, fading and fullscreen. Avoid rig changes.
- [x] Test camera math and fallback states where practical.
- [x] Add large readable controls, static text scene summary, actionable loading/WebGL/error fallback, contact inspection fading.
- [x] Improve anatomy familiar-area search and selected feedback without changing highlights automatically.
- [x] Cover 33–37,53,56–59,66–68. Run relevant camera/anatomy tests, lint/typecheck.

### Task 3: Optional details and reusable private drafts

**Files:** private-exercise-form.tsx, advanced-fields.tsx, my-exercises/actions.ts, my-exercises/page.tsx; new private draft components/helpers/tests.
**Interfaces:** keep savePrivateExercise FormData semantics, introduce duplicatePrivateExercise server action with owner-authenticated reads/writes, library duplicate/template action. Avoid workshop parent/actions/pages owned by Task 4.
- [x] Test selected metadata survives search/collapse and ownership prevents cloning another account's draft.
- [x] Collapse detailed anatomy, show selected chips and only selected role controls; familiar search and no-match help. Keep checked fields mounted.
- [x] Suggest known scene equipment/body position for explicit confirmation; unknown anatomy remains unknown.
- [x] Add owner-only duplicate/template and resumable playable private library cards.
- [x] Cover 9,45,51–56,70; run focused tests and checks.

### Task 4: Guided editor and durable saving integration

**Files:** motion-workshop.tsx; new workshop-quick-create.tsx, workshop-draft.ts/.test.ts, use-workshop-draft.ts, workshop-language.tsx; workshop actions/page and new/page; e2e workshop-quick-create.spec.ts.
**Interfaces:** integrate Tasks 1–3 without removing advanced behavior. Pass initialName and ownerId; saveWorkshopScene(id,scene,name?) returns error and privateId; no revalidation of active editor. Draft hook serializes saves and retains account-scoped recovery until confirmed.
- [x] Test revision races, failed saves/local storage, stale recovery, identical last-saved restore and name validation.
- [x] Default four-step create with back/progress/examples; start/finish controls, one animation action, grouped joints, pose scope/copy/mirror/loop, precise timing Advanced.
- [x] Automatic reversible equipment contact, fit presets/support checklist, locked-control explanation and repair buttons; placement locked while editing motion.
- [x] Autosave/recovery/status/retry/inline name/private playable finish; undo text/scope explanation/navigation guard only unrecoverable work.
- [x] One mobile scroll, collapsible preview, non-drag controls, optional shortcuts, reduced motion, English/Hebrew RTL and localized numbers.
- [x] Cover 1,3–4,11–18,21–22,25–28,30–32,38–50,57–73 (71 human trial documented).
- [x] Run meaningful unit/integration/E2E tests, keyboard/reflow/touch/error recovery checks.

### Task 5: Independent palm and elbow choices

**Files:** scene-schema.ts, studio-machines.ts, studio-machines.tsx if needed; migration and PG tests; grip/elbow helpers/tests; guided controls.
- [x] Test 17 samples plus keyframes using world geometry, independent grip and elbow choices and deliberate highlights preserved.
- [x] Add pictorial palm choices and plain independent elbow-path controls with wrist/reach warnings, defaulting to current motion for legacy scenes.
- [x] Extend validated SQL scene layout only as needed; apply incremental migration, never reset live database.
- [x] Cover 74–75 and verify existing row/regular/reverse contact and saved scenes.

### Task 6: Review and verification

**Files:** evidence under .local-artifacts/workshop/simplification; update WORKSHOP_SIMPLIFICATION_REVIEW.md with numbered coverage and honest validation status.
- [x] Fresh task review after each deliverable, fix findings; final whole-change review.
- [x] Run lint, typecheck, focused/full relevant tests and browser flows.
- [x] Observe desktop/mobile, keyboard, CSS 200% text resize and 320px reflow emulation, touch/error recovery and saved/reloaded exercises; preserve all creator highlights. Native browser zoom and actual screen-reader speech remain unperformed.
- [x] Run impeccable detector once on changed UI targets; record actual outcomes.
- [x] Document unperformed human participant/screen-reader speech checks separately from software completion.


Software implementation and review completed 2 October 2026. Item 71 human trials and portions of item 72 remain unperformed; see WORKSHOP_SIMPLIFICATION_IMPLEMENTATION.md for numbered coverage and exact verification limits.
