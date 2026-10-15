# Authentication

KineVault uses Supabase cookie sessions for email/password and optional Google sign-in. Public exercises remain available without an account. Provider credentials stay on the server.

## Implemented flow

- Sign-in, sign-up, password reset, confirmation, and Google callbacks preserve a validated local `next` destination.
- Sign-up opens `/check-email`. The address is kept in an expiring HttpOnly cookie, not in the page URL. This cookie is presentation data, not authentication or an authoritative rate limit.
- `/check-email` offers resend, a 60-second browser cooldown, email correction, and a sign-in link. Account-existence responses are generic. Supabase independently enforces request and email limits.
- Email links open `/auth/confirm`. A GET does not consume the token. The person clicks Confirm email or Choose a new password before the server verifies the single-use token and establishes a session. This prevents ordinary email link prefetchers from consuming it.
- Confirmation and recovery links use the local templates in `supabase/templates/`. Their nested, URL-encoded `redirect_to` retains the original destination. Only a redirect URL on the configured site and `/auth/confirm` is accepted.
- Recovery always opens `/reset-password/update` before continuing to the original destination. Invalid or used links offer a fresh email request.
- Auth callback pages are private, uncacheable, and send no referrer. Provider error descriptions are never displayed.
- Password fields support password managers and show/hide without losing the value. New passwords require 10 to 128 characters, consistent with local Supabase configuration.

## Local email testing

Local Supabase requires confirmation for new email/password accounts. Existing confirmed accounts remain usable. Emails are captured by Mailpit at [http://127.0.0.1:15424](http://127.0.0.1:15424); they are not delivered to Gmail or other external inboxes.

1. Create an account at `/sign-up`.
2. Open Mailpit and select its confirmation email.
3. Open Confirm email, then confirm on the KineVault page. You are signed in and returned to the original destination.
4. Use Forgot password to test recovery the same way.

After changing `supabase/config.toml` or its templates, restart local Supabase with `npx supabase stop` followed by `npx supabase start`. The normal stop preserves data. Do not use `--no-backup` or a database reset. Restart the app only if its environment changed.

## Enable Google sign-in

Google requires an OAuth client owned by the project owner. The button stays hidden until `AUTH_GOOGLE_ENABLED=true` so an unconfigured provider cannot become a dead end.

1. In Google Cloud, configure the OAuth consent screen for KineVault and create a **Web application** OAuth client. When the consent screen is in testing, add the Google accounts allowed to test it.
2. Add the exact local Supabase callback to the client's authorized redirect URIs: `http://127.0.0.1:15421/auth/v1/callback`. This is the Supabase callback, not the app's `/auth/callback` route. Keep the app and provider on the same `127.0.0.1` origin during local tests.
3. In the shell starting local Supabase, set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` to the client's values. Keep credentials in the shell or ignored environment files. Do not paste them into source, chat, or `NEXT_PUBLIC_` variables.
4. Uncomment the prepared `[auth.external.google]` section in `supabase/config.toml`, then restart local Supabase normally. Keep those environment variables available on later starts.
5. For Docker, set `AUTH_GOOGLE_ENABLED=true` in the ignored `.env.docker` and recreate web with `docker compose --env-file .env.docker -f compose.local.yml up --detach --wait web`. The launcher preserves the flag on subsequent `npm run docker:up` calls. For `npm run dev`, put the flag in `.env.local` and restart that server.
6. Test Continue with Google on both sign-in and sign-up. Verify successful login, cancellation, an existing email account, sign-out, and returning to the original exercise/workshop URL.

For hosted Supabase, enable Google in the Supabase Auth provider settings instead of editing the local CLI config. Use the provider callback shown there. Before public release, configure the production HTTPS site origin, exact allowed callback URLs, Google consent branding, and production audience. A callback on localhost cannot serve other people's computers.

See [Supabase's Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google) and [local OAuth setup](https://supabase.com/docs/guides/local-development/cli/config#auth.external.provider).

## Deliver confirmation emails to Gmail

Gmail is a destination inbox. Sending requires a verified domain and an SMTP provider. KineVault already uses Resend for optional review notifications, so the same provider can supply Auth SMTP; the review email worker is independent of Supabase Auth.

1. Verify a domain you own in the email provider. Add its SPF and DKIM records, plus the recommended DMARC policy. Use a dedicated sender such as `no-reply@auth.<your-domain>`.
2. Copy the provider's SMTP host, port, username, and password from its dashboard. For hosted Supabase, configure these under Auth custom SMTP. For the local CLI, configure the existing `[auth.email.smtp]` example in `supabase/config.toml`, replacing the example sender and referencing the password with `env(...)`. Restart Supabase to apply it. Enabling external SMTP makes local Auth send real email instead of capturing it in Mailpit.
3. For hosted Supabase, copy the HTML from `supabase/templates/confirmation.html` and `recovery.html` into their matching Auth email templates. Local CLI templates are loaded from their configured paths.
4. Keep email confirmation enabled, the minimum password length at 10, and the link expiry at one hour to match the template copy. Review provider request limits for the expected audience. Keep server limits enabled even though the UI also shows a countdown.
5. Set the HTTPS application origin as the Supabase Site URL and allow the exact app `/auth/confirm` and `/auth/callback` redirects with the required continuation query. Do not use an unrelated origin or a production-wide wildcard.
6. Send to an owner-controlled Gmail address and verify inbox/spam placement, From name, confirmation, resending after the cooldown, a used/expired link, and password recovery in a fresh browser. Inspect provider delivery/bounce logs without recording email tokens or credentials.

Real Google login and Gmail delivery require these owner-controlled accounts and credentials. Local tests and mocks cannot establish that those external services are configured.

References: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Resend with Supabase](https://resend.com/docs/send-with-supabase-smtp).
