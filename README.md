# Rudo Quest

Rudo Quest is a compact collaborative weekly task-management PWA built with Next.js App Router, Supabase Auth/PostgreSQL, Drizzle ORM, TanStack Query, Axios, Serwist, and Vercel.

## Local Setup

Install dependencies with `npm install`, copy `.env.example` to `.env.local`, configure Supabase and database credentials, then run `npm run db:migrate`, `npm run db:seed`, and `npm run dev`.

This application uses Supabase Auth and the database migration references `auth.users`, so local development requires a Supabase local stack or a hosted Supabase project. A plain PostgreSQL database is not enough. The repository includes a `.env.local` template for the current workspace with the standard local Supabase URL, local database URL, and development seed account; fill the anon key and service role key from your Supabase project before seeding.

The development seed creates or updates this verified login:

```bash
npm run db:seed
```

Use the seeded account from `.env.local` to sign in after migrations complete.

Required commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run format
npm audit --omit=dev
git diff --check
npx playwright test
```

## Environment

All variables are listed in `.env.example`. Supabase and `DATABASE_URL` are required for authenticated application flows. GitHub, VAPID, Sentry, Upstash, and Cron credentials are integration-specific; missing optional credentials disable the relevant UI/API action with a typed `INTEGRATION_NOT_CONFIGURED` error.

## Database

Schema lives in `src/db/schema/index.ts`. Migrations `0000_initial.sql`, `0001_audit_hardening.sql`, `0002_integrity_and_delivery_retries.sql`, and `0003_rls_membership_transitions.sql` are applied by `npm run db:migrate`. Drizzle Kit is configured in `drizzle.config.ts`.

## Application

Browser mutations go through Route Handlers via `src/lib/api/client.ts`, the single Axios client. Server Components and Route Handlers resolve the current Supabase user server-side. Business logic is in `src/server/services`, database access is in `src/server/repositories`, and authorization is in `src/server/policies`.

## PWA

Serwist builds `public/sw.js` from `src/app/sw.ts`. The service worker precaches the app shell and offline route, never caches authenticated API responses, and uses IndexedDB-backed, user-scoped TanStack Query persistence for selected reads. Mutations are blocked offline; no mutation queue exists in V1. The app manifest is `src/app/manifest.ts`; icons are in `public/icons`.

## Documentation

Read `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/VERCEL_ENVIRONMENT.md`, `docs/GITHUB_APP_SETUP.md`, `docs/PUSH_NOTIFICATIONS.md`, `docs/PWA_OFFLINE.md`, `docs/AUDIT_FIXES.md`, and `docs/DECISIONS.md`.
