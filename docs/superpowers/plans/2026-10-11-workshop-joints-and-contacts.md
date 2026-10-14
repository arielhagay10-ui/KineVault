# Workshop joint and contact corrections

Preserve existing drafts and unrelated work. Deliver these changes together:

1. Reproduce held-dumbbell elbow drift in geometry tests. Persist whether the arm or weight drives motion; joint edits preserve unedited joints, while deliberate weight dragging still poses the arm. Verify contact across 17 samples, saved/reloaded scenes and rendered media.
2. Replace the joint dropdown's duplicated sides with seven families and Left/Both/Right. Mirror anatomical angles for paired editing, respect constraints, and keep one undo step.
3. Share equipment grip capabilities between validation and UI. Benches/racks provide support and placement, never handheld grips. Normalize legacy accidental contacts while preserving equipment and seating.
4. Reduce redundant controls: hide inapplicable grips/animation, put elbow support and pose options behind disclosures, make pose scope a single option, remove duplicate timeline navigation and no-op copy targets.
5. Verify lint, typecheck, all units, isolated database checks, affected browser flows, private rendered media and production build. Restart the development server and retain screenshots in `.local-artifacts/`.
