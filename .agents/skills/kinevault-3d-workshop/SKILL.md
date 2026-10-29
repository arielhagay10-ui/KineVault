---
name: kinevault-3d-workshop
description: Use when changing KineVault Three.js, R3F, anatomy, equipment, contacts, poses, animation, serialization, rendering, or GPU resources.
---

# KineVault 3D workshop

For equipment concepts, mechanics, grips, seating, contacts, or reach limits, read [KineVault equipment quality](C:/Users/ariel/.codex/skills/kinevault-equipment-quality/SKILL.md).

For nontrivial cross-system work, start with Graft. Follow `ARCHITECTURE.md`, `docs/workshop.md`, and `PERFORMANCE.md`.

- Preserve the single scene owner and solve poses before equipment/contact consumers.
- Keep frame-loop updates out of React state; dispose owned GPU resources.
- Preserve recovery, saved/reloaded movement, and viewer/editor/render consistency.
- Use Workshop MCP for actual interaction, playback, and persistence verification.
- Fetch current Three.js/R3F/Drei API guidance with Context7 when version-sensitive.
