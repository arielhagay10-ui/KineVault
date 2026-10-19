# Authentication improvements implementation plan

> For agentic workers: execute the checked tasks in order. Preserve the existing uncommitted Docker and Supabase networking changes.

**Goal:** Offer Google sign-in and make email registration, confirmation, recovery, and login understandable and recoverable.

**Architecture:** Keep Supabase as the identity provider and use the existing request-scoped server client for cookie sessions. Server actions own authentication, Zod validation, and safe redirects. A short-lived HttpOnly cookie holds only the pending email screen's presentation data, never proof of identity. Provider limits remain authoritative.

**Tech stack:** Next.js App Router, React action state, TypeScript, Zod, Supabase Auth, Vitest, Playwright.

**Spec:** User-approved proposal in this chat: Google sign-in alongside email/password; a check-email screen with resend and address correction; actionable expired-link errors; password visibility and destination preservation; documented SMTP and Google setup.

**Status:** Implemented on `codex/auth-improvements`, with uncommitted changes for review. External provider activation still requires the owner's credentials. Read `docs/authentication.md` before continuing setup.

## Constraints

- Preserve unrelated working-tree changes and development database records.
- Use the existing DESIGN.md palette, type, spacing, and accessible form feedback.
- Never expose provider secrets or service-role credentials to the browser or logs.
- Validate destinations as internal paths, including encoded control characters and backslashes.
- Keep public browsing available without signing in.
- Google remains disabled until the provider and app feature flag are configured.
- Local email is captured by Mailpit. External delivery requires the owner's verified sender and SMTP credentials.
- No schema migrations or new runtime dependencies are required.

## Task 1: Authentication boundaries and actions

Files: `src/lib/auth-navigation.ts` and tests, `src/lib/auth-settings.ts`, `src/lib/auth-confirmation.ts`, `src/lib/auth-pending-email.ts` and tests, `src/app/sign-in/actions.ts` and tests.

- [x] Add failing tests for unsafe encoded redirects, unconfirmed sign-in, signup destination continuity, resend cooldowns, provider failures, Google redirects, and password recovery errors.
- [x] Implement `authPath(path: string, next?: string): string` and strengthen `safeNextPath` against URL normalization tricks. Reject auth destinations that loop back into authentication.
- [x] Implement `getAuthSettings(): { siteUrl: string; googleEnabled: boolean }`, using a configured origin and server-only `AUTH_GOOGLE_ENABLED`.
- [x] Implement validated, expiring pending-email presentation data with email, signup/recovery kind, safe next path, and resend time. Mark its cookie HttpOnly and SameSite=Lax; use Secure on HTTPS.
- [x] Extend credential actions with explicit expected-provider error handling. Return generic invalid-credential and account-existence messages. Route unconfirmed accounts to the check-email screen. Preserve `next` through signup, reset, and Google login.
- [x] Add `signInWithGoogle`, `resendAuthEmail`, and confirmation actions. Call Google's provider only when enabled. Enforce a 60-second resend cooldown in the current browser in addition to Supabase's limits.
- [x] Run targeted unit tests, lint, and typecheck.

## Task 2: Confirmation and form screens

Files: `src/components/auth/auth-form.tsx`, `auth-shell.tsx`, `password-field.tsx`, `google-sign-in.tsx`, `cooldown-submit.tsx`, `check-email-form.tsx`, and `confirm-email-form.tsx`; `src/app/check-email/page.tsx`; sign-in, sign-up, reset-password and password-update pages; `src/app/auth/confirm/page.tsx` and `actions.ts` replace `route.ts`; `src/app/auth/callback/route.ts` and tests; `tests/e2e/authentication.spec.ts`.

- [x] Add browser tests covering password reveal without value loss, callback error feedback, safe navigation, and the check-email resend screen.
- [x] Add an auth shell matching the current visual system. Use explicit loading copy, visible keyboard focus, real labels, and accessible errors.
- [x] Show Google on sign-in/signup only when configured. Keep email/password below it. Preserve the destination in cross-links.
- [x] Add show/hide password without clearing input, preserving password-manager autocomplete and validation.
- [x] Add `/check-email` with the submitted address, countdown, resend action, address correction via fresh signup or password reset, and no account-existence disclosure.
- [x] Replace confirmation GET consumption with a confirmation page and explicit server action. Merely opening/prefetching a link must not consume its token. Successful confirmation creates a session and continues to the intended page. Recovery continues to the password-update page. Failed/used links offer a fresh email.
- [x] Display OAuth cancellation, failed callbacks, invalid confirmation links, and reset-link errors using fixed user-facing messages. Never echo provider query text.
- [x] Run focused browser flows and the Impeccable detector. Inspect desktop/mobile once and fix concrete issues.

## Task 3: Local configuration, setup, and delivery

Files: `supabase/config.toml`, new `supabase/templates/confirmation.html` and `recovery.html`, `.env.example`, `scripts/start-local-docker.ps1`, `README.md`, `LOCAL_USE.md`, new `docs/authentication.md`, `DESIGN.md` auth notes.

- [x] Enable local confirmation with Mailpit, align the provider password floor with the app's 10-character minimum, and configure confirmation/recovery templates with token hashes and a safe continuation.
- [x] Preserve the Google app flag when the Docker launcher regenerates `.env.docker`. Document the server-side Google provider credentials and restart steps without inserting credentials into source.
- [x] Document Google Cloud's web OAuth client and exact local callback URI, Supabase provider setup, the app feature flag, HTTPS production callbacks, SMTP sender verification, SPF/DKIM/DMARC, and live Gmail verification still needed from the owner.
- [x] Run all unit tests, isolated database checks, affected auth/catalog browser tests, and a production build. Rebuild/restart the running Docker web service and verify `/exercises` remains available.
- [x] Report implemented behavior and clearly distinguish tested local email from external Google/Gmail setup that requires owner credentials.

## Validation and review notes

- Focused authentication unit tests: 37 passing, including real provider token-format regressions and URL normalization cases.
- Local Chrome checks: registration, real Mailpit confirmation, GET prefetch without consuming a token, password recovery, fresh login, unconfirmed login/resend, callback errors, password reveal, safe continuation, mobile layout, and desktop/mobile axe checks passed.
- Catalog checks passed, including Shoulder Abduction + Cable to a real rendered publication's detail at 1440px and 1024px. Repeated test runs exposed tied fixture queue dates; `tests/e2e/published-catalog.helpers.ts` now moves only its own job before the oldest queued timestamp.
- Isolated database checks: 40 files and 708 assertions passed after applying all migrations to a temporary database.
- The full unit run passed 589 tests and timed out on the existing seated-curl and incline-curl motion checks at their explicit 60-second limits. The baseline run also had motion timeouts; no motion implementation was changed.
- Independent review found a percent-encoded search continuation bug. A failing regression test reproduced it; pathname-only validation fixed it without changing the original query.
- Final lint, TypeScript checks, and the production Docker build passed. The updated web container is healthy. The Impeccable mechanical detector returned no findings.
- Screenshots: `.local-artifacts/auth/sign-in-desktop.png` and `sign-up-mobile-dark.png`. Local generated development route types were refreshed after replacing the confirmation route with a page.

## Remaining owner setup

- [ ] Create/configure the Google web OAuth client and consent screen, set the server-side client ID and secret, enable the Supabase provider, and enable `AUTH_GOOGLE_ENABLED`.
- [ ] Verify an owned sender domain, configure Auth SMTP, and install the templates on a hosted Supabase project if applicable.
- [ ] Check real Google sign-in and delivery/confirmation/recovery in an owner-controlled Gmail inbox. These are external configuration checks, not results established by local tests.
