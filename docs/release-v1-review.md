# Version 1 review

Reviewed on 2026-09-27 and 2026-09-28. This release preserves and incorporates the uncommitted
application-shell, dialog, API, and verification repairs present when the review
started.

## Changes and findings

| Area              | Finding                                                                                                    | Resolution                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard         | Content determined page height and overflowed the desktop viewport; shorter laptop screens clipped charts. | Bound both widget rows to the available height, scale chart/heatmap content, keep long task/project lists internally scrollable, and use an opacity-only page entrance. |
| Mobile navigation | Active location was too subtle and six destinations crowded the bar.                                       | Soft icon pill and `aria-current`; five destinations; History remains accessible from Profile and the desktop sidebar.                                                  |
| Project header    | Actions squeezed long project names and summaries consumed too much vertical space.                        | Smaller single-line title, full-width subtitle space, left-aligned actions, and a compact progress bar with open-task/member counts.                                    |
| Members           | Handles repeated unnecessary identity information and role/removal controls misaligned.                    | Name plus role, a fixed avatar column, role beneath name, and consistently aligned removal control.                                                                     |
| Notifications     | Mobile rows stacked their icons/actions unnecessarily; unread totals reflected only loaded items.          | Compact inbox rows, subdued unread styling, accessible controls, content-sized scrolling and authoritative server unread totals.                                        |
| Weekly            | Navigation occupied its own header row; task cards lacked hierarchy.                                       | Inline week navigation, refined cards and difficulty controls in quick creation.                                                                                        |
| Task effort       | No effort estimate existed.                                                                                | Integer difficulty 1–5, default 1, database constraint, create/update validation, project/personal/subtask creation and editing, accessible five-bar display.           |
| Rewards           | No shared deadline/reward contract existed.                                                                | Owner/admin selection of 2–100 tasks, total integer toman amount, an explicit deadline, transactional version checks, completion counts, approval and cancellation.     |
| Restore           | Invalidation used a task ID as a project ID and a nonexistent dashboard date key.                          | Refresh actual project, dashboard, activity, archived-list and reward caches; regression test added.                                                                    |
| Loading           | Heavy task editors were mounted with closed dialogs; archived tasks fetched before expansion.              | Dynamically load editors only when opened and defer the archived query until expansion.                                                                                 |
| Offline data      | Older persisted task DTOs lack new fields.                                                                 | Incremented the user-scoped cache format version.                                                                                                                       |
| Motion            | Page/card entrances and interaction feedback needed consistency.                                           | Short CSS opacity/transform transitions, no animation dependency or continuous reward animation, and reduced-motion support.                                            |

Additional regression fixes cover empty Radix filter options, clearing a required
date without crashing task creation, and Windows/Linux migration checksums.
The runner accepts historical line-ending variants while still rejecting real
SQL edits, and never rewrites applied migration files or ledger entries.

## Shared controls

Calendar and Popover are adapted from shadcn/ui with the project tokens. Dates
can be typed or selected by keyboard; impossible dates cannot reach form state.
Reward deadlines use separate date and time controls, with the timezone visible.
Existing button/dialog/select primitives already use the same Radix composition
as shadcn and are retained without adding duplicate component systems. Kanban
cards now show the scheduled date, assignee name and subtask progress.

## Reward contract

- The amount is the **total for the selected group**, denominated in **toman**.
- Every selected task must be complete and an owner/admin must approve the group
  **before the deadline**. The browser shows the deadline in its local timezone;
  the API stores a timezone-aware timestamp.
- Approval is an eligibility record, not a payment transfer. Later task edits do
  not retroactively cancel an approved contract.
- Creation rejects stale versions, completed/archived tasks, cross-project tasks,
  duplicate selections, and tasks already attached to a reward.
- Cancellation frees tasks for another group and increments task versions.
- Reward tasks cannot be moved to another project. Archived tasks still belong
  to the contract and prevent approval until restored and completed.
- Membership/project and task rows are locked during contract writes. Activity
  events and mutations commit together. Mutations retain same-origin checks.
- `task_rewards` has RLS enabled and no `anon` or `authenticated` table grants.
  All reads and writes go through the server API and service authorization.

## Verification and scope

The review covered route/layout composition, shared UI primitives, dashboard,
weekly planning, projects/settings, notifications, task editor/subtasks/history,
query invalidation/persistence, service/repository boundaries, schema/migration
consistency and authentication/mutation guards. Focused regression tests cover
the new behavior; existing auth, collaboration, attachments and history tests
remain enabled.

Browser verification includes 1920×1111 desktop, 1366×768 laptop and 375×667 mobile
layouts, authenticated task creation/completion, long project names, active
navigation, reward creation/approval, rejected premature approval and atomic
rollback of stale selections. The existing browser-error monitor remains active.

This is not a proof that all possible bugs are absent. Local browser timings are
not production Core Web Vitals or a load test. Production web-push delivery,
external GitHub OAuth and real-user performance require their own live telemetry.
The release does not claim payment processing or automatic reward disbursement.

## Final local checks (2026-09-28)

- Clean `npm ci`, lint, typecheck, format check, production build and `git diff --check`: passed.
- Unit coverage: 53 files / 228 tests passed. Statements 50.77%, branches 45.50%,
  functions 39.23%, lines 52.72%; all configured thresholds passed.
- Chromium plus mobile browser suite: 10 passed, 2 intentionally skipped duplicate
  mobile signup/collaboration runs; those flows passed on Chromium. Authenticated
  scenarios ran against disposable local Supabase fixtures.
- `npm audit --omit=dev`: zero reported production dependency vulnerabilities.
- Local runtime: Node 24; the checked-in GitHub workflow uses Node 20.
- Build retains the existing non-fatal `preferredRegion` deprecation warning.

## Deployment

Apply pending migrations using the checked-in migration runner before deploying
the application. Never run the development seed against production.

```sh
node --env-file=.env.production src/db/migrate.mjs
```

The new schema is additive and defaults existing task difficulty to 1. Existing
applied migrations are unchanged. Production rollout must include any earlier
pending migration, including `0011_task_pending_review_status.sql`.

Production migration verification on 2026-09-28 applied the two pending migrations
and verified all 17 ledger entries. Reward RLS is enabled, browser-role table
privileges are absent, and all six relevant task/reward constraints are validated.
No production seed or user-data test fixture was run.
