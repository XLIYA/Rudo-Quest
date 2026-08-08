# Advanced Task System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-native creation, task classification, one-level Story/Subtask roll-up, private file and link attachments, and reliable save-close behavior.

**Architecture:** Extend the existing `tasks` aggregate instead of adding a parallel work-item model. Enforce hierarchy invariants in PostgreSQL and in the service layer, keep all writes behind authenticated Route Handlers, store files in a private Supabase bucket, and expose lazy detail endpoints for children and attachments so list payloads remain bounded.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query 5, Drizzle ORM, PostgreSQL 17, Supabase Storage, Zod 4, Tailwind CSS 4, Vitest, Testing Library, Playwright.

## Global Constraints

- Task types are `TASK`, `STORY`, `FEATURE`, `BUG`, and `TEST`; priorities are `NONE`, `LOW`, `MEDIUM`, `HIGH`, and `URGENT`.
- Only Stories can own subtasks. Hierarchy is one level, parent and child share project/personal scope, and all top-level collection queries exclude subtasks.
- Completing every active subtask marks its Story done. Reopening or creating an incomplete subtask reopens a done Story to `IN_PROGRESS`. A Story with no active subtasks remains manually controllable.
- Project task creation binds the route's project automatically and permits `assigneeId: null`; personal tasks remain self-assigned.
- File uploads are private, at most 10 MiB, and restricted to validated raster images, PDF, text, Office, and archive formats. Executables, HTML, and SVG are rejected. External links must use HTTP or HTTPS.
- Task detail closes only after a successful update; failures retain the open sheet and the user's draft.
- Database migrations enable RLS and revoke direct `anon`/`authenticated` grants for new application tables. Storage schema internals are not modified.

---

### Task 1: Persist classification, hierarchy, and attachment metadata

**Files:**

- Create: one timestamped SQL file under `src/db/migrations/` using `npx supabase migration new advanced_task_system` and move the generated file into the repository's configured migration directory if the CLI creates it under `supabase/migrations/`
- Modify: `src/db/schema/index.ts`
- Modify: `src/types/domain.ts`
- Modify: `src/lib/validation/tasks.ts`
- Modify: `src/lib/validation/schemas.test.ts`

**Interfaces:**

- Produces: `TaskType`, `TaskPriority`, attachment DTOs, `tasks.task_type`, `tasks.priority`, `tasks.parent_task_id`, `task_attachments`, `task_attachment_uploads`, and private bucket provisioning.
- Consumes: existing task enum/check conventions and profile upload lifecycle patterns.

- [ ] **Step 1: Write failing validation tests**

```ts
expect(
  createTaskSchema.parse({ ...validTask, taskType: "STORY", priority: "URGENT" }),
).toMatchObject({ taskType: "STORY", priority: "URGENT" });
expect(createTaskSchema.safeParse({ ...validTask, taskType: "EPIC" }).success).toBe(
  false,
);
expect(
  createTaskSchema.safeParse({
    ...validTask,
    parentTaskId: crypto.randomUUID(),
    taskType: "STORY",
  }).success,
).toBe(false);
expect(
  createTaskLinkAttachmentSchema.safeParse({ url: "javascript:alert(1)", label: "bad" })
    .success,
).toBe(false);
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/lib/validation/schemas.test.ts`

Expected: FAIL because classification, hierarchy, and link schemas are absent.

- [ ] **Step 3: Generate and implement the migration and typed schema**

Run: `npx supabase migration new advanced_task_system`

Add enum-backed checks/defaults, the self-referencing parent FK, indexes for top-level and child reads, XOR constraints for FILE/LINK attachment metadata, upload-intent expiry metadata, ownership FKs, RLS, explicit grant revocation, and idempotent provisioning for the private `task-attachments` bucket with the approved 10 MiB limit and MIME allowlist. Add a trigger that rejects nesting, non-Story parents, and mismatched scope.

- [ ] **Step 4: Verify GREEN and schema gates**

Run: `npx vitest run src/lib/validation/schemas.test.ts`

Run: `npm run lint`

Run: `npm run typecheck`

Expected: all exit 0 and the migration contains no custom object inside the `storage` schema.

- [ ] **Step 5: Commit**

```bash
git add src/db/migrations src/db/schema/index.ts src/types/domain.ts src/lib/validation/tasks.ts src/lib/validation/schemas.test.ts
git commit -m "feat: model advanced task metadata"
```

### Task 2: Project-native creation, type, and priority

**Files:**

- Create: `src/components/ui/task-create-sheet.tsx`
- Create: `src/components/ui/task-create-sheet.test.tsx`
- Create: `src/components/ui/task-classification.tsx`
- Create: `src/components/ui/task-classification.test.tsx`
- Modify: `src/server/services/task-service.ts`
- Modify: `src/server/services/task-service.test.ts`
- Modify: `src/server/repositories/task-repository.ts`
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/features/tasks/task-hooks.ts`
- Modify: `src/features/projects/project-detail-screen.tsx`
- Modify: `src/components/ui/task-row.tsx`

**Interfaces:**

- Produces: full project-context creation sheet and consistent task type/priority badges.
- Consumes: Task 1 DTOs and existing versioned task writes.

- [ ] **Step 1: Write failing service and component tests**

```ts
await createTask(userId, { ...projectPayload, assigneeId: undefined });
expect(taskRepository.insertTask).toHaveBeenCalledWith(
  expect.objectContaining({ projectId, assigneeId: null, taskType: "TASK", priority: "NONE" }),
  expect.anything(),
);

render(<TaskCreateSheet open projectId={projectId} scheduledDate="2026-08-08" onOpenChange={vi.fn()} onCreated={vi.fn()} />);
expect(screen.getByLabelText("Project")).toBeDisabled();
expect(screen.getByText("Leave unassigned")).toBeVisible();
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/server/services/task-service.test.ts src/components/ui/task-create-sheet.test.tsx src/components/ui/task-classification.test.tsx`

Expected: FAIL because project creation still auto-assigns the creator and the new UI is absent.

- [ ] **Step 3: Implement classification and project-context creation**

Default omitted project assignee to `null`, preserve self-assignment for personal tasks, persist type/priority, add an enabled Create Task action for editable active projects, and pre-bind the project in a complete accessible sheet. Render text-plus-icon classification in task rows and Kanban cards.

- [ ] **Step 4: Verify GREEN and gates**

Run: `npx vitest run src/server/services/task-service.test.ts src/components/ui/task-create-sheet.test.tsx src/components/ui/task-classification.test.tsx src/components/ui/task-row.test.tsx`

Run: `npm run lint`

Run: `npm run typecheck`

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/task-create-sheet.tsx src/components/ui/task-create-sheet.test.tsx src/components/ui/task-classification.tsx src/components/ui/task-classification.test.tsx src/server/services/task-service.ts src/server/services/task-service.test.ts src/server/repositories/task-repository.ts src/app/api/tasks/route.ts src/features/tasks/task-hooks.ts src/features/projects/project-detail-screen.tsx src/components/ui/task-row.tsx src/components/ui/task-row.test.tsx
git commit -m "feat: create classified tasks from projects"
```

### Task 3: Story subtasks and transactional roll-up

**Files:**

- Create: `src/app/api/tasks/[taskId]/subtasks/route.ts`
- Create: `src/components/ui/story-subtasks.tsx`
- Create: `src/components/ui/story-subtasks.test.tsx`
- Modify: `src/server/repositories/task-repository.ts`
- Modify: `src/server/services/task-service.ts`
- Modify: `src/server/services/task-service.test.ts`
- Modify: `src/app/api/tasks/[taskId]/complete/route.ts`
- Modify: `src/app/api/tasks/[taskId]/reopen/route.ts`
- Modify: `src/components/ui/task-detail-sheet.tsx`
- Modify: `src/features/tasks/task-hooks.ts`
- Modify: `src/types/domain.ts`

**Interfaces:**

- Produces: Story summary fields, lazy child query/create endpoint, and roll-up state transitions in the same transaction as child changes.
- Consumes: parent invariant from Task 1 and current optimistic/versioned transition patterns.

- [ ] **Step 1: Write failing domain and UI tests**

```ts
await completeTask(userId, childId, 2);
expect(taskRepository.rollUpStoryStatus).toHaveBeenCalledWith(parentId, expect.anything());

await expect(completeTask(userId, storyId, 4)).rejects.toMatchObject({ status: 409 });

render(<StorySubtasks story={storyWithTwoOfThreeDone} />);
expect(screen.getByRole("progressbar", { name: "2 of 3 subtasks completed" })).toHaveAttribute("aria-valuenow", "67");
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/server/services/task-service.test.ts src/components/ui/story-subtasks.test.tsx`

Expected: FAIL because roll-up and Story child UI do not exist.

- [ ] **Step 3: Implement one-level Story behavior**

Validate parent visibility and scope before child creation. Exclude subtasks from week, Dashboard, project-board, missed, and archived top-level reads. Fetch children only while a Story detail sheet is open. Count active children only. Reject manual Story completion with incomplete active children; auto-complete after the final child completes and reopen to `IN_PROGRESS` when an active child becomes incomplete. Archive a Story without rewriting children and reveal them again on restore.

- [ ] **Step 4: Verify GREEN and gates**

Run: `npx vitest run src/server/services/task-service.test.ts src/components/ui/story-subtasks.test.tsx src/server/repositories/task-history-repository.test.ts`

Run: `npm run lint`

Run: `npm run typecheck`

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tasks/[taskId]/subtasks/route.ts src/components/ui/story-subtasks.tsx src/components/ui/story-subtasks.test.tsx src/server/repositories/task-repository.ts src/server/services/task-service.ts src/server/services/task-service.test.ts src/app/api/tasks/[taskId]/complete/route.ts src/app/api/tasks/[taskId]/reopen/route.ts src/components/ui/task-detail-sheet.tsx src/features/tasks/task-hooks.ts src/types/domain.ts
git commit -m "feat: add stories and transactional subtasks"
```

### Task 4: Private file and external-link attachments

**Files:**

- Create: `src/server/repositories/task-attachment-repository.ts`
- Create: `src/server/services/task-attachment-service.ts`
- Create: `src/server/services/task-attachment-service.test.ts`
- Create: `src/app/api/tasks/[taskId]/attachments/route.ts`
- Create: `src/app/api/tasks/[taskId]/attachments/upload/route.ts`
- Create: `src/app/api/tasks/[taskId]/attachments/[attachmentId]/route.ts`
- Create: `src/components/ui/task-attachments.tsx`
- Create: `src/components/ui/task-attachments.test.tsx`
- Modify: `src/components/ui/task-detail-sheet.tsx`
- Modify: `src/lib/api/query-keys.ts`
- Modify: `src/types/domain.ts`

**Interfaces:**

- Produces: link creation, signed upload preparation/finalization, signed private reads, deletion, and attachment UI.
- Consumes: server-only Supabase admin client, authenticated task visibility, and approved MIME/size policy.

- [ ] **Step 1: Write failing security/lifecycle and UI tests**

```ts
await expect(prepareTaskAttachmentUpload(userId, taskId, { name: "run.exe", size: 12, mimeType: "application/x-msdownload" }))
  .rejects.toMatchObject({ status: 400 });
await expect(prepareTaskAttachmentUpload(userId, taskId, { name: "large.pdf", size: 10 * 1024 * 1024 + 1, mimeType: "application/pdf" }))
  .rejects.toMatchObject({ status: 400 });
expect(await createTaskLinkAttachment(userId, taskId, { url: "https://example.com/spec", label: "Spec" }))
  .toMatchObject({ kind: "LINK", label: "Spec" });

render(<TaskAttachments task={task} />);
expect(screen.getByRole("button", { name: "Upload file" })).toBeVisible();
expect(screen.getByRole("button", { name: "Add link" })).toBeVisible();
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/server/services/task-attachment-service.test.ts src/components/ui/task-attachments.test.tsx`

Expected: FAIL because attachment lifecycle and UI are absent.

- [ ] **Step 3: Implement secure attachment lifecycle**

Authorize every operation through task visibility/edit policy. Generate collision-safe object keys, short-lived signed upload URLs, persist an expiring upload intent, verify uploaded object metadata before finalizing, and generate short-lived signed download URLs on reads. Accept only the approved MIME families and extensions, block HTML/SVG/executables, permit only HTTP/HTTPS links, and delete metadata transactionally before best-effort object cleanup. Show raster previews only for validated image content; display all other files as download rows.

- [ ] **Step 4: Verify GREEN and gates**

Run: `npx vitest run src/server/services/task-attachment-service.test.ts src/components/ui/task-attachments.test.tsx`

Run: `npm run lint`

Run: `npm run typecheck`

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/task-attachment-repository.ts src/server/services/task-attachment-service.ts src/server/services/task-attachment-service.test.ts src/app/api/tasks/[taskId]/attachments/route.ts src/app/api/tasks/[taskId]/attachments/upload/route.ts src/app/api/tasks/[taskId]/attachments/[attachmentId]/route.ts src/components/ui/task-attachments.tsx src/components/ui/task-attachments.test.tsx src/components/ui/task-detail-sheet.tsx src/lib/api/query-keys.ts src/types/domain.ts
git commit -m "feat: add private task attachments"
```

### Task 5: Close task details only after a successful save

**Files:**

- Create: `src/components/ui/task-detail-sheet.test.tsx`
- Modify: `src/components/ui/task-detail-sheet.tsx`
- Modify: `src/features/dashboard/dashboard-screen.tsx`
- Modify: `src/features/weekly/weekly-screen.tsx`
- Modify: `src/features/projects/project-detail-screen.tsx`
- Modify: `src/features/tasks/task-history-screen.tsx`

**Interfaces:**

- Produces: Promise-based `onSave` contract with explicit success-close behavior.
- Consumes: `useTaskMutation().mutateAsync` and current conflict/error handling.

- [ ] **Step 1: Write failing interaction tests**

```tsx
const deferred = createDeferred<TaskDto>();
render(<TaskDetailSheet {...props} onSave={() => deferred.promise} />);
await user.click(screen.getByRole("button", { name: "Save changes" }));
expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
deferred.resolve(updatedTask);
await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));

render(<TaskDetailSheet {...props} onSave={() => Promise.reject(new Error("failed"))} />);
await user.click(screen.getByRole("button", { name: "Save changes" }));
expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
expect(screen.getByDisplayValue("Edited title")).toBeVisible();
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/components/ui/task-detail-sheet.test.tsx`

Expected: FAIL because the save callback is synchronous and the sheet does not own success-close semantics.

- [ ] **Step 3: Implement awaited save behavior at every caller**

Change `onSave` to return `Promise<TaskDto>`, await it inside the submit handler, guard duplicate submissions, call `onOpenChange(false)` only on resolution, and preserve draft/open state on rejection. Convert every caller to `mutation.mutateAsync` and avoid unhandled promise rejections.

- [ ] **Step 4: Verify GREEN and gates**

Run: `npx vitest run src/components/ui/task-detail-sheet.test.tsx src/features/tasks/task-history-screen.test.tsx`

Run: `npm run lint`

Run: `npm run typecheck`

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/task-detail-sheet.tsx src/components/ui/task-detail-sheet.test.tsx src/features/dashboard/dashboard-screen.tsx src/features/weekly/weekly-screen.tsx src/features/projects/project-detail-screen.tsx src/features/tasks/task-history-screen.tsx
git commit -m "fix: close task details after successful save"
```

### Task 6: Full product verification

**Files:**

- Modify only files tied to a discovered regression, with a failing regression test first.

**Interfaces:**

- Consumes: every task in both implementation plans.
- Produces: a release-ready feature branch.

- [ ] **Step 1: Run complete static and automated verification**

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm run test:coverage`

Run: `npm run format`

Run: `npm run build`

Run: `npx playwright test tests/e2e/app.spec.ts`

Expected: all exit 0 and formatting introduces no tracked diff.

- [ ] **Step 2: Run safe browser acceptance**

Start the local development server, use Playwright against public/auth-boundary routes, and exercise authenticated create/edit/story/attachment/history flows only when the configured database is proven local and disposable. Verify keyboard focus, internal Dashboard scroll, mobile navigation, tab URLs, optimistic restore rollback, and Story progress.

- [ ] **Step 3: Resolve any failures at their owning task**

For each failure, add a focused failing regression test, make the smallest correction, rerun the focused checks, commit with a concrete scope, then repeat Steps 1 and 2.
