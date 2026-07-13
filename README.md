# Rudo Quest

Rudo Quest is a compact collaborative weekly task-management PWA built with Next.js App Router, Supabase Auth/PostgreSQL, Drizzle ORM, TanStack Query, Axios, Serwist, and Vercel.

## Local Setup

Install dependencies with `npm install`, copy `.env.example` to `.env.local`, configure Supabase and database credentials, then run `npm run db:migrate`, `npm run db:seed`, and `npm run dev`.

This application uses Supabase Auth and the database migration references `auth.users`, so local development requires a Supabase local stack or a hosted Supabase project. A plain PostgreSQL database is not enough. Copy the tracked `.env.example` to `.env.local`, then fill the local or hosted Supabase values before migrating and seeding.

The development seed creates or updates this verified login:

```bash
npm run db:seed
```

Use the seeded account from `.env.local` to sign in after migrations complete.
Local Supabase also auto-confirms newly created development accounts, so the signup flow does not depend on an external mail provider. Hosted Supabase environments continue to require their configured email-verification flow.

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

All variables are listed in `.env.example`. Supabase and `DATABASE_URL` are required for authenticated application flows. GitHub, VAPID, and Sentry are optional integrations. Upstash Redis and `CRON_SECRET` are required in production because rate limiting, overlap-safe scheduled work, notifications, and abandoned-upload cleanup depend on them.

## Database

Schema lives in `src/db/schema/index.ts`. Hand-authored, forward-only SQL in `src/db/migrations` is applied by `npm run db:migrate` under an advisory lock with checksum drift detection. Drizzle Kit snapshots go to `src/db/drizzle`, so generated baselines cannot enter the runtime migration chain.

## Application

Browser mutations go through Route Handlers via `src/lib/api/client.ts`, the single Axios client. Server Components and Route Handlers resolve the current Supabase user server-side. Business logic is in `src/server/services`, database access is in `src/server/repositories`, and authorization is in `src/server/policies`.

## PWA

Serwist builds `public/sw.js` from `src/app/sw.ts`. It caches public shell assets and the offline route, but never authenticated API or protected navigation responses. IndexedDB reads restore only after `/api/me` verifies the session; an already-open app keeps in-memory data while disconnected. Mutations are blocked offline. The app manifest is `src/app/manifest.ts`; icons are in `public/icons`.

## Documentation

Read `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/VERCEL_ENVIRONMENT.md`, `docs/GITHUB_APP_SETUP.md`, `docs/PUSH_NOTIFICATIONS.md`, `docs/PWA_OFFLINE.md`, `docs/AUDIT_FIXES.md`, and `docs/DECISIONS.md`.
