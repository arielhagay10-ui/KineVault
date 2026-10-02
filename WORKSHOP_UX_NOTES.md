# Workshop UX notes — 2026-09-30

1 October follow-up: [72 workshop simplification proposals](WORKSHOP_SIMPLIFICATION_REVIEW.md), reviewed while creating cable row and pec deck exercises. Earlier observations remain below.

Reviewed while repairing the seated unilateral Keenan flap. These are proposed follow-ups, not shipped features or measured user-study findings.

The recent visible coordinates, shoulder alignment, frontal-plane lock and cuff shortcuts work and survive save/reload. The corrected demo uses a bench facing the stack, an 8° right side bend, a 1.7 m pulley and bent seated legs. The seating solver now limits the final ankle rotation after planting the feet.

| Priority | Friction observed in the current workflow | Useful feature |
| --- | --- | --- |
| High | Matching a photo still requires separately arranging the bench, body, tower and pulley. “Beside shoulder” does not express “bench faces stack.” | Aim bench at selected equipment; seated cable presets with adjustable lean, backrest and pulley offset. |
| High | Upright shins and valid ankle angles were not guaranteed by planted foot positions. | Foot-placement presets and automatic fit to seat height, with a visible joint-limit warning. |
| High | A fixed torso lean or resting arm must be repeated across keyframes. A simple rep required 17 authored frames. | Apply a joint pose to all/selected frames; copy/mirror pose; match end to start; generate a smooth out-and-back rep from two poses. |
| High | Scrubbing changes preview time, but joint editing targets the selected keyframe and jumps back to its time. | Show the editing time beside every pose control; “Create keyframe here” and explicit preview/edit states. |
| High | On the captured desktop layout, cuff alignment, placement and pulley height fall below the sidebar fold. There are separate page, sidebar and timeline scroll areas. | Compact attachment card with height, cuff placement and alignment together; sticky selected-item controls and a mobile control drawer. |
| High | Draft changes rely on manual Save scene. The title remains “Untitled exercise” until another details screen. | Autosave with Saved/Saving/Retry states, recovery after reload, and inline naming. |
| Medium | Frontal-plane lock zeros X/Y on both shoulders across all frames. Unlocking does not recover the old poses; Undo is available. | Choose working arm versus both arms; show the affected frames; retain a reversible pre-lock pose. |
| Medium | Editing a tower transform turns off shoulder alignment. The pressed button changes, but a user can miss the mode change. | Editable alignment offsets and a clear “Manual placement” notice with one-click restore. |
| Medium | The Side camera can let the tower hide the working arm; the bench can obscure the chest. | Focus selected joint/attachment, opposite-side camera, and equipment transparency while posing. |
| Medium | Checking slow motion requires changing scene duration, which also changes authored timing. | Playback-only 0.25×/0.5×/1× speeds and single-frame stepping. |
| Medium | Pulley presets are absolute heights, while the atlas is approximately 3.24 units tall and rendered at 0.85 scale. The controls label units as meters. | Normalize body/equipment proportions, offer body-height presets, and allow “shoulder + 20 cm” pulley settings. |

Evidence: `src/components/character/motion-workshop.tsx` (setPose, scrubber, transformObject, manual save and scrolling controls); `src/lib/motion/studio-constraints.ts` (both-arm lock and alignment); `src/lib/motion/anatomy.ts` (atlas dimensions and scale); `.local-artifacts/workshop/keenan-flaps/setup-controls.png` (actual controls layout).

Start with setup presets, bulk pose editing and autosave: they remove repeated work before adding more controls. Follow with explicit editing-time feedback and compact attachment controls. Validate the proposals with new users before treating them as usability conclusions.
