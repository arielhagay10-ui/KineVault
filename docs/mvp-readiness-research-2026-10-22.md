# MVP readiness research, 22 October 2026

KineVault already has substantial implementation and local release checks. The next useful work is failure recovery, a small beta rehearsal, and evidence from the intended deployment. A larger feature set is not needed to establish those results. This is a source/code review, not a fresh production certification.

`ARCHITECTURE.md` currently chooses local delivery. Public-launch steps below become gates when the owner chooses external access. `SPEC.md`'s 11 October policy allows explicit immediate publication, with verification afterward. Keep that distinction in beta tests and contributor copy.

## Already covered

| Area | Repository evidence | Remaining distinction |
| --- | --- | --- |
| Draft privacy and moderation | `ARCHITECTURE.md`; server authorization, RLS, immutable published snapshots, reports/hide/restore | Rehearse the current publication policy with a contributor and reviewer. |
| Auth and email safety | `docs/authentication.md`; confirmation/recovery flows, generic account responses, validated local redirects, provider limits | Local Mailpit success does not prove external delivery. |
| Database and media recovery | `docs/operations-validation.md`; isolated database upgrade/restore and independent media-byte restore drills | Real backup retention and an actual deployment restore remain operator evidence. |
| Browser and accessibility | `docs/browser-accessibility-readiness.md`; axe, reflow, keyboard dialogs, named canvas alternatives, multiple browser projects | Manual screen readers, physical devices and Safari decoding remain explicitly pending. |
| Startup and rendering performance | `PERFORMANCE.md`; JS/request budgets and no eager public model fetches. `docs/readiness-implementation.md` adds measured local hardware results | These historical measurements do not establish current production percentiles. |
| Deployment preflight | `docs/deployment-readiness.md`; bounded probes, migration manifest and expiring operator records | A green liveness endpoint alone does not prove workers, SMTP or database readiness. |

The existing separation of database and object backups is correct: Supabase backups contain Storage metadata rather than object bytes. Preserve it. [Supabase backups](https://supabase.com/docs/guides/platform/backups).

## Concrete gaps and next steps

1. Add root-layout error recovery. `src/app/error.tsx:5` provides route recovery, while `src/app/layout.tsx:21` awaits cookies and identity. No `global-error.tsx` existed at inspection. A small global boundary with its own document and reload action covers layout failures; keep it independent of navigation, auth and theme providers. Next.js documents that a segment boundary cannot catch its own layout. [Error convention](https://nextjs.org/docs/app/api-reference/file-conventions/error).

2. Rehearse one complete beta journey on the final build. Browse Shoulder Abduction + Cable, open detail, register/confirm, create a private movement, save/reload, render, publish explicitly, report, hide and restore through a reviewer. Check anonymous visibility and media at each transition. This is a proposed acceptance exercise based on the current specification, not a new product feature. Reuse existing browser/media suites and disposable fixtures.

3. Finish the manual checks that automation cannot close. Prioritize one physical iPhone/Safari decoded-video + save/reload run and one keyboard/screen-reader run across catalog, auth and workshop controls. Review retained axe incomplete nodes. Keyboard operation and pause controls for ongoing automatic motion matter for this product; existing numeric controls, native video controls and reduced-motion handling are useful foundations, not proof of a full pass. [W3C keyboard guidance](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), [pause/stop/hide guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).

4. Decide indexing before public discovery. `src/app/layout.tsx:16` supplies only a generic title/description. The public exercise page has no per-exercise metadata or canonical URL, and there is no sitemap. Prefer exercise-specific title/description first. Add a published-only sitemap later, after choosing the HTTPS origin and verifying hidden entries disappear. Do not expose signed media URLs, private IDs or share tokens in discovery output. These are discovery improvements, not blockers for a local or invited beta. [Next.js production guidance](https://nextjs.org/docs/app/guides/production-checklist).

5. Measure the deployed public routes before further optimization. Reuse the existing budgets, then measure mobile loading and interaction through the public hostname. Local response timings and GPU tests measure different things. Google's reference targets are LCP <=2.5 seconds, INP <=200 ms and CLS <=0.1 at the 75th percentile, separately for mobile and desktop. Start with lab evidence; collect field measurements once traffic exists. [Web Vitals](https://web.dev/articles/vitals).

## Indexing details

`next.config.ts:12` already sends private/no-store, no-referrer and noindex headers for `/auth/**`, `/check-email`, `/shared/**` and `/internal/render/**`. Matching pages also supply robots metadata. `src/app/robots.ts:3` disallows admin/private route families. Sign-in, sign-up and password-reset entry pages lack explicit noindex; admin, dashboard, library, submission and notification pages also lack explicit route-level noindex.

Extend the existing header rules if these URLs should stay out of search. Review robots rules deliberately: Disallow can leave URL-only search results and prevents crawlers from reading a page's noindex instruction. Keep authentication and RLS as the privacy boundary. [Google robots guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro), [noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

Do not canonicalize distinct filtered exercise lists to an unrelated generic page by default. Canonicals concern duplicate or substantially similar content; choose a policy for filters and pagination before generating them. [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

## Operator-only requirements before public access

- Select the actual hosting/database project and verify its migration history. The 7 October connected-project audit in `docs/operations-validation.md` identified a different schema; that historical audit does not establish the current remote state. Do not apply exercise migrations merely because a project is connected.
- Configure HTTPS, exact Auth redirects, verified custom SMTP and domain records. Verify signup and recovery in a consented inbox outside the project team. Supabase's default mail service is for non-production use and restricts recipients. The notification worker's Resend key does not configure Auth SMTP. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- Record real database/object restore, worker restart/retry, notification inbox and alert-receipt results using the existing deployment evidence format. Assign the alert recipient and moderation operator. Reuse existing tools before buying monitoring software.
- Review project security/advisor settings, administrator MFA, email limits and service capacity for the intended beta size. Supabase documents these production controls and enforces configurable Auth limits. Keep the existing application cooldown separate from authoritative provider limits. [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [Auth limits](https://supabase.com/docs/guides/auth/rate-limits).

No external deployment, account-setting mutation, test email or production certification was performed for this research.

## Implemented after this review

The local code now includes standalone root-layout recovery, noindex response directives for account/private/admin pages, and an original site icon. Public exercise and taxonomy pages remain indexable. The robots caveat above still applies.

The UI pass also added media reload recovery, a catalog retry preserving the current URL, reachable empty-search resets, long-name wrapping and unavailable saved-exercise cards. The current cable demonstration played and decoded frames in Chrome during inspection; the earlier failure was not reproduced. Forced media failures and MP4 fallback have regression coverage.

Use [the beta checklist](mvp-beta-checklist.md) for the next rehearsal and manual checks. External deployment evidence and physical-device/screen-reader checks remain separate work.
