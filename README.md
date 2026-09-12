# Rudo Quest

Rudo Quest is a compact collaborative weekly task-management PWA built with Next.js App Router, Supabase Auth/PostgreSQL, Drizzle ORM, TanStack Query, the browser Fetch API, Serwist, and Vercel.

## Local Setup

Install dependencies with `npm install`, copy `.env.example` to `.env.local`, configure Supabase and database credentials, then run `npm run db:migrate`, `npm run db:seed`, and `npm run dev`.

This application uses Supabase Auth and the database migration references `auth.users`, so local development requires a Supabase local stack or a hosted Supabase project. A plain PostgreSQL database is not enough. Copy the tracked `.env.example` to `.env.local`, then fill the local or hosted Supabase values before migrating and seeding.
