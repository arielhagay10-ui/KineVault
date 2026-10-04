# Workshop improvements

Ideas from the editor, 2 October 2026. All eight changes below are now implemented, alongside the keyboard shortcuts, shortcut guide and editing strip.

| Priority | Change | Why it helps |
| --- | --- | --- |
| Next | Named undo history such as “Move bench” and “Change finish pose” | Shows what Ctrl+Z will restore. Group an entire slider gesture into one entry, as mouse drags already do. |
| Next | Keep the preview visible while scrolling selected-item controls | Helps compare each adjustment with the actual pose. Collapse secondary settings on small screens. |
| Next | One selected-item panel with Placement, Contact and Movement sections | Reduces the long control list. Show the relevant sections for the selected equipment or body part. |
| Next | Highlight the selected equipment in the preview and its list row | Makes it clear which item a move, duplicate or Delete will affect. |
| Later | Compare start and finish side by side | Makes unintended torso movement, slipping grips and inconsistent feet easier to spot. Keep both views on the same camera. |
| Later | A labeled timeline with Start, Finish and Return markers | Makes the repetition easier to read than a row of times. Show preview time separately from the pose being edited. |
| Later | A focus mode with a larger canvas and a compact inspector | Gives posing more room on desktop while keeping Save, Undo and playback available. |
| Later | Save personal equipment setups | Reuse a bench, grip, pulley height and camera without rebuilding the setup for every exercise. |

Implementation notes:

- Edit history names scene changes. Pointer drags and repeated slider arrow-key adjustments produce one Undo entry; no-op gestures produce none.
- Equipment, Position, Contacts, Pose, Timeline, View, Setups and Settings have direct tabs. One panel is visible at a time. Desktop preview and controls scroll independently; on small screens the tabs stay visible and the preview scrolls away so it cannot cover controls. Selecting equipment or a joint opens its relevant controls. Bench positions and machine movement sit at the top of their panels.
- The workshop fills the browser window by default. The canvas grows with the available height, with playback and an editing-pose selector underneath. Add equipment, Pose body and Preview & save form the main action sequence. Tools and the tutorial occupy the side panel; zoom and fit stay on the scene. Full screen expands the complete editor, including its controls.
- Equipment selection uses a bounding outline in the preview and a bordered list row.
- Compare start and finish uses two static, full-scene views with linked orbit, pan and zoom. It keeps preview time separate from the pose being edited.
- The timeline names Start, Finish and Return, with separate preview markers. Extra poses retain their numbered labels.
- Focus mode, under More, hides the name row to give the canvas extra space. Save and Undo remain available, and playback stays below the scene. Escape exits focus mode.
- Personal equipment setups store static equipment at the start, body placement, contacts, bench seating, pulley height and camera preset. They are account-scoped on this device, with a limit of 12. Applying replaces placement and equipment while preserving exercise poses and duration, in one Undo step. Review contacts after applying.

Autosave, recovery, camera presets, slow playback and bulk pose tools remain available.
