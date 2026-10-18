# Equipment assets

The workshop uses original Blender GLBs for all 11 studio equipment families and seven cable attachments. Runtime cables and contact solvers remain authoritative. Every asset contains equipment only; the figure loads separately from the bundled Z-Anatomy model.

## Rebuild

Use Blender 4.5.14 LTS and the existing Sharp dependency:

```powershell
& '.local-artifacts/tools/blender-4.5.14-windows-x64/blender.exe' --background --factory-startup --python scripts/equipment/build_lat_pulldown.py
& '.local-artifacts/tools/blender-4.5.14-windows-x64/blender.exe' --background --factory-startup --python scripts/equipment/build_equipment.py
node scripts/equipment/optimize_thumbnails.mjs
npx vitest run src/lib/motion/equipment-assets.test.ts
```

The generators use only Blender primitives and materials. The lat generator produces its versioned GLB; the expansion generator produces the other 17 GLBs. It also renders 18 transparent source PNGs under ignored `.local-artifacts/visual-rollout/equipment/thumbnails/`; Sharp makes 384-pixel WebP picker files in `public/models/equipment/thumbnails/`. Asset measurements are in ignored `.local-artifacts/visual-rollout/equipment/blender-export.json`.

For a partial refresh, append `-- --only leg-press pec-deck` to the expansion command, then rerun the thumbnail optimizer. The export report preserves measurements for unchanged assets.

## Runtime contract

`src/lib/motion/equipment-assets.ts` is the internal manifest. All positions use the existing solver's metre/Y-up coordinates. `Static`, `Weights`, and `Handles` are required for each machine, including empty groups. Pec deck adds `LeftArm` and `RightArm`; cable tower adds `Pulley`; bench adds `Back` and `Brace`. Static equipment and attachments require `Static`. Group names must be unique. Dynamic groups follow the sampled studio object after the pose solve, while cable lines remain runtime geometry. Row handles hide when a cable attachment owns the grip. The bench back follows its authored incline angle; its unit-length brace joins the fixed base to the moving backrest spine.

The renderer validates group names, clones geometry and materials for each instance, disposes resources on unmount, and uses existing procedural geometry during loading or on failure. Equipment and studio lighting readiness gate capture. `src/lib/motion/equipment-thumbnails.ts` is a small, solver-free picker path map. Its slugs match studio objects or `attachment-${kind}`.

Pec pivot housings belong to their moving arms so both machine modes retain the bearing connection. The leg-press sled face meets the solver's two foot contacts; tests measure distance to the shipped mesh triangles at 17 travel samples.

Seats and backrests have connected steel supports, and guide rails connect to the machine frames. Thumbnail cameras fit projected mesh bounds so tall machines and inclined benches remain fully visible. Rigid cable attachments keep unit scale; only cuffs fit the limb radius. The right rope grip mirrors the left so both stoppers sit at the outer ends.

## Rendering budget

Equipment loads only for objects present in the scene. No mesh textures or new runtime dependencies are needed. Parts merge by material within each moving group. The 18 GLBs total about 2.77 MB, 47,508 triangles and 84 draws across the entire library; a scene loads its selected equipment only. Each asset stays below 1 MB, 20,000 triangles and 16 draws. The bench uses seven draws, including its moving brace. Unit tests enforce these limits and a 3 MB total library budget. Measurements and before/after images are under ignored `.local-artifacts/equipment-review/`.

No database, saved scene, or publication schema changed. The previously bundled Poly Haven HDR retains its separate attribution in `public/models/equipment/ATTRIBUTION.md`.
