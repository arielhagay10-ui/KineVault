---
name: kinevault-release-readiness
description: Use when assessing an actual KineVault release or deployment for readiness.
---

# KineVault release readiness

Use only for an actual release/deployment. Follow `docs/deployment-readiness.md` and `AGENTS.md`; use the full required verification suite only here or when a change requires it.

Return exactly one status: `GO`, `GO WITH WARNINGS`, or `NO-GO`. Include blocking failures, test results, performance regressions, migration requirements, operational warnings, and deployment notes. Distinguish verified evidence from pending operator checks. Never invent successful checks.
