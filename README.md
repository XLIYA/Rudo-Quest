# Rudo Quest

A focused, mobile-first project and task management PWA. Rudo Quest is intentionally smaller than Jira, ClickUp, Notion, or GitHub: it centers on fast task capture, weekly planning, single-assignee ownership, project membership with a clear role matrix, push notifications, and one GitHub repository connection per project.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Database & Migrations](#database--migrations)
- [Testing](#testing)
- [Security Model](#security-model)
- [PWA & Offline Behavior](#pwa--offline-behavior)
- [Push Notifications](#push-notifications)
- [GitHub App Integration](#github-app-integration)
- [CI](#ci)
- [Deployment](#deployment)
- [Design Decisions](#design-decisions)
- [Documentation](#documentation)

## Features

- **Projects & membership** — projects with fixed color/icon keys, four roles (Owner, Admin, Member, Viewer), invitations with expiry, and an enforced one-owner-per-project invariant.
- **Tasks** — statuses `TODO`, `IN_PROGRESS`, `PENDING_REVIEW`, and `DONE`; task types (`TASK`, `STORY`, `FEATURE`, `BUG`, `TEST`); priorities; subtasks under Stories; file and link attachments; optimistic concurrency via a `version` column.
- **Weekly work surface** — the weekly route is the central planning view; desktop uses a persistent sidebar, mobile uses bottom navigation with a route-scoped add-task action.
- **Dashboard** — a viewport-contained overview with today's schedule, projects, and a 91-day activity heatmap.
- **Notifications & push** — in-app notifications, Web Push (VAPID) with per-device subscriptions, per-user timezone awareness, quiet hours, dedupe keys, and delivery retries with backoff. Scheduled work runs every 15 minutes via Supabase Cron.
- **GitHub integration** — connect one repository per project through a GitHub App with a two-leg, server-validated OAuth + installation flow. V1 stores verified installation metadata only; no issue import or two-way sync.
- **PWA & offline** — installable, with an app-shell precache, a neutral offline route, and user-scoped IndexedDB persistence for recently synchronized read data. Offline mutations are disabled rather than faked.

## Tech Stack

| Layer              | Technology                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Framework          | [Next.js](https://nextjs.org) 16 (App Router, Route Handlers, webpack builds)               |
| UI                 | React 19, Tailwind CSS 4, Radix UI primitives, lucide-react, Sonner                         |
| Client state       | TanStack Query (the only global state; no task/project/profile stores)                      |
| Validation         | Zod (route-handler payload validation)                                                      |
| Database           | PostgreSQL (Supabase) via [Drizzle ORM](https://orm.drizzle.team)                           |
| Identity           | Supabase Auth with HTTP-only SSR cookies                                                    |
| Storage            | Private Supabase Storage bucket for profile assets (signed URLs)                            |
| Rate limiting      | Upstash Redis (production), bounded local fallback (development)                            |
| Background jobs    | Supabase Cron + Supabase Vault-stored credentials                                           |
| Push               | Web Push with VAPID keys (`web-push`)                                                       |
| Errors & telemetry | Sentry (optional), Vercel Analytics + Speed Insights                                        |
| PWA                | Serwist service worker + `next-pwa`-style manifest (`src/app/sw.ts`, `src/app/manifest.ts`) |
| Testing            | Vitest (unit + coverage thresholds), Testing Library, Playwright (E2E)                      |
| CI/CD              | GitHub Actions, Vercel                                                                      |

## Architecture

Rudo Quest uses the Next.js App Router with protected route groups under `src/app/(app)` and public auth routes under `src/app/(auth)`.

**The browser never mutates application data directly.** Client Components use TanStack Query and a typed Fetch wrapper (`src/lib/api/client.ts`). Route Handlers validate Zod payloads, resolve the authenticated Supabase user, enforce permissions, call services, and serialize a standard API envelope:

```json
{ "error": { "code": "...", "message": "..." }, "requestId": "..." }
```

The server is layered:

- **Route Handlers** (`src/app/api/**`) — validation, authorization, envelope serialization. No business logic.
- **Services** (`src/server/services`) — business rules, optimistic-concurrency checks, activity events.
- **Repositories** (`src/server/repositories`) — all database reads and writes via Drizzle.
- **Policies** (`src/server/policies`) — project authorization (the role matrix below).
- **Schema** (`src/db/schema/index.ts`) — the Drizzle runtime schema, including CHECK constraints, partial indexes, and foreign keys that mirror application rules.

Supabase is the identity and storage boundary. The server uses SSR cookies and a server-only admin client for private Storage signed URLs and profile bootstrap. Signed uploads are tracked until commit, and abandoned objects are removed by the scheduled job.

### Permission matrix

| Action                    | Owner |       Admin       | Member | Viewer |
| ------------------------- | :---: | :---------------: | :----: | :----: |
| View project              |  ✅   |        ✅         |   ✅   |   ✅   |
| Update project            |  ✅   |        ✅         |   ❌   |   ❌   |
| Archive project           |  ✅   |        ❌         |   ❌   |   ❌   |
| Invite users              |  ✅   |        ✅         |   ❌   |   ❌   |
| Remove member             |  ✅   | ✅ (except owner) |   ❌   |   ❌   |
| Change member role        |  ✅   |      Limited      |   ❌   |   ❌   |
| Create project task       |  ✅   |        ✅         |   ✅   |   ❌   |
| Edit any task             |  ✅   |        ✅         |   ❌   |   ❌   |
| Edit assigned task        |  ✅   |        ✅         |   ✅   |   ❌   |
| Assign tasks              |  ✅   |        ✅         |   ✅   |   ❌   |
| Complete assigned task    |  ✅   |        ✅         |   ✅   |   ❌   |
| Connect GitHub repository |  ✅   |        ✅         |   ❌   |   ❌   |

## Project Structure

```
src/
├── app/
│   ├── (app)/            # Protected, authenticated routes (dashboard, weekly, projects, …)
│   ├── (auth)/           # Public auth routes (sign in / sign up)
│   ├── api/              # Route Handlers: activity, auth, cron, dashboard, github,
│   │                     # me, notifications, projects, push, tasks, users, webhooks
│   ├── offline/          # Neutral offline fallback route
│   ├── globals.css       # Tailwind 4 entry + design tokens
│   ├── layout.tsx        # Root layout (fonts, providers, nonce-based CSP)
│   ├── manifest.ts       # PWA manifest
│   └── sw.ts             # Serwist service worker source
├── components/           # Shared UI: layout (AppShell), ui primitives, shared widgets
├── db/
│   ├── migrations/       # Hand-authored SQL migrations (deployment source of truth)
│   ├── drizzle/          # Drizzle-generated snapshots (isolated, not deployed)
│   ├── schema/           # Drizzle runtime schema
│   └── seeds/            # Development seed script
├── features/             # Feature screens: auth, dashboard, notifications, profile,
│                         # projects, tasks, weekly
├── hooks/                # Reusable React hooks
├── lib/                  # Typed API client, env loading, validation schemas, utilities
├── server/
│   ├── policies/         # Project authorization policy
│   ├── repositories/     # Drizzle data access
│   ├── services/         # Business logic
│   └── observability/    # Structured logging
├── supabase/             # Supabase-specific helpers
└── proxy.ts              # Middleware: CSP with per-request nonces, frame denial,
                          # same-origin enforcement, security headers
tests/
└── e2e/                  # Playwright specs (public, local-auth, authenticated, collaboration)
```

## Getting Started

### Prerequisites

- **Node.js 20+** (CI pins 20; local development on 22/24 also works)
- **npm 10+** (this repo uses npm — the `resolutions` field is not used)
- A **Supabase project** (Auth + PostgreSQL + Storage)
- Optional for full local fidelity: Upstash Redis, VAPID keys, a GitHub App, Sentry

### Install

```bash
git clone <your-repo-url> rudo-quest
cd rudo-quest
npm ci           # installs deps and runs patch-package via postinstall
```

### Configure environment

```bash
cp .env.example .env.local
```

Fill in at minimum for local development:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SECRET_KEY=<secret key>
DATABASE_URL=<postgres connection string>
```

All other variables (GitHub, VAPID, Upstash, cron, Sentry) are optional locally; the app degrades gracefully and returns `INTEGRATION_NOT_CONFIGURED` for unconfigured integrations instead of misbehaving. See [Environment Variables](#environment-variables) for the full reference.

### Set up the database

```bash
npm run dev:setup    # applies migrations, then seeds development data
```

The seed script creates a development admin account (configure via `SEED_ADMIN_*` variables) and can create the private `profile-assets` Storage bucket.

### Run

```bash
npm run dev          # http://localhost:3000
```

## Environment Variables

Variables with the `NEXT_PUBLIC_` prefix are public and bundled into client JavaScript. **Every other variable is server-only** and must never be exposed to the browser.

| Variable                                                                                                                                  | Scope       |         Required         | Purpose                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------- | :----------------------: | ----------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                                                                                                                     | Public      |            ✅            | Canonical production URL (no trailing slash)                                                          |
| `NEXT_PUBLIC_SUPABASE_URL`                                                                                                                | Public      |            ✅            | Supabase project URL                                                                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                                                                                    | Public      |            ✅            | Supabase publishable key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` is the legacy fallback)                     |
| `SUPABASE_SECRET_KEY`                                                                                                                     | Server-only |            ✅            | Supabase secret key (`SUPABASE_SERVICE_ROLE_KEY` is the legacy fallback). Bypasses RLS — never expose |
| `DATABASE_URL`                                                                                                                            | Server-only |            ✅            | PostgreSQL connection string (pooled/serverless string recommended, SSL enabled)                      |
| `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` | Server-only | GitHub integration only  | GitHub App credentials (see [docs/GITHUB_APP_SETUP.md](docs/GITHUB_APP_SETUP.md))                     |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`                                                                      | Mixed       |    Push notifications    | VAPID key pair + contact URI (`npx web-push generate-vapid-keys --json`)                              |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                                                      | Server-only | Production rate limiting | Without them, rate-limited routes fail closed with `INTEGRATION_NOT_CONFIGURED`                       |
| `CRON_SECRET`                                                                                                                             | Server-only | Scheduled notifications  | Bearer token for `/api/cron/notifications`, stored in Supabase Vault                                  |
| `NEXT_PUBLIC_SENTRY_DSN`                                                                                                                  | Public      |         Optional         | Browser/server error reporting                                                                        |
| `SENTRY_AUTH_TOKEN`                                                                                                                       | Server-only |         Optional         | Source-map upload during production builds                                                            |
| `SEED_ADMIN_*`                                                                                                                            | Server-only |      Dev seed only       | Development admin account inputs — not used in production                                             |
| `E2E_EMAIL`, `E2E_PASSWORD`, `PLAYWRIGHT_BASE_URL`                                                                                        | Test        |       Optional E2E       | Authenticated Playwright flows / remote targets                                                       |

Full per-variable sourcing instructions, Vercel environment mapping, and safe secret-rotation procedures live in [docs/VERCEL_ENVIRONMENT.md](docs/VERCEL_ENVIRONMENT.md).
