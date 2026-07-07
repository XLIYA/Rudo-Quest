# Architecture

Rudo Quest uses Next.js App Router with protected route groups under `src/app/(app)` and public auth routes under `src/app/(auth)`.

The browser never mutates application data directly. Client Components use TanStack Query and the single Axios client in `src/lib/api/client.ts`. Route Handlers validate Zod payloads, resolve the authenticated Supabase user, enforce permissions, call services, and serialize standard API envelopes.

Business logic lives in `src/server/services`. Database reads and writes live in `src/server/repositories`. Project authorization lives in `src/server/policies/project-policy.ts`.

The database schema is Drizzle-first in `src/db/schema/index.ts`; SQL migration `0000_initial.sql` includes constraints, indexes, and RLS policies for defense in depth.

UI is mobile-first. Desktop uses a persistent left sidebar; mobile uses bottom navigation and a floating add-task action. The weekly route is the central work surface.
