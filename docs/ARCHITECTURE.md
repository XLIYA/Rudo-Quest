# Architecture

Rudo Quest uses Next.js App Router with protected route groups under `src/app/(app)` and public auth routes under `src/app/(auth)`.

The browser never mutates application data directly. Client Components use TanStack Query and the single Axios client in `src/lib/api/client.ts`. Route Handlers validate Zod payloads, resolve the authenticated Supabase user, enforce permissions, call services, and serialize standard API envelopes.

Business logic lives in `src/server/services`. Database reads and writes live in `src/server/repositories`. Project authorization lives in `src/server/policies/project-policy.ts`.

The Drizzle runtime schema is in `src/db/schema/index.ts`. Hand-authored migrations in `src/db/migrations` are the deployment source of truth; Drizzle-generated snapshots are isolated in `src/db/drizzle`. The migration runner serializes deployments with a PostgreSQL advisory lock and rejects checksum drift.

UI is mobile-first. Desktop uses a persistent left sidebar; mobile uses bottom navigation and a floating add-task action. The weekly route is the central work surface.

Supabase is the identity and storage boundary. The server uses SSR cookies and a server-only admin client for private Storage signed URLs and profile bootstrap. Signed uploads are tracked until commit and abandoned objects are removed by the scheduled job. Selected browser reads are persisted under a user-scoped IndexedDB key and restored only after the server verifies the active session.
