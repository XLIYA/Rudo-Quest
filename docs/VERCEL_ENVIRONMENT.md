# Vercel Environment Setup

This application is designed for Vercel, Supabase Auth/PostgreSQL, private
Supabase Storage for profile assets, a GitHub App integration, Upstash Redis
rate limiting, Supabase Cron/Vault, Web Push VAPID keys, and optional Sentry reporting.

`.env.production` is useful only for local production-mode verification. Do not
commit it. Vercel deployments read environment variables from Project Settings,
not from a committed `.env.production` file.

## Public and Server-only Variables

Variables with the `NEXT_PUBLIC_` prefix are public. They are available to
browser code and can be bundled into client JavaScript. Every other variable in
this project is server-only and must stay out of browser code, logs, screenshots,
and client-visible configuration.

| Variable                               | Scope       | Required for production                     | Where the value comes from                                                                                                                                                                                                                            |
| -------------------------------------- | ----------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | Public      | Yes                                         | The canonical production URL in Vercel, for example `https://app.yourdomain.com`. Use the assigned Vercel production domain or your custom domain from Vercel Project Settings > Domains. Do not include a trailing slash.                            |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public      | Yes                                         | Supabase project URL from Supabase Dashboard > Project Settings > API.                                                                                                                                                                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public      | Yes                                         | Supabase publishable key from Supabase Dashboard > Project Settings > API Keys.                                                                                                                                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Public      | Legacy fallback                             | Legacy Supabase anon key name. Leave unset when `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is set.                                                                                                                                                        |
| `SUPABASE_SECRET_KEY`                  | Server-only | Yes                                         | Supabase secret key from Supabase Dashboard > Project Settings > API Keys. This bypasses RLS and must never be exposed to the browser.                                                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server-only | Legacy fallback                             | Legacy Supabase service role key name. Leave unset when `SUPABASE_SECRET_KEY` is set.                                                                                                                                                                 |
| `SUPABASE_JWKS_URL`                    | Server-only | Not used by current app                     | Supabase JWKS URL for runtimes using direct JWT verification. The current Next.js SSR implementation does not need it.                                                                                                                                |
| `DATABASE_URL`                         | Server-only | Yes                                         | Supabase PostgreSQL connection string from Supabase Dashboard > Project Settings > Database > Connection string. Use the pooled/serverless connection string when available, include the database password, and keep SSL enabled for hosted Supabase. |
| `GITHUB_APP_ID`                        | Server-only | Required when GitHub integration is enabled | GitHub App settings page, under App ID.                                                                                                                                                                                                               |
| `GITHUB_APP_SLUG`                      | Server-only | Required when GitHub integration is enabled | The slug in the GitHub App URL: `https://github.com/apps/<slug>`.                                                                                                                                                                                     |
| `GITHUB_APP_CLIENT_ID`                 | Server-only | Required when GitHub integration is enabled | GitHub App settings page, under Client ID.                                                                                                                                                                                                            |
| `GITHUB_APP_CLIENT_SECRET`             | Server-only | Required when GitHub integration is enabled | GitHub App settings page, Client secrets section. Generate a client secret and copy it once.                                                                                                                                                          |
| `GITHUB_APP_PRIVATE_KEY`               | Server-only | Required when GitHub integration is enabled | GitHub App settings page, Private keys section. Generate a private key and paste the PEM into Vercel. Escaped `\n` newlines are supported by the app.                                                                                                 |
| `GITHUB_WEBHOOK_SECRET`                | Server-only | Required when GitHub integration is enabled | A random secret you create, for example `openssl rand -hex 32`. Enter the same value in the GitHub App webhook settings and in Vercel.                                                                                                                |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`         | Public      | Required for push notifications             | The `publicKey` from `npx web-push generate-vapid-keys --json`.                                                                                                                                                                                       |
| `VAPID_PRIVATE_KEY`                    | Server-only | Required for push notifications             | The `privateKey` from `npx web-push generate-vapid-keys --json`.                                                                                                                                                                                      |
| `VAPID_SUBJECT`                        | Server-only | Required for push notifications             | A contact subject for push services, usually `mailto:ops@yourdomain.com` or `https://yourdomain.com`.                                                                                                                                                 |
| `UPSTASH_REDIS_REST_URL`               | Server-only | Yes for production rate limiting            | Upstash Redis REST URL from the Upstash Console or the Upstash Vercel integration.                                                                                                                                                                    |
| `UPSTASH_REDIS_REST_TOKEN`             | Server-only | Yes for production rate limiting            | Upstash Redis REST token from the Upstash Console or the Upstash Vercel integration.                                                                                                                                                                  |
| `CRON_SECRET`                          | Server-only | Yes for scheduled notifications             | A random secret, for example `openssl rand -base64 32`. Store the same value in Vercel and encrypted Supabase Vault using the configuration command below.                                                                                            |
| `NEXT_PUBLIC_SENTRY_DSN`               | Public      | Optional                                    | Sentry project DSN from Sentry Project Settings > Client Keys. Required only if browser/server error reporting is enabled.                                                                                                                            |
| `SENTRY_AUTH_TOKEN`                    | Server-only | Optional                                    | Sentry auth token with source map upload permissions. Required only for production source map upload during `next build`.                                                                                                                             |

The `SEED_ADMIN_*` variables in `.env.example` are development seed inputs.
They are not required in Vercel production.

## Supabase Setup

Create a production Supabase project. In Project Settings > API, copy the
Project URL into `NEXT_PUBLIC_SUPABASE_URL`, the publishable key into
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the server secret key into
`SUPABASE_SECRET_KEY`. The app still accepts the legacy
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` names, but new
Vercel environments should use the current publishable/secret names.

The Vercel Production Supabase variables should use this shape:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<copy the full sb_publishable value>
SUPABASE_SECRET_KEY=<copy the full sb_secret value from Supabase API Keys>
SUPABASE_JWKS_URL=https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
```

`SUPABASE_JWKS_URL` is listed for completeness because Supabase exposes it for
direct JWT verification. This app currently uses `@supabase/ssr` and
`@supabase/supabase-js`, so the JWKS URL is not required by runtime code.

In Project Settings > Database, copy the PostgreSQL connection string into
`DATABASE_URL`. Use the direct or pooled connection string recommended by
Supabase for serverless deployments. Replace the password placeholder with the
real database password, and keep SSL enabled for hosted Supabase.

In Authentication > URL Configuration, set the Site URL to
`https://<your-app-domain>`. Add redirect URLs for the exact production origin
and any preview origins that will use this same Supabase project. The safer
production pattern is separate Supabase projects for Development, Preview, and
Production so preview deployments do not share production users or data.

Create or verify the private Storage bucket named `profile-assets`. It must be
private, should have a 4 MB file size limit, and should allow
`image/jpeg`, `image/png`, and `image/webp`. The local seed script can create
this bucket, but production should be verified in the Supabase dashboard before
release because profile assets are displayed through signed URLs.

Store the Cron URL and bearer credential in Supabase Vault, then run migrations
against the production database before the first production deployment. Loading
`.env.production` this way keeps values out of command output:

```bash
node --env-file=.env.production scripts/configure-supabase-cron.mjs
node --env-file=.env.production src/db/migrate.mjs
```

Run production seeding only if you intentionally want to create a production
admin account. The development seed variables are not part of the normal Vercel
production configuration.

## GitHub App Setup

Create a GitHub App from GitHub Settings > Developer settings > GitHub Apps.
Set the Homepage URL to `https://<your-app-domain>`.

Set the setup/callback URL to:

```text
https://<your-app-domain>/api/github/installations/callback
```

Set the webhook URL to:

```text
https://<your-app-domain>/api/webhooks/github
```

Create a random webhook secret with `openssl rand -hex 32`, enter it in the
GitHub App webhook secret field, and save the same value as
`GITHUB_WEBHOOK_SECRET` in Vercel.

Use the minimum required repository permissions. For the current V1 repository
connection flow, repository Metadata read access is sufficient. If future
features read issues, pull requests, or contents, add only the exact permission
needed for that feature.

Copy the App ID, Client ID, generated Client Secret, App slug, and generated
private key into the matching Vercel variables. Use a separate GitHub App for
Production and Preview if preview deployments need to exercise the full install
callback flow, because GitHub App callback URLs are environment-specific.

## Upstash Rate Limiting

Production should use Upstash Redis. Without Upstash credentials, production
rate-limited routes return `INTEGRATION_NOT_CONFIGURED` rather than silently
allowing unlimited sensitive requests.

The simplest setup is the Upstash Vercel integration. Install the integration,
select the Vercel project, create or attach a Redis database, and let the
integration add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
Redeploy after the variables are created.

If configuring manually, create a Redis database in the Upstash Console and copy
the REST URL and REST token into Vercel Project Settings > Environment
Variables.

## VAPID Push Setup

Generate one VAPID key pair per environment:

```bash
npx web-push generate-vapid-keys --json
```

Put `publicKey` in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `privateKey` in
`VAPID_PRIVATE_KEY`. Set `VAPID_SUBJECT` to a contact URI you control, such as
`mailto:ops@yourdomain.com`.

Rotating VAPID keys invalidates existing browser push subscriptions. After
rotation, users need to subscribe again from the app.

## Supabase Cron

Migration `0009_supabase_notification_cron.sql` schedules:

```text
POST /api/cron/notifications every 15 minutes
```

Create `CRON_SECRET` with a random value such as:

```bash
openssl rand -base64 32
```

Add the value to Vercel, then run the Vault configuration command shown above.
Supabase Cron sends it as:

```text
Authorization: Bearer <CRON_SECRET>
```

Manual requests without that header should return `401`.

## Optional Sentry Setup

Create a Sentry project for the Next.js app. Copy the project DSN into
`NEXT_PUBLIC_SENTRY_DSN`. If source maps should be uploaded during production
builds, create a Sentry auth token with source map upload permissions and add it
as `SENTRY_AUTH_TOKEN`.

If Sentry is not required for the release, omit both variables.

## Development, Preview, and Production in Vercel

In Vercel, open Project Settings > Environment Variables. Add each variable to
the correct environment: Production, Preview, and Development.

Production should point only to production services: production Supabase,
production GitHub App, production Upstash Redis, production VAPID keys, and the
production domain in `NEXT_PUBLIC_APP_URL`.

Preview should use separate Supabase, Upstash, GitHub App, and VAPID values when
preview deployments need realistic integration testing. If preview should not
exercise GitHub, leave the GitHub variables unset for Preview and the API will
return `INTEGRATION_NOT_CONFIGURED` for GitHub actions instead of using
production credentials.

Development variables can be pulled locally with:

```bash
vercel env pull .env.local
```

Local `.env.local` and `.env.production` files are ignored by git. Keep them out
of commits and rotate any secret that was ever pasted into a public channel.

Vercel environment variable changes are not applied to already-built
deployments. Redeploy after adding or changing variables.

## Safe Secret Rotation

Rotate one integration at a time and redeploy after each rotation.

For Supabase anon or publishable keys, create or rotate the key in Supabase,
update `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel, redeploy, verify login
and API requests, then retire the old key if Supabase exposes an overlap period.

For Supabase service role or server secret keys, create the new key in Supabase,
update `SUPABASE_SECRET_KEY`, redeploy, verify profile asset signed URLs and
server-side profile operations, then revoke the old key.

For GitHub App private keys, generate a new private key in the GitHub App
settings, update `GITHUB_APP_PRIVATE_KEY`, redeploy, verify installation
repository listing, then delete the old private key.

For GitHub client secrets, generate a new secret, update
`GITHUB_APP_CLIENT_SECRET`, redeploy, verify the install start/callback flow,
then delete the old secret.

For `GITHUB_WEBHOOK_SECRET`, update the GitHub App webhook secret and Vercel
variable close together, redeploy, then verify a webhook delivery. Deliveries
during the mismatch window may fail signature verification.

For Upstash, create or rotate the REST token in Upstash, update
`UPSTASH_REDIS_REST_TOKEN`, redeploy, then verify sensitive routes still rate
limit and Upstash metrics receive requests.

For `CRON_SECRET`, update the Vercel variable and redeploy, then rerun
`node --env-file=.env.production scripts/configure-supabase-cron.mjs` so the
encrypted Vault copy changes at the same time.

For VAPID keys, update both public and private keys together, redeploy, and
expect users to resubscribe to push notifications.

For Sentry, create a new auth token, update `SENTRY_AUTH_TOKEN`, redeploy, verify
source map upload, then revoke the old token.

## Post-deployment Verification

The project uses Supabase Cron for its fifteen-minute schedule because the
notification worker must evaluate each user's local reminder time and quiet
hours. The Vercel function remains the authenticated execution boundary, while
the schedule no longer depends on Vercel plan-specific Cron frequency limits.

After deployment, verify the environment from Vercel Project Settings or
`vercel env ls`. Confirm that every production variable is present in the
Production environment and that preview-only credentials are not assigned to
Production.

Run a production deployment after variables are configured:

```bash
vercel --prod
```

Then verify these runtime checks:

```bash
curl -i https://<your-app-domain>/api/me
curl -i https://<your-app-domain>/api/cron/notifications
curl -i \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-app-domain>/api/cron/notifications
```

The unauthenticated `/api/me` request should return `401`. The cron request
without a bearer token should return `401`. The cron request with the production
`CRON_SECRET` should return `200` with a JSON job summary.

Also verify these application flows in the deployed app: sign up, sign in,
create a project, invite and decline an invitation as the invited user, attempt
the same decline as another user and confirm it is rejected, upload an avatar or
banner and confirm it renders, install the GitHub App and connect a repository,
repeat sensitive auth requests until rate limiting returns `429`, and subscribe
to push notifications in a supported browser.

Check Vercel Function logs after each flow. There should be no missing
environment errors, no `INTEGRATION_NOT_CONFIGURED` messages for enabled
production integrations, and no raw secret values in logs.

## References

- Vercel environment variables: https://vercel.com/docs/environment-variables
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase Vault: https://supabase.com/docs/guides/database/vault
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Upstash Vercel integration: https://upstash.com/docs/redis/howto/vercelintegration
- Web Push VAPID keys: https://github.com/web-push-libs/web-push
- GitHub App registration: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app
- Sentry Next.js setup: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
