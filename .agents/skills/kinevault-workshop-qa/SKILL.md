---
name: kinevault-workshop-qa
description: Use when testing real KineVault workshop controls, movement playback, or saved movement persistence.
---

# KineVault workshop QA

For equipment concepts, mechanics, grips, seating, contacts, or reach limits, read [KineVault equipment quality](C:/Users/ariel/.codex/skills/kinevault-equipment-quality/SKILL.md).

Use `tools/workshop-mcp` for real controls, pointer gestures, screenshots, 3D preview, movement playback, and persistence. Use the existing `kinevault-workshop` MCP entry; do not replace it with generic browser MCP.

Create a fresh private draft, inspect controls, interact through the UI, create and play a movement, save privately, reload, and verify persistence. Cover the relevant setup: dumbbell, barbell, cable/attachments, bench/support, or machine travel. Include undo/redo, mobile, or Hebrew layout when affected.

Never publish, submit, or delete during agent QA. On failure capture a screenshot and report exact reproduction steps. Follow `docs/workshop.md` for current controls.
