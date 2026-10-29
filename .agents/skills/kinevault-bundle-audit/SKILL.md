---
name: kinevault-bundle-audit
description: Use when auditing or reducing JavaScript delivered to KineVault routes, investigating slow initial loads, or evaluating bundle splitting.
---

# KineVault bundle audit

Use for route-specific, evidence-based bundle work. For general Next.js analyzer procedures, also follow `next-bundle-optimizer`.

1. Read the target route, its client entry points and package scripts. Use Graft first, then inspect only the relevant spans and importers.
2. Check whether the installed Next.js exposes the analyzer commands described by `next-bundle-optimizer`. KineVault currently pins Next.js 16.3.8; never upgrade it just to run an audit. If unavailable, inspect build manifests/output only when they can attribute chunks to the target route. The existing performance suite measures browser/render performance, not emitted per-route bundle attribution. If no supported source gives defensible route attribution, report the evidence gap and stop before proposing a size fix.
3. Record a production-build baseline for the requested route and shared client chunks. Separate bundle output evidence from browser transfer or timing measurements. Keep artifacts under ignored `.local-artifacts/` and coordinate builds with any active dev server.
4. Trace the largest relevant client contributions to their importers. Do not blame Three.js or split workshop code unless the route graph shows it reaches that route.
5. In audit requests, report candidates without editing code. In fix requests, make one small change, compare like-for-like measurements, and run affected behavior checks.

Preserve URL-backed catalog filters, PostgreSQL pagination, public taxonomy caching, request-scoped identity memoization, and the Shoulder Abduction + Cable → results → exercise detail flow. Report missing measurements and behavior checks plainly.
