# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

Rudo Quest is a Next.js 16 App Router PWA for collaborative weekly task
management. The stack is TypeScript (strict), Tailwind CSS 4, TanStack Query,
Supabase auth (SSR cookies), Drizzle ORM on PostgreSQL, and Serwist for the
service worker. Deployments target Vercel.

## Commands

| Task                  | Command                          |
| --------------------- | -------------------------------- |
| Dev server            | `npm run dev`                    |
| Production build      | `npm run build`                  |
| Lint                  | `npm run lint`                   |
| Types                 | `npm run typecheck`              |
| Unit tests (one run)  | `npm test`                       |
| Coverage              | `npm run test:coverage`          |
| Format check / write  | `npm run format` / `npm run format:write` |
| E2E (Playwright)      | `npx playwright test --project=chromium` |
| DB migrate / seed     | `npm run db:migrate` / `npm run db:seed` |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, coverage, format check,
build, `npm audit --omit=dev`, `git diff --check`, and Playwright on Chromium.
Run the same set locally before proposing a merge. Playwright boots
`next dev --webpack` on port 3000; authenticated E2E specs self-skip unless
`E2E_EMAIL`/`E2E_PASSWORD` are set.

## Architecture rules

- Layering is strict and one-directional:
  `src/app/api/**` (route handlers: validation + envelope only)
  → `src/server/services` (business rules, activity events, notifications)
  → `src/server/repositories` (all Drizzle database access)
  → `src/server/policies` (project role authorization).
- Route handlers never touch the database directly. Repositories never import
  services. Authorization lives in policies/services, never in components.
- API responses use the shared envelope: `{ data }` or `{ error, requestId }`.
  Mutations are optimistic-concurrency guarded via task `version`.
- Validation schemas live in `src/lib/validation/**` (zod) and are the single
  source of truth for request shapes.
- Database schema changes are hand-authored SQL in `src/db/migrations/` and
  must mirror the Drizzle schema in `src/db/schema/index.ts`. Never edit an
  already-applied migration; add a new one.

## Conventions

- Every exported function/component carries a doc comment with
  `Purpose / Inputs / Output / Side effects` (plus `Failure behavior` or
  `Business rule` where relevant). Match the existing style.
- No `any` (`@typescript-eslint/no-explicit-any` is an error). Unused vars
  fail lint; prefix intentionally unused args with `_`.
- UI primitives live in `src/components/ui`; composed feature screens in
  `src/features/**`. Styling uses Tailwind utilities with the design tokens
  defined in `src/app/globals.css`; avoid raw hex values in components.
- Client components start with `"use client"`; server-only code under
  `src/server/**` must never be imported by client files.
- Tests use vitest + testing-library (`*.test.ts`/`*.test.tsx` colocated with
  the code). Fix failing tests by fixing the code — never weaken assertions
  or skip tests to get green.
- Formatting is Prettier; the pre-commit hook runs eslint --fix + prettier
  via lint-staged. Run `npm run format:write` after adding files.

## Data & security invariants

- Personal data access goes through the server API only; RLS denies direct
  browser access. Never add client-side Supabase table queries.
- The offline query cache is user-scoped and persists only approved read
  prefixes (`src/lib/pwa/query-persistence.ts`); protected route prefixes are
  centralized in `src/lib/app-routes.ts` — update that one file, not
  per-copies in proxy/providers.
- Same-origin enforcement for mutations lives in
  `src/server/security/origin.ts`. Do not bypass it for convenience.
- Never commit secrets; local config lives in `.env.local` (gitignored).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
