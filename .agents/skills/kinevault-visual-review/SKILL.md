---
name: kinevault-visual-review
description: Use when reviewing or redesigning KineVault pages for visual quality, responsive behavior, accessibility, or interaction clarity.
---

# KineVault visual review

1. Read `DESIGN.md` and the relevant product requirements in `SPEC.md`. For redesign implementation, follow `frontend-design`; for interface audits, follow `web-design-guidelines`.
2. Inspect the requested route at representative desktop and mobile sizes. Review hierarchy, spacing, type, contrast, focus, keyboard operation, labels, loading, empty and error states. Use screenshots or browser inspection when available; distinguish observed defects from code-only concerns.
3. Trace affected navigation and data behavior before suggesting changes. For catalog work, preserve URL-encoded filters, PostgreSQL filtering/pagination, and Shoulder Abduction + Cable → matching results → exercise detail coverage. On exercise details, inspect the relevant movement, equipment, anatomy, instructions, media and attribution states.
4. Report a short, prioritized list of concrete issues with route/state and evidence. Tie each recommendation to `DESIGN.md` or a specific user task. Avoid broad restyling when a local fix solves the problem.

When implementing a requested redesign, keep the smallest coherent diff and verify the affected responsive and keyboard flows. Do not claim visual validation without inspecting the rendered page.
