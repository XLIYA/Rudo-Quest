# Dashboard, activity context, and task history design

## Scope and success criteria

This change addresses three related usability problems without changing Rudo Quest's existing visual language. The Dashboard's Today and Projects widgets must stop increasing the document height after their useful summary size. Project and profile activity must identify the task associated with every task-level event. Users must also have a durable place to review missed and archived tasks, with version-safe restoration for archived tasks.

The work is complete when both Dashboard collections scroll inside bounded, keyboard-focusable regions; task-level activity presents an unambiguous task title and destination in both project and profile feeds; and a protected Task history page provides cursor-paginated Missed and Archived views, read-only archived details, and restore behavior. All existing responsive, offline, authorization, optimistic-concurrency, and accessibility expectations remain intact.

## Product definitions

A missed task has a `scheduled_date` earlier than the current date in the viewer's profile time zone, has a status other than `DONE`, and has no `archived_at` value. Tasks belonging to archived projects are excluded because those projects already provide a read-only historical view.

An archived task has a non-null `archived_at` value and is still visible to the viewer under the normal personal-task or current-project-membership rules. Restoring it clears `archived_at`, increments its optimistic version, records `TASK_RESTORED`, and returns it to the normal weekly/project surfaces. A task inside an archived project cannot be restored until the project itself is active.

## Considered approaches

The first option was to extend Weekly with Missed and Archived modes. This reused an existing task surface but mixed planning with historical recovery and made URL/filter behavior harder to understand. The second option was to add more Dashboard cards, but that contradicted the goal of keeping Dashboard compact. The selected option is a dedicated `/task-history` destination with URL-backed tabs. It provides clear navigation, stable deep links, independent pagination, and room for restoration without burdening the daily planning flow.

## Information architecture and navigation

`/task-history?view=missed` is the default history destination and `/task-history?view=archived` selects the archive. The route is added to desktop primary navigation as `Task history` and to the mobile bar as the shorter `History` label. Mobile navigation becomes a six-column grid rather than horizontally scrolling; icons and labels retain the existing minimum touch height and focus treatment.

The page header explains that this is the place to recover work that fell out of the active schedule. A two-option semantic tab list switches views by updating the URL. Back, forward, refresh, and shared URLs preserve the selected view. Each view owns its loading, error, empty, pagination, and offline states.

## Visual and interaction design

### Design brief

The audience is an authenticated user triaging work, often on a phone. The design should feel like a calm recovery desk rather than a punishment list. Existing surface, border, brand, warning, success, type, radius, elevation, and motion tokens are reused; no new hardcoded colors or visual system is introduced. Density is controlled and scan-friendly. Status is communicated by text and icon as well as color.

The layout is:

```text
+--------------------------------------------------+
| Task history                                     |
| Recover missed work or restore archived tasks.   |
+----------------------+---------------------------+
| Missed               | Archived                  |
+--------------------------------------------------+
| contextual task row                              |
| date · project · status          primary action  |
| ...                                              |
+--------------------------------------------------+
| Load older                                       |
+--------------------------------------------------+
```

The signature interaction is recovery in place: Restore changes a muted archived row into a confirmed restored state, invalidates all affected task surfaces, and removes the row without a page reload. Reduced-motion preferences remain respected by the global motion policy.

### Dashboard containment

Today and Projects retain their existing card headers. Only their collection bodies become bounded scroll regions, using a responsive maximum height, `overflow-y-auto`, stable scrollbar space, overscroll containment, a visible focus ring, and descriptive region labels. Empty states do not become scroll containers. This keeps the page itself compact while preserving access to every item.

### Activity task context

A shared activity-feed item renders actor, humanized action, relative/absolute time, and—when the event has a task—a secondary task-context row with a task icon and full task title. Project-only events intentionally omit that row. The task context is a link: active tasks open their dated Weekly detail URL; missed tasks open the Missed history view; archived tasks open the Archived history view. Both project Activity and profile Recent activity use the same component so copy and accessibility cannot drift.

### History rows and details

Missed rows emphasize the scheduled date and retain the normal task actions allowed by `TaskDto.permissions`. Archived rows are visually muted, show when the task was archived, expose a read-only detail sheet, and provide a clearly labelled Restore button when authorized. Restore is disabled offline or while pending. Failure leaves the row in place and displays the existing safe toast; a version conflict asks the user to reload rather than overwriting newer data.

## Data contracts and API design

`ActivityEventDto` gains nullable task context containing `id`, `title`, `scheduledDate`, and `archivedAt`. The existing activity query already joins tasks, so the repository selects these fields in the same query without introducing N+1 reads. Privacy filtering remains unchanged and the task context is emitted only for an already-visible activity row.

`GET /api/tasks/history` accepts a validated `view` of `missed` or `archived` and an optional opaque cursor. The service resolves the viewer and their time zone server-side; the client never supplies the authoritative definition of today. The response contains `items` and an optional `cursor`. Missed results are ordered by `scheduled_date DESC, id DESC` so the most recently missed work appears first. Archived results are ordered by `archived_at DESC, id DESC`. Both use strict tuple cursor comparisons and a bounded page size.

`POST /api/tasks/:taskId/restore` requires same-origin protection, a validated expected version, visibility, edit permission, an active owning project when applicable, and a currently archived row. The repository update guards on task ID, version, and non-null `archived_at`; it clears the archive timestamp and increments the version in the same transaction that writes `TASK_RESTORED` activity.

The read-only task GET path is extended through a distinct service operation that can return a visible archived task. Mutation services continue using the active-only lookup, preventing archived tasks from being edited or transitioned through existing endpoints.

## Query and cache behavior

TanStack Query receives a stable `taskHistory(view)` key. Restore performs a minimal optimistic removal from Archived, captures rollback data, and invalidates history, dashboard, weekly tasks, project summaries/details, task detail, and activity queries after settlement. Missed task mutations reuse the existing task mutation hook and additionally invalidate task-history queries.

The new database access uses current visibility rules and adds partial composite indexes for archived ordering and missed-task lookup where necessary. Queries select one bounded page plus a single look-ahead row. No per-row profile, project, or asset queries are introduced.

## Error handling and accessibility

All new APIs use the existing handler, response envelope, Zod validation, verified Supabase identity, origin checks, and safe `AppError` messages. Invalid cursors return `BAD_REQUEST`; inaccessible tasks remain `NOT_FOUND`; archived-project restore returns `CONFLICT`; stale versions return `CONFLICT`.

Tabs use tab semantics and visible focus. Scroll regions are keyboard focusable and named. Activity task links include the task title in their accessible name. Restore buttons have explicit task-specific labels. Loading skeletons reserve space, empty states explain the next action, and no status depends on color alone.

## Test strategy and commit boundaries

Implementation follows red-green-refactor. The Dashboard change begins with component assertions for bounded, named scroll regions, then receives implementation and its own commit. Activity work begins with repository/DTO and shared-renderer tests proving task title/context routing, then updates both consumers and receives its own commit. Task history begins with failing query-classification, cursor, authorization, restore, route, cache, and screen tests before implementation and receives its own commit.

After each commit, targeted tests plus lint and typecheck run. Final verification runs the full unit/coverage suite, formatting check, production build, public desktop/mobile browser tests, and a focused authenticated history flow when a safe local database is available. External production-like Supabase data is never mutated for verification.

## Out of scope

This work does not unarchive projects, permanently delete tasks, bulk-restore tasks, add a new task status, or redesign unrelated Dashboard widgets. Existing dependency-audit and broad authorization-race findings are separate remediation work unless a touched path must be adjusted to make these features safe.
