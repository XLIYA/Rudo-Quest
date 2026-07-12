# Architecture

Rudo Quest uses Next.js App Router with protected route groups under `src/app/(app)` and public auth routes under `src/app/(auth)`.

The browser never mutates application data directly. Client Components use TanStack Query and the single Axios client in `src/lib/api/client.ts`. Route Handlers validate Zod payloads, resolve the authenticated Supabase user, enforce permissions, call services, and serialize standard API envelopes.

Business logic lives in `src/server/services`. Database reads and writes live in `src/server/repositories`. Project authorization lives in `src/server/policies/project-policy.ts`.

The database schema is Drizzle-first in `src/db/schema/index.ts`; migrations `0000_initial.sql`, `0001_audit_hardening.sql`, `0002_integrity_and_delivery_retries.sql`, and `0003_rls_membership_transitions.sql` add constraints, indexes, RLS policies, task-integrity triggers, ownership integrity, membership transition authorization, and notification retry state.

UI is mobile-first. Desktop uses a persistent left sidebar; mobile uses bottom navigation and a floating add-task action. The weekly route is the central work surface.

Supabase is the identity and storage boundary. The server uses SSR cookies and a server-only admin client for private Storage signed URLs and server-side profile bootstrap. Browser data is cached only through TanStack Query; selected successful reads are persisted under a user-scoped IndexedDB key with a version and seven-day expiry.
