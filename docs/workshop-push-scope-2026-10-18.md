# Workshop push scope

Base commit: `b81e52e9573bf8964ae529b0849d3440f9de8ada`.

The workshop has uncommitted prerequisites. Its component imports the new editor modes, gesture ownership, limb/transform handles, equipment models and shared-dumbbell solver. Include those modules, their tests, licensed assets and attribution together. Removing individual files from this group requires another dependency check.

The proposed changes cover:

- Workshop controls, recovery, navigation, mobile layout, tutorial, selection and precision fixes.
- The supporting 3D runtime, equipment assets and generation sources, preview quality and shared-dumbbell grip validation. Include `20261017114855_shared_dumbbell_grip.sql` and its database test. Apply the migration without resetting development data.
- Workshop browser/media/accessibility/performance tests, their shared fixtures, installed-Firefox runner and local browser configuration. Include private-exercise, row-height, row/pec-deck and studio-machine tests because they call the changed workshop helper.
- Workshop documentation and isolated build-directory support. Include only the `distDir` change in `next.config.ts`; its package-import optimization is outside this scope.

Keep authentication, administration, catalog/page redesign, agent configuration, local logs, generated build directories and unrelated curation-script changes outside this patch. The unchanged application pages are retained from the base commit in the isolated candidate. In particular, exclude `character-preview.tsx`: its separate homepage redesign removes the movement viewer used by existing anatomy coverage.

Review artifacts are under ignored `.local-artifacts/workshop-push-scope/`: `files.txt` lists the exact paths, `scope.json` records exclusions and dependencies, and `workshop.patch` includes new files and binary assets. The source snapshot in `candidate/` overlays only this scope on the base commit. No environment files or installed dependencies belong in the patch.

The previous audit verified the complete dirty workspace. This candidate separately passes lint, typecheck, 790 unit tests, 66 worker checks, 725 isolated database checks and eight production browser flows. Camera-to-Move and legacy-barbell move/save/reload also pass against the final production build. Its unit/worker counts differ because unrelated authentication and curation changes are excluded. See [the workshop audit](workshop-audit-2026-10-18.md) for the broader evidence and remaining physical-device limits.

The final candidate build uses Next's supported Webpack builder. The first fresh Turbopack build passed, but repeat builds of this nested source copy needed a Git boundary to prevent Tailwind scanning generated binaries. Turbopack then rejected the shared dependency junction outside that boundary. Webpack permits it. This is a local verification constraint; no application CSS or renderer workaround is included.

The patch contains 198 paths. It applies to an untouched copy of the base commit with strict whitespace checks. All 197 resulting files and the one deletion match the candidate. The dependency scan finds no changed imports outside the proposed scope. Final review covered gesture ownership, cancellation, draft recovery, frame ordering, GPU resource ownership, asset loading, shared grip prerequisites, validator migration and fixture safeguards. No remaining blocking defect was identified in that review.

Suggested commit subject: `Improve workshop editing, equipment rendering and verification`.

Stage only this patch, including the partial `next.config.ts` hunk. After applying it to a branch, rerun checks if its contents or base commit change. Preserve the unrelated working-tree edits.
