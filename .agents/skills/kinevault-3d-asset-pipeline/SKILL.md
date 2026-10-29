---
name: kinevault-3d-asset-pipeline
description: Use when creating, inspecting, optimizing, or registering licensed KineVault GLB/glTF equipment assets.
---

# KineVault 3D assets

For equipment concepts, mechanics, grips, seating, contacts, or reach limits, read [KineVault equipment quality](C:/Users/ariel/.codex/skills/kinevault-equipment-quality/SKILL.md).

Use deterministic Blender scripts and the `gltf-transform` CLI where they provide repeatable results. Inspect `docs/equipment-assets.md` when present and follow `ARCHITECTURE.md` for registration.

- Verify dimensions, orientation, scale, origin/pivot, transforms, naming, and contact points.
- Export GLB/glTF with compatible materials; inspect and validate before optimization.
- Check geometry, textures, draw calls, file size, visual appearance, and runtime performance.
- Preserve source files and record asset licensing/attribution. Do not assume Blender MCP is installed.
- Verify the asset in the workshop and public viewer; confirm fallback behavior and disposal.
