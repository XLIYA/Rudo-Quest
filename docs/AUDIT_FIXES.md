# Audit remediation record

This document describes the implemented remediation for the July 2026 audit. It is intentionally limited to behavior that is implemented in the repository and covered by the production checks.

## Security and data integrity

GitHub installation state is now persisted in `github_installation_states`, signed, short-lived, bound to the authenticated Rudo user, and atomically consumed. The callback exchanges the OAuth code only once, verifies the installation against GitHub's user-installations endpoint, rejects existing ownership by another Rudo user, and never overwrites `installed_by`. Installation and repository tokens remain server-only. GitHub webhook bodies are bounded and HMAC-verified.

Hosted PostgreSQL uses certificate verification. Production state-changing requests require an allowed Origin, production request identity uses platform-forwarded address data, and Upstash-backed rate limiting fails closed when production credentials are absent. JSON and webhook bodies are streamed with byte limits. Production CSP uses request nonces, permits only version-pinned hashes for Sonner's nonced-unsupported stylesheet injector, and does not allow unsafe inline scripts or eval.

RLS is enabled on every application table and direct `anon`/`authenticated` table grants are revoked because the browser uses the server API. The recursive membership policy was replaced with private helpers. The repaired migration chain normalizes foreign keys/checks, validates earlier `NOT VALID` constraints, adds retry/invitation indexes, and isolates Drizzle-generated snapshots. Invitation expiry is transitioned before reads and transitions. Activity cursors contain timestamp and ID and now resume after the last returned row without skipping the look-ahead row.

## Projects, invitations, and GitHub

Project/task primary writes, activity, and in-app notifications now share database transactions. Project creation writes the project, owner membership, invitations, activity, and notifications atomically. Removing a member unassigns their project tasks before deleting membership. Archived projects are read-only across project, task, invitation, membership, ownership, and GitHub service boundaries. Ownership transfer updates the project and membership roles atomically.

Task assignment search returns project members through an authorized accessible combobox. Task DTOs carry server-derived edit/transition/archive capabilities, so viewers and unassigned members no longer receive failing controls. Project detail activity is scoped to the selected project, task activity has a dedicated API and sheet view, and project task queries apply project filtering in SQL.

## Tasks and weekly behavior

Start, complete, and reopen actions call their dedicated APIs immediately. Optimistic updates snapshot and roll back week/detail caches, preserve task versions, and invalidate affected queries. Generic updates no longer accept arbitrary status changes. Database triggers normalize `completed_at` and `previous_status`; archived tasks and tasks belonging to archived projects are excluded from normal weekly queries. The responsive task detail surface resets draft state by task/version and exposes the full task history.

The weekly date is URL state, so direct links, browser navigation, week navigation, and day selection restore the same expanded day. The dashboard and project task rows open the same task sheet.

## Profile, settings, and notifications

Profile uploads are tracked from signed URL issuance through commit; expired uncommitted objects are cleaned by Cron. Password recovery now exchanges the SSR PKCE code before update and signs the recovery session out afterward. Notifications use cursor pagination, an unread badge, optimistic read actions, invitation actions, reminders, quiet hours, dedupe keys, retry-aware delivery logs, and dead-subscription cleanup.

Profile asset replacement retries private-storage cleanup and reports persistent cleanup failures to Sentry. The profile serializer now returns only the documented DTO. Activity visibility receives a final service-boundary privacy filter, and profile activity shows both relative and absolute times. Notification assignment, invitation, and acceptance events attempt safe push delivery immediately while retaining the scheduled retry path.

## Authentication and development workflow

Local Supabase is configured to auto-confirm development email/password accounts, while hosted production keeps its normal email-verification contract. Signup determines the result from the server-side Supabase session, so local users enter the app immediately without pretending that a verification email was sent. Sign-in and signup profile bootstrap failures clear the new local session instead of leaving a half-authenticated browser. The seed command creates a verified development account, profile, and private storage bucket using server-only credentials.

## UI, hydration, and accessibility

Protected navigation receives the server-verified profile and first notification page, and live client-only values are revealed after a deterministic hydration snapshot. This removes avatar, unread-badge, and weekly-screen hydration failures without hiding the application shell. Vercel telemetry renders only on actual Vercel deployments, avoiding broken telemetry requests during local production smoke tests while retaining hosted monitoring. Development uses Turbopack to keep the complete authenticated route surface stable, while the production build remains Webpack-based for Serwist compatibility.

The visual audit now reports no horizontal overflow, unlabeled controls, missing image alternatives, or sub-44-pixel interactive targets on the audited desktop and mobile routes. Checkbox controls expose their own accessible name and a full target, upload controls have visible keyboard focus across their entire target, and notification actions use symmetric touch-safe sizing. The original 91-day, 13-week heatmap presentation is intentionally preserved.

## Offline and deployment

Serwist caches public shell assets and the offline route but uses `NetworkOnly` for application APIs and protected navigations. Selected reads are persisted in user-scoped IndexedDB, but cold restore requires a server-confirmed `/api/me`; a remembered user ID never unlocks private data offline. All mutations are blocked offline. Vercel Cron uses the required GET contract, runs every fifteen minutes, requires `CRON_SECRET`, and holds a Redis lock to prevent overlapping invocations.

The linked Vercel project is currently on the Hobby plan, which rejects this required fifteen-minute Cron schedule during deployment. The application build and existing production deployment were verified, but promoting this remediation requires upgrading that project to a plan that supports sub-daily Cron Jobs.

Dashboard heatmap bounds and streaks now use the profile timezone, project completion uses each project's current local Monday–Sunday week, and the duplicate remote font declaration and zero-byte font artifact were removed.

## Verification

The repository verification commands are `npm run format`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, and `npx playwright test`. Coverage cannot regress below 40% statements/lines or 30% branches/functions. GitHub Actions now runs quality/build checks and public Chromium tests. An authenticated Playwright create/render/archive flow runs when `E2E_EMAIL` and `E2E_PASSWORD` point to a dedicated test account.

Playwright now fails on browser console errors and uncaught page exceptions. The local gate also covers development signup without email delivery and a real two-user lifecycle: create project, invite collaborator, accept, assign, start, complete, and reopen. Test-created project notifications are removed during cleanup so repeated verification does not pollute the seeded account. A production-mode browser smoke separately verifies nonce/`strict-dynamic` enforcement, all protected route shells, the manifest, and the service worker with no browser exceptions or console errors.
