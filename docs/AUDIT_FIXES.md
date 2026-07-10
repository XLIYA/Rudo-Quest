# Audit Fixes

This document records the root cause, fix, and verification coverage for the July 2026 audit findings.

## Task project reassignment

Root cause: `updateTask` authorized the actor against the source task only. When `projectId` changed, the target project was not checked, and `assigneeId: null` bypassed the only target membership check.

Fix: `updateTask` now checks the actor's role in the target project whenever a task moves across project boundaries. Missing roles and viewer roles are rejected before the update is written.

Verification: `src/server/services/task-service.test.ts` covers no-role, viewer, and member target-project moves.

## Activity pagination leakage

Root cause: the activity repository used the access predicate only for the first page. Cursor requests replaced it with `created_at < cursor`, allowing older global activity to be returned.

Fix: cursor filtering is now combined with project membership and personal-task visibility predicates. A defensive row-level visibility check also runs before serialization.

Verification: `src/server/repositories/activity-repository.test.ts` covers project membership and personal activity visibility rules.

## GitHub installation validation

Root cause: the GitHub repository endpoints trusted caller-provided installation IDs and repository metadata. The callback accepted GitHub query parameters without validating the `state` value or persisting verified installation ownership.

Fix: installation start now creates a signed, expiring state token. The callback verifies state against the current user, fetches installation metadata from GitHub, and persists ownership. Repository listing and connection require a stored installation row owned by the actor, and connection metadata is fetched from GitHub instead of accepted from the client.

Verification: `src/lib/github/app.test.ts` covers state validation. `src/server/services/github-service.test.ts` covers installation ownership and GitHub-sourced repository metadata.

## Production rate limiting

Root cause: the Upstash rate limiter was cached as one global instance, so whichever route initialized it first set the limit and window for every later route.

Fix: Upstash limiters are cached by route key, limit, and window. Redis itself is still shared, but each route policy gets its own limiter instance.

Verification: `src/server/security/rate-limit.test.ts` proves different route policies create distinct limiters.

## Login open redirect

Root cause: the auth form passed the raw `next` query parameter to `router.push`.

Fix: login redirects now pass through `getSafePostLoginPath`, which only allows internal absolute paths and falls back to `/dashboard` for external, protocol-relative, malformed, or non-path values.

Verification: `src/features/auth/auth-form.test.ts` covers accepted and rejected redirect values.

## Invitation authorization

Root cause: accept checked the invited user and revoke checked admin role, but decline had no actor check.

Fix: invitation transitions now load the invitation before mutation. Accept and decline are limited to the invited user; revoke remains limited to project admins and owners.

Verification: `src/server/services/project-service.test.ts` covers unauthorized decline, invited-user decline, and non-admin revoke.

## Client error normalization

Root cause: Axios interceptors rejected already-normalized API errors, but hooks normalized them again and converted them to a generic "Unexpected client error."

Fix: `normalizeApiClientError` is now idempotent and returns existing `ApiClientError` objects unchanged.

Verification: `src/lib/api/client.test.ts` covers already-normalized errors.

## Signup failure handling

Root cause: the signup route ignored Supabase `signUp` errors and always returned HTTP 201.

Fix: signup now throws a safe `BAD_REQUEST` response when Supabase returns an error or no user.

Verification: covered by `npm run typecheck` and route-level error handling. Add integration coverage when authenticated e2e setup is available.

## Daily reminder count

Root cause: `countDueTasksForDate` claimed to count incomplete tasks but did not exclude `DONE`.

Fix: the repository query now filters out completed tasks before cron notification creation.

Verification: covered by `npm run typecheck`; add database-backed repository coverage when test database fixtures are introduced.

## Task row and form button events

Root cause: the task checkbox bubbled clicks into the row open handler, and `AppButton` defaulted to native submit behavior inside forms.

Fix: `AppButton` defaults to `type="button"` unless overridden, the task detail archive button is explicit, `TaskCheckbox` stops propagation, and `TaskRow` uses a dedicated content button instead of an interactive wrapper with nested controls.

Verification: `src/components/ui/app-button.test.tsx` and `src/components/ui/task-row.test.tsx` cover button type and task row event isolation.

## Profile asset commit and display

Root cause: avatar/banner commit routes accepted any string path. Stored private Supabase Storage paths were also passed to avatar image components as if they were browser-readable URLs.

Fix: commit now enforces the generated `{userId}/{kind}-{uuid}.{jpeg|png|webp}` path pattern, verifies the object exists in the private bucket, and returns signed URLs for profile assets in API DTOs and summaries.

Verification: `src/server/profile-assets.test.ts` covers path ownership and format validation.
