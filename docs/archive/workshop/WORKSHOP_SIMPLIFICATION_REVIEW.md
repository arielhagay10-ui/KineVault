# Make the workshop easier to create with

Reviewed 1 October 2026 while creating a cable row and pec deck fly. The approved software improvements were implemented locally on 2 October 2026. See [numbered implementation coverage and verification](WORKSHOP_SIMPLIFICATION_IMPLEMENTATION.md). Human trials and portions of accessibility validation remain outstanding.

Default flow: **Choose equipment → Adjust start and finish → Preview → Name and save**. Keep Advanced editing available. Offer comfortable controls to everyone; age alone does not determine ability.

## First priorities

Machine recipes; automatic seating/grips; two-pose repetition generation; autosave/recovery; readable controls; one animation switch; clear editing scope; optional anatomy details; playable saved result.

## Complete improvement list

### First use

1. Default to Quick create; retain Advanced editing.
2. Offer examples before an empty scene.
3. Show four steps with progress and Back.
4. Give selection-specific next-step instructions.
5. Add short captioned demonstrations and inline help.

### Equipment

6. Search names, synonyms and typos.
7. Use large thumbnail cards grouped into machines, weights and supports.
8. Add recent/favorite equipment.
9. Provide personal templates and duplicate-exercise actions.
10. Dismiss the picker with Escape/outside click; return focus to its button.

### Fit and contact

11. Add machine and engage contact in one reversible action.
12. Show seat, back, feet and hand supports together.
13. Offer body size and Adjust fit presets.
14. Face benches toward the selected machine automatically.
15. Use body-relative pulley heights.
16. Highlight unreachable hands/collisions and offer a specific repair.
17. Explain locked controls beside them; link to the controlling machine.

### Movement

18. Put Row pull / Arm closure before placement settings.
19. Label endpoints with thumbnails: Arms long / Handle near torso; Arms open / Hands together.
20. Generate Start → Finish → Return automatically.
21. Replace the two animation switches with one action.
22. Lock static placement while editing moving parts.
23. Add large ± buttons for small movement increments.
24. Provide range presets and Reset this adjustment.

### Posing and time

25. Group joints by Arms / Legs / Torso, then side.
26. Use plain names for anatomical constraints, with definitions.
27. Show preview time and editing pose together; add Edit this moment.
28. Distinguish Edit this pose from Apply to all poses.
29. Copy poses to chosen/all moments, mirror sides and match the loop end to its start.
30. Put precise coordinates and timing under Advanced.
31. Preview at 0.25× / 0.5× / 1× without changing authored duration.
32. Add previous/next-frame controls.

### Camera

33. Label Camera and Edit modes clearly.
34. Add large Zoom in/out, Fit scene, Reset view and focus-selected controls.
35. Offer an opposite-side view for hidden contacts.
36. Temporarily fade equipment for contact inspection.
37. Provide full-screen preview and an accessible scene summary.

### Saving and recovery

38. Autosave private drafts with server confirmation.
39. Retain a local recovery copy until confirmed saved.
40. Show Saving / Saved at time / Offline / Retry near the title.
41. Preserve work through connection loss, expired sign-in and failed validation.
42. Identify the exact frame/joint/contact that prevents saving.
43. Guard navigation when work cannot be recovered.
44. Offer Restore last saved and Reset to example with clear scope.
45. Name the exercise inline; finish with a playable card and Private status.

### Reversibility

46. Use one Undo operation for global or multi-object changes.
47. Explain scope before applying constraints or replacing attachments.
48. Preserve the prior pose before enabling constraints.
49. Show Removed item — Undo nearby.
50. Give Undo/Redo visible text labels as well as accessible names.

### Details and anatomy

51. Finish with a name and scene; keep anatomy enrichment optional.
52. Collapse detailed classifications initially.
53. Search familiar body areas, synonyms and formal names.
54. Show roles only for selected entries; use readable selected chips.
55. Suggest scene equipment/body position for confirmation; keep uncertain anatomy Unknown.
56. Explain no-match results with examples.

### Readability and input

57. Use 16px common labels, at least 14px secondary copy and comfortable density.
58. Aim for 44–48px targets with spacing.
59. Match accessible names to visible actions, selected limb/machine and units.
60. Keep temporary numeric text; validate on blur/Enter instead of turning an empty field into zero.
61. Support translation, tested RTL and localized units/numbers.
62. Keep shortcuts optional, discoverable and free of single-key traps.

### Mobile and accessibility

63. Use one main scroll; collapse preview and prevent sticky preview covering focused controls.
64. Keep Next/Save reachable without covering content or the keyboard.
65. Provide labeled non-drag alternatives for every essential operation.
66. Announce selection, pose, contact, save and errors in text; reserve alerts for failures.
67. Keep motion optional and support static poses.
68. Add actionable loading, unsupported-3D, retry, empty and permission-error states, with a lightweight fallback.

### Confidence and validation

69. Offer a short support/contact/start/end/saved checklist.
70. Let users continue recent drafts from their library.
71. Test independent completion with novices and older adults with varied vision, dexterity and experience.
72. Test the complete flow with keyboard, actual screen readers, 200% text resize, 400% zoom/reflow, touch and error recovery; measure assistance, mistakes, lost work and time to first preview.
73. Keep muscle selections under the creator's control. Presets can suggest muscles, but changing equipment or regular/reverse modes must preserve deliberate choices, including unconventional uses such as oblique twists.
74. Show grip choices with hand pictures and plain labels such as “Palms toward each other” and “Palms outward.” Preview both hands at the start and finish so users can spot a reversed grip without anatomy terminology.
75. Offer simple elbow-path choices such as “Keep elbows beside the body” and “Arms at shoulder height.” Keep these separate from grip choices, and flag handle placement that forces a wrist bend.

## Original review evidence and limits (1 October)

- Labels/help commonly use 12px text; many buttons are about 29–34px tall. Larger controls would improve comfort. WCAG AA's minimum target is generally 24px; 44px is the enhanced criterion. These controls are not blanket AA failures. [W3C minimum targets](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [enhanced targets](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).
- Visible Row pull / Arm closure labels become Machine travel accessible names; Bend / Turn become X / Y. Match visible and accessible names. [W3C Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html).
- At 320px in the blank workshop, no horizontal overflow was observed, but sticky preview used 58.5% of screen height and partially covered movement controls. This does not complete zoom/focus-conformance testing. [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Machine use, equipment animation and opening the timeline are separate steps. Selected edit time differs from scrubbed preview time. Seventeen frame buttons make the simple case resemble animation software.
- Scene autosave/recovery is absent from the component. Saving can remount the editor and collapse controls. Clearing numbers immediately becomes zero. Escape did not dismiss the equipment menu in the observed flow.
- Details expose long repeated taxonomies and roles for unselected entries. Optional enrichment should follow completion.
- Preserve contact automation, private drafts, Undo, native keyboard controls, focus outlines, numeric alternatives, camera presets, polite status and deliberately started playback.

Readable, zoomable, keyboard-operable interfaces help people with age-related vision/dexterity changes and many other users. [W3C older-user guidance](https://www.w3.org/WAI/older-users/developing/). Drag alternatives need pointer and keyboard checks. [W3C Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

Independent evidence: [design assessment](.local-artifacts/workshop/row-pec-deck/ux-design.md) and [accessibility assessment](.local-artifacts/workshop/row-pec-deck/ux-accessibility.md). Design scored 22/40 across ten Nielsen heuristics (expert judgment); accessibility found 14 manual issues (eight P1, six P2). The detector returned zero findings, which does not establish accessibility.

These observations describe the original interface. Current implementation and save-error recovery results are recorded in [the implementation report](WORKSHOP_SIMPLIFICATION_IMPLEMENTATION.md). Actual screen-reader speech, native browser zoom, measured contrast and novice/older-adult user trials remain unperformed. No WCAG conformance or measured completion-time claim is made.
