# Workshop manipulation

User-approved scope: replace the Quick Create / Advanced split with one editor; preserve all joint, grip, support, timeline and save capabilities. Make deliberate handles the default and retain free dragging as an option.

## Implementation

1. Motion controls: extend `StudioDragPlane` to `view | floor | front | side | x | y | z`. Constrain pointer deltas and keyboard movement consistently, including edge-on views. Fix joint gizmos to show only permitted axes. Add selected-hand/foot translation arrows through the existing limb solver; keep drag cancellation, one Undo entry, contact constraints and GPU cleanup. Add an optional `StudioEditor.limbNudge` request `{ id: number; limb: PoseLimb; axis: "x" | "y" | "z"; amount: number }` consumed once by the selected limb. Test world-space geometry and constrained movement.

2. Editor: remove the mode switch and Quick Create panel. Default to selection and deliberate handles. A compact contextual toolbar offers Move, Rotate, Hands & feet and Free drag; plane and axis selectors and 1 cm / 1 degree nudges follow the selection. Keep numeric fields under disclosures. Preserve Start, Finish, Save pose, intermediate moments, private saving and recovery. Move passive history under More and label its purpose. Update the tutorial to the single editor and document the flow.

3. Browser coverage: migrate former Quick Create tests to the single editor without weakening save, recovery, contact, movement or rendering assertions. Add regressions for constrained movement, no unintended dragging from selection, nudges, Undo/cancel and saved/reloaded poses. Retain catalog filter/detail coverage.

## Validation

Run lint, typecheck and relevant tests after integration. Run all unit tests, isolated database checks, affected browser/media flows and a production build in an ignored isolated build directory, preserving the active server. Review the final diff with a separate reviewer. Inspect desktop/mobile layout and a saved/reloaded movement; keep evidence in `.local-artifacts/`.

## Decisions

- Work in the shared checkout to update the user's running editor and preserve earlier uncommitted focus fixes.
- World axis choices describe scene coordinates. Free dragging defaults to the view plane; axis handles remain explicit.
- Naming dialogs and the equipment picker retain the input focus fix from this chat.
