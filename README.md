# Rudo Quest

Rudo Quest is a compact collaborative weekly task-management PWA built with Next.js App Router, Supabase Auth/PostgreSQL, Drizzle ORM, TanStack Query, the browser Fetch API, Serwist, and Vercel.

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
