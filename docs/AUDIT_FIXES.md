# Audit remediation record

This document describes the implemented remediation for the July 2026 audit. It is intentionally limited to behavior that is implemented in the repository and covered by the production checks.

## Security and data integrity

GitHub installation state is now persisted in `github_installation_states`, signed, short-lived, bound to the authenticated Rudo user, and atomically consumed. The callback exchanges the OAuth code only once, verifies the installation against GitHub's user-installations endpoint, rejects existing ownership by another Rudo user, and never overwrites `installed_by`. Installation and repository tokens remain server-only. GitHub webhook bodies are bounded and HMAC-verified.

Hosted PostgreSQL uses certificate verification. Production state-changing requests require an allowed Origin, production request identity uses platform-forwarded address data, and Upstash-backed rate limiting fails closed when production credentials are absent. JSON and webhook bodies are streamed with byte limits. Production CSP uses request nonces and does not allow unsafe inline scripts or eval.

RLS is enabled on the integration and delivery tables, the recursive membership policy was replaced with security-definer helpers, and policies cover project, task, activity, notification, push, invitation, GitHub, and repository visibility. Migrations add task integrity/version triggers, project-owner membership integrity, delivery uniqueness, and retry columns. Invitation expiry is transitioned to `EXPIRED` before invitation reads and transitions. Activity cursors contain both timestamp and event ID.

## Projects, invitations, and GitHub

Project creation writes the project, owner membership, validated invitation users, and invitations in one database transaction. Project settings now updates title, description, icon, color, and timezone. Member role changes, member removal, invitation revocation, repository disconnect, project archive, and ownership transfer all use confirmation dialogs. Ownership transfer updates both the project owner and membership roles atomically and requires explicit confirmation.

Task assignment search returns project members through a real accessible combobox. Members can edit assigned tasks and assign project-member tasks; viewers cannot mutate project data. Project detail activity is scoped to the selected project, task activity has a dedicated API and sheet view, and project task queries apply project filtering in SQL.

## Tasks and weekly behavior

Start, complete, and reopen actions call their dedicated APIs immediately. Optimistic updates snapshot and roll back week/detail caches, preserve task versions, and invalidate affected queries. Generic updates no longer accept arbitrary status changes. Database triggers normalize `completed_at` and `previous_status`; archived tasks and tasks belonging to archived projects are excluded from normal weekly queries. The responsive task detail surface resets draft state by task/version and exposes the full task history.

The weekly date is URL state, so direct links, browser navigation, week navigation, and day selection restore the same expanded day. The dashboard and project task rows open the same task sheet.

## Profile, settings, and notifications

Profile now supports signed private avatar/banner uploads, browser-side cropping, server-side byte/MIME/dimension validation, replacement cleanup, preset banners, theme/timezone/reminder/quiet-hour controls, password reset, push opt-in, and activity display. Settings is a dedicated route rather than a profile redirect. Notifications has a dedicated center, unread badge, optimistic read actions, invitation accept/decline actions, invitation-accepted notifications, due-today reminders, daily digest notifications, quiet hours, dedupe keys, retry-aware delivery logs, and dead-subscription cleanup.

## Offline and deployment

Serwist precaches the app shell and offline route but uses `NetworkOnly` for all application API paths. Selected successful TanStack Query reads are persisted in user-scoped IndexedDB with versioning and a seven-day expiry. Cached reads restore only after a server-confirmed user bootstrap or while offline; logout clears the active user's cache. All mutations are blocked offline and no mutation is presented as successful without a server response. Vercel Cron runs every fifteen minutes and requires `CRON_SECRET`.

The linked Vercel project is currently on the Hobby plan, which rejects this required fifteen-minute Cron schedule during deployment. The application build and existing production deployment were verified, but promoting this remediation requires upgrading that project to a plan that supports sub-daily Cron Jobs.

The existing heatmap implementation and current font configuration are intentionally unchanged, per the remediation instructions.

## Verification

The current repository verification commands are `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev`, `git diff --check`, and `npx playwright test`. The production migration runner has applied migrations `0001_audit_hardening.sql`, `0002_integrity_and_delivery_retries.sql`, and `0003_rls_membership_transitions.sql` to the configured Supabase database. Browser dependency installation is documented in the local setup instructions for environments where Playwright's system libraries are absent.
