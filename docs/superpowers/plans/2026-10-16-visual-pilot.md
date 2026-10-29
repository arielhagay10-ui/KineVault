# KineVault visual pilot implementation plan

**Goal:** Deliver the baseline and a working lat-pulldown, Explore, exercise-detail and workshop pilot for the early visual review requested on 16 October 2026.

**Architecture:** Retain the existing solver, scene schema and shared renderer. Add original Blender assets behind a validated internal manifest, lazy loading and the current procedural fallback. Improve the three pilot screens using the existing slate theme, readable anatomy and semantic controls.

**Constraints:** Free tools only. No migration, public API changes, new product features, publishing, deployment or account upgrades. Preserve existing uncommitted work. Expansion to other equipment and website screens requires the user's pilot feedback.

## Tasks

- [ ] Capture desktop/mobile before views, route and equipment inventory, and rendering baseline in `.local-artifacts/visual-pilot/`.
- [ ] Install official portable Blender in ignored local tools; verify headless scripting and GLB export. Record exact source/version/hash.
- [ ] Generate machine and page references. Check Figma permissions; use functional local browser prototypes if unavailable.
- [ ] Generate a rounded, materially differentiated lat-pulldown with separate static structure, moving stack and handle groups at current solver coordinates. Keep cables in the website.
- [ ] Add manifest validation, independent object instances, lazy loading, disposal and fallback tests. Measure geometry and draw calls. Verify at least 17 motion samples and keyframes.
- [ ] Implement representative Explore, exercise-detail and workshop layouts. Retain filter URLs, authorization, keyboard controls, responsive layouts, both themes and Hebrew RTL.
- [ ] Correct outdated Hebrew layout and arm-driven weight guidance without overwriting unrelated documentation.
- [ ] Verify lint, types, units, isolated database checks, affected browser/media flows, save/reload, actual poster/video output and production build. Record any pre-existing failures separately.
- [ ] Inspect before/after evidence and working interactions; refresh Graft. Present the concrete review package and wait for feedback before stages 3–4.

## Execution decisions

- Work in the current checkout because the pilot depends on extensive uncommitted workshop improvements. Do not reset, stash, replace or commit unrelated work.
- Use separate UI and equipment implementers as required by the subagent implementation skill. The primary agent coordinates references, documentation, verification and review.
- The user's supplied plan authorizes pilot implementation. Its early visual review is the expansion gate; additional speculative design approvals would duplicate that gate.
- Keep comparison evidence and downloaded tools ignored. Commit original equipment source and optimized runtime assets, with provenance.

## Verification commands

Use `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:worker`, `npm run db:test`, affected `npm run test:e2e -- ...`, `npm run test:media -- ...`, `npm run test:performance`, and a production build after stopping only this task's development server. Asset tests must exercise real GLB structure and transforms rather than source text matching.
