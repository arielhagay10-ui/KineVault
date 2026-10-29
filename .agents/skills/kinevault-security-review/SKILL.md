---
name: kinevault-security-review
description: Use when changing KineVault Auth, RLS, admin, moderation, Storage, workers, sharing, or publication security.
---

# KineVault security review

Use for Auth, RLS, admin, moderation, sharing, Storage, service-role code, worker tokens, render jobs, notifications, and publication. Use official Supabase security guidance and `DATABASE.md`.

Check BOLA/IDOR, ownership and privilege escalation, missing RLS, unsafe `SECURITY DEFINER`, service-role leakage, public Storage access, share-token exposure, moderation/publication bypass, audit bypass, and secrets in logs or client code.

Trace both server actions and database policies. Verify relevant anonymous, owner, non-owner, reviewer, and admin paths. Never expose credentials in prompts, output, or commits.
