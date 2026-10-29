# Equipment assets

The workshop uses original Blender GLBs for all 17 studio equipment families and seven cable attachments. Runtime cables and contact solvers remain authoritative. Every asset contains equipment only; the figure loads separately from the bundled Z-Anatomy model.

## Rebuild

Use Blender 4.5.14 LTS and the existing Sharp dependency:

```powershell
& '.local-artifacts/tools/blender-4.5.14-windows-x64/blender.exe' --background --factory-startup --python scripts/equipment/build_lat_pulldown.py
& '.local-artifacts/tools/blender-4.5.14-windows-x64/blender.exe' --background --factory-startup --python scripts/equipment/build_equipment.py
node scripts/equipment/optimize_thumbnails.mjs
npx vitest run src/lib/motion/equipment-assets.test.ts
```

The generators use only Blender primitives and materials. The lat generator produces its versioned GLB; the expansion generator produces the other 22 GLBs. It also renders 23 transparent source PNGs under ignored `.local-artifacts/visual-rollout/equipment/thumbnails/`; Sharp makes 384-pixel WebP picker files in `public/models/equipment/thumbnails/`. Asset measurements are in ignored `.local-artifacts/visual-rollout/equipment/blender-export.json`.

For a partial refresh, append `-- --only leg-press pec-deck` to the expansion command, then rerun the thumbnail optimizer. The export report preserves measurements for unchanged assets.

## Runtime contract

The converging chest press uses `scripts/equipment/build_chest_press.py` and
dimensions in `src/lib/motion/chest-press.ts`. Independent bottom levers carry
bearing-mounted open handles with horizontal, angled and vertical grip surfaces.
The handles keep their orientation through travel. Its hidden linkage is inferred
from the reference; runtime cables connect the arms to the side stack. Rebuild
only this asset with Blender's `--python scripts/equipment/build_chest_press.py`.
Then run `gltf-transform prune public/models/equipment/chest-press-machine.v1.glb .local-artifacts/chest-press-pruned.glb --keep-leaves true`
and `gltf-transform quantize .local-artifacts/chest-press-pruned.glb public/models/equipment/chest-press-machine.v1.glb`.
Keep empty moving roots and rerun the mesh-contact tests after optimization.

`src/lib/motion/equipment-assets.ts` is the internal manifest. All positions use the existing solver's metre/Y-up coordinates. `Static`, `Weights`, and `Handles` are required for each machine, including empty groups. Pec deck adds `LeftArm` and `RightArm`; cable tower adds `Pulley`; bench adds `Back` and `Brace`. Static equipment and attachments require `Static`. Group names must be unique. Dynamic groups follow the sampled studio object after the pose solve, while cable lines remain runtime geometry. Row handles hide when a cable attachment owns the grip. The bench back follows its authored incline angle; its unit-length brace joins the fixed base to the moving backrest spine.

The renderer validates group names, clones geometry and materials for each instance, disposes resources on unmount, and uses existing procedural geometry during loading or on failure. Equipment and studio lighting readiness gate capture. `src/lib/motion/equipment-thumbnails.ts` is a small, solver-free picker path map. Its slugs match studio objects or `attachment-${kind}`.

Pec pivot housings belong to their moving arms so both machine modes retain the bearing connection. The leg-press sled face meets the solver's two foot contacts; tests measure distance to the shipped mesh triangles at 17 travel samples.

Seats and backrests have connected steel supports, and guide rails connect to the machine frames. Thumbnail cameras fit projected mesh bounds so tall machines and inclined benches remain fully visible. Rigid cable attachments keep unit scale; only cuffs fit the limb radius. The right rope grip mirrors the left so both stoppers sit at the outer ends.

The plate-loaded row and shoulder press add `LeftLever` and `RightLever` groups. Their pivots and rotations share `machineLever` with grip solving and picking. Stool and plyo-box faces support the existing surface picker. Bands use a 512-triangle runtime loop with reusable buffers; their GLB supplies the picker reference. Anchors read solved limbs and rendered equipment transforms. Camera-only frames reuse unchanged band geometry.

The shoulder press has one rigid L-shaped handle per lever. Oblique pivot axes bring the independent arms inward to roughly shoulder width at the overhead finish. The complete handle counter-rotates on an end bearing to keep its orientation fixed, including the wide grip's 15-degree cant and the forward neutral extension. `LeftNeutralGrip` and `RightNeutralGrip` retain their group names for loading compatibility and contain both grip sections. Shared dimensions in `shoulder-press.ts` define the stroke, with an overhead finish below 20 degrees of elbow flexion. Wide elbows follow the body's frontal plane; neutral elbows follow a forward/outward plane to avoid switching near extension. Torso edits pass the seated feasibility guard, and shoulder-follow controls fit each lever independently. Dragging projects onto the same three-dimensional arc used by the solver, fallback geometry and GLB. The rebuilt asset has 3,636 triangles and 12 meshes at 232 KB.

The shoulder press constrains each palm's full rotation throughout the rep. Its bottom stop is -6° and its overhead stop is -37.5°, retaining near-straight elbows within fixed-palm reach. Seated edits also check palm orientation. Full lift/return regressions cover palm drift, wrist position relative to the handle, and adjacent-frame wrist rotation.

The plate-loaded row uses `row-machine.v3.glb`, with neutral and upper-back handles, a movable `Seat` group, and 12° toe-up footplates. The knee-height pivots connect to forward loading arms: pulling the handles raises the plates throughout the stroke. `plate-row.ts` defines the shared contact geometry. Seat height is static across a repetition; each lever can animate independently. The v3 asset contains 4,388 triangles and 15 material draws at about 265 KB.

## Rendering budget

The chest-supported T-bar row is a separate `t-bar-row-machine` object. Rebuild
with Blender's `--python scripts/equipment/build_t_bar_row.py`. The generator
retains a Blender source under ignored equipment evidence and exports the GLB
and thumbnail source. It uses one `Lever` group, a rear pivot and front loading
sleeve, two grip pairs, a 45-degree chest pad and inclined foot platforms.
`src/lib/motion/t-bar-row.ts` defines the shared solver contacts. Quick create
provides a bilateral neutral-grip row with stationary chest and feet and a
controlled return. The 327 KB asset has 4,916 triangles and nine material draws.
Neutral and wide grips share the same lever arc. Contacts exposes grip choice,
individual hand attachments and optional foot support. Releasing foot support
retains the saved leg poses. Migration `20261024164000_workshop_t_bar_contacts.sql`
validates those controls without granting seat or independent-lever settings.
The additional asset raises the aggregate library budget to 3.85 MB; individual
asset limits remain unchanged.

Equipment loads only for objects present in the scene. No mesh textures or new runtime dependencies are needed. Parts merge by material within each moving group. The 24 GLBs total about 3.81 MB across the entire library; a scene loads its selected equipment only. Each asset stays below 1 MB, 20,000 triangles and 16 draws. The bench uses seven draws, including its moving brace. Unit tests enforce these limits and a 3.85 MB total library budget. Measurements and before/after images are under ignored `.local-artifacts/equipment-review/`.

Migration `20261022205401_workshop_versatile_equipment.sql` extends saved-scene validation and equipment taxonomy. Existing scenes retain their previous defaults. The previously bundled Poly Haven HDR retains its separate attribution in `public/models/equipment/ATTRIBUTION.md`.
