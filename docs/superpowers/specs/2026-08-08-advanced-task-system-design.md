# Advanced task system design

## Scope and success criteria

This design extends Rudo Quest's task model with project-context creation, stories and one-level subtasks, private file and safe-link attachments, task priority and type, successful-save dismissal, and explicit percentages in Weekly day progress. It integrates with the separately specified Dashboard containment, activity context, and Task history work.

The work succeeds when a contributor can create an unassigned task directly inside a project; classify and prioritize tasks; create a Story with independently actionable subtasks; rely on deterministic Story completion; attach, view, download, link, and remove permitted resources; save edits and see the sheet close only after success; and read a numeric completion percentage in each non-empty Weekly day accordion.

## Domain model

### Task type and priority

`tasks.task_type` is required and defaults to `TASK`. Its allowed values are `TASK`, `STORY`, `FEATURE`, `BUG`, and `TEST`. `tasks.priority` is required and defaults to `NONE`. Its allowed values are `NONE`, `LOW`, `MEDIUM`, `HIGH`, and `URGENT`. Both are represented by exported readonly domain constants, validated by Zod at API boundaries, constrained in PostgreSQL, and rendered with text and icon in addition to semantic color.

### Stories and subtasks

`tasks.parent_task_id` is a nullable self-reference. A row with a parent is a Subtask in the UI. Hierarchy is limited to one level: a parent must be a top-level `STORY`, and a child cannot itself have children or use `STORY` as its type. Parent and child must share project scope; both are personal or both use the same project. Subtasks inherit the parent project and scheduled time zone, default to the parent's date, and may have their own date, assignee, title, description, status, priority, and non-Story type.

Application validation produces clear errors, while database checks and a trigger protect hierarchy depth, parent type, and scope against writes outside the service layer. A self-parent is always rejected.

Completing the final active Subtask completes its Story in the same transaction. If an active Subtask is reopened, or a new incomplete Subtask is added to a completed Story, the Story moves to `IN_PROGRESS` in that transaction. Archived Subtasks do not contribute to the denominator. A Story with no active Subtasks remains manually controllable. Manual completion of a Story that has active incomplete Subtasks is rejected.

Archiving a Story hides its Subtasks from active surfaces by parent visibility without rewriting each child's independent state. Restoring the Story reveals those children again. Archiving and restoring an individual Subtask remains independent. A Subtask cannot be restored while its Story or project is archived.

## Project-context creation

The project detail board receives a primary `Create task` action. It opens the existing task creation experience with `projectId` fixed to the current project and no redundant project picker. Assignee is optional. This changes the service's current implicit project-task assignment behavior: omitted or null `assigneeId` remains null instead of defaulting to the creator. Personal tasks continue assigning the creator because their database invariant requires it.

Project viewers cannot create tasks. Owner, admin, and member behavior continues to follow the current project policy. Archived projects keep all creation controls disabled.

## Attachments

### Storage and records

`task_attachments` stores one attachment per row with task, uploader, kind (`FILE` or `LINK`), safe display name, and timestamps. File records additionally store a private Storage path, content type, and byte size. Link records store a normalized `http` or `https` URL. Database constraints enforce the correct mutually exclusive fields for each kind.

`task_attachment_uploads` tracks signed uploads until commitment, mirroring the existing abandoned profile-upload lifecycle. A private `task-attachments` Supabase Storage bucket enforces a 10 MB object limit and an allowlist covering safe raster images, PDF, text, common Office documents, and archives. Executables and active formats such as HTML and SVG are rejected. Stored paths use task, uploader, and random UUID segments rather than user filenames.

The server validates ownership of the pending upload, object existence, size, content type, extension agreement, and image bytes before commitment. Images eligible for inline preview are limited to validated raster formats. Other files use attachment download behavior. Signed read URLs are short-lived and generated only after task visibility authorization. Storage paths and admin credentials never reach the browser as durable public values.

### Attachment API and UX

The task detail sheet loads attachments only while open. It supports signed file upload, safe external-link creation, image preview, filename/type/size display, opening a normalized link with `noopener noreferrer`, downloading a file, and authorized deletion. Upload progress and errors are isolated from the task edit form. Attachment mutation requires task edit permission; read requires task visibility. Removing a file commits the database deletion before best-effort Storage cleanup, with failures reported to observability.

## UI and interaction design

### Design brief

The interface serves users triaging real work on desktop and mobile. It should retain Rudo Quest's calm, tactile surfaces while making richer task metadata scannable. Existing semantic tokens, Bitcount display treatment, Noto Serif body type, spacing, radii, shadows, focus rings, and motion durations are reused. No new hardcoded colors or parallel component language is introduced.

Task rows show compact Type and Priority indicators without displacing title, project, time, status, or assignee. The detail sheet groups information into clear sections: core details; classification and priority; Story progress and Subtasks when applicable; and Attachments. Heavy data is fetched on demand rather than embedded into every list response.

Story progress includes an accessible progress bar, a numeric percentage, and `completed / total` copy. Subtasks are actionable rows and open their own details. The memorable interaction is deterministic roll-up: completing the final Subtask visibly resolves the Story progress to 100% without a reload; reopening a child brings the Story back to in progress.

### Save behavior

Task save uses a Promise-returning mutation path. The detail sheet closes only after the server returns the updated task and relevant caches are updated. Validation, connectivity, authorization, or optimistic-version conflicts leave the sheet open with the user's draft intact. Other actions such as Start, Complete, Reopen, attachment upload, and Subtask changes do not accidentally dismiss the sheet.

### Weekly progress percentage

Every non-empty Weekly day accordion displays the exact rounded percentage next to its current progress bar and retains the existing `completed / total` text. The Progress primitive receives an accessible numeric value. Empty days omit the percentage because there is no meaningful denominator.

## API and data flow

Task create and update schemas accept type and priority. A dedicated Subtask collection under a Story supports list and create; existing task endpoints operate on a Subtask once its ID is known. Task reads expose summary fields `subtaskTotal`, `subtaskCompleted`, and `subtaskProgressPercent` for Story rows without embedding the full collection.

Attachment endpoints are resource-oriented: list, create link, request signed upload, commit uploaded file, and delete. They use the existing verified Supabase identity, shared API envelope, origin enforcement, bounded body parsing, Zod validation, rate limits, and safe `AppError` mapping.

Story roll-up is a repository operation invoked from create, complete, reopen, move, archive, and restore paths. Child mutation and parent recalculation use one database transaction. Optimistic versions increment for every changed row so concurrent clients refetch rather than silently overwrite each other.

## Query performance and caching

Top-level Dashboard, Weekly, project, missed, and archived queries exclude Subtasks unless explicitly requesting a Story's children. Parent visibility excludes children of archived Stories from active surfaces. Story summary counts are computed in a bounded aggregate joined to list results, avoiding per-Story queries.

Indexes support parent lookup, active Story-child roll-up, task type and priority filters where useful, attachment task ordering, and pending-upload cleanup. Attachment lists and Subtask lists are independently cached by task ID. Successful mutations invalidate only affected task, parent, week, project, Dashboard, history, activity, attachment, and Subtask keys. Large files never pass through React Query state as byte arrays.

## Accessibility, security, and failure behavior

All controls keep at least the existing touch size and visible focus. Type, priority, completion, upload status, and errors are conveyed textually. Progress uses native/Radix progress semantics. Attachment remove actions require confirmation where loss would be surprising. File inputs have explicit accepted-type guidance and upload size copy.

Authorization is derived server-side for every nested resource. File names are presentation data only and never form object paths. Link URLs reject credentials, non-HTTP protocols, and malformed values. Active content is never previewed inline. Archived tasks and archived projects remain read-only except for their explicit, authorized restore operation.

## Alternatives considered

Separate Story and Subtask tables would make hierarchy explicit but duplicate task state, policy, activity, scheduling, and UI logic. JSON Subtasks would reduce migrations but prevent reliable concurrent updates, relational constraints, pagination, and individual activity. A self-referencing Task model provides the smallest coherent extension while preserving existing task infrastructure, so it is selected.

## Test strategy and commit boundaries

Every behavior follows red-green-refactor. Domain constants, validation, hierarchy constraints, roll-up state changes, unassigned project creation, and optimistic conflicts receive focused unit/service/repository tests. Attachments receive path, MIME, URL, authorization, lifecycle, route, and rendering tests. UI tests cover type/priority selection, Story progress, project-context creation, save dismissal only on success, and numeric Weekly percentages.

Implementation commits are intentionally isolated: Dashboard containment and Weekly percentage; activity task context; Task history and restore; task type/priority plus project creation; Story/Subtask hierarchy and roll-up; attachments; and successful-save dismissal. Each commit follows targeted tests, lint, and typecheck. Final verification runs the full coverage suite, formatting, production build, migration checks, and desktop/mobile Playwright. Authenticated mutation E2E uses only a safe local Supabase/Postgres environment.

## Out of scope

This iteration does not add nested Subtasks, comments, attachment versioning, collaborative document editing, arbitrary inline file rendering, bulk Story operations, project restoration, or permanent task deletion. These can be added later without changing the selected relational boundaries.
