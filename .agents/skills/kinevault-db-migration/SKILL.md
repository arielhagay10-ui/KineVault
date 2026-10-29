---
name: kinevault-db-migration
description: Use when changing KineVault PostgreSQL, Supabase, RLS, Auth, Storage, moderation, publication, or audit behavior.
---

# KineVault database changes

Use the official Supabase and Supabase Postgres best-practices skills for current platform guidance. Read `DATABASE.md` and inspect migration callers with Graft before changing schema or policy.

- Preserve RLS and enforce authorization server-side; test anonymous, owner, non-owner, reviewer, and admin paths as relevant.
- Never casually reset development records. Preserve moderation and audit history.
- Keep taxonomy normalized; check duplicate handling, combined filters, and indexes where relevant.
- Regenerate types with `npm run db:types` after schema changes.
- Run `npm run db:test -- --migrations`; add focused load checks only when query performance is affected.

Do not put credentials in Git or logs. Read `DATABASE.md` for repository-specific migration practices.
