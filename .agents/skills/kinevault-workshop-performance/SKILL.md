---
name: kinevault-workshop-performance
description: Use when profiling or optimizing KineVault workshop playback, Three.js rendering, GPU use, or saved movement reload behavior.
---

# KineVault workshop performance

Use with `kinevault-3d-workshop` for runtime changes and `kinevault-workshop-qa` for real control and persistence checks.

1. Trace the relevant scene, playback, rendering and persistence paths with Graft before editing. Profile the reported workload first; use the existing `tests/helpers/workshop-performance.ts`, `tests/helpers/workshop-performance.test.ts` and `npm run test:performance` where they cover it.
2. Keep one scene owner. Keep per-frame updates outside React state, solve poses before equipment and contact consumers, preserve recovery paths, and release GPU resources.
3. Change only the measured bottleneck. Preserve playback semantics, scene schema validation, equipment motion correction and media access behavior.
4. Compare the same workload, browser and device before and after. Warm up, collect repeated runs, and compare the same metric using the median when the harness exposes raw samples. Verify the affected workload and real controls. Save and reload a movement, then confirm its movement and rendered media still work. Report unavailable hardware/browser checks and any performance measurement limits.

Store measurements and screenshots under ignored `.local-artifacts/`. Coordinate builds with any active development server. Do not infer a speedup from an in-memory preview or a single noisy timing sample.
