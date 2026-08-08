# Dashboard, Activity, and Task History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Dashboard collections compact, identify task-level activity everywhere, and provide paginated Missed/Archived task recovery with Restore.

**Architecture:** Reuse the existing Route Handler → service → repository boundary. Add small shared presentational components for bounded collections and activity rows, then add a cursor-paginated history repository and a version-guarded restore transition.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query 5, Drizzle ORM, PostgreSQL 17, Supabase Auth, Tailwind CSS 4, Radix UI, Vitest, Testing Library, Playwright.

## Global Constraints

- Missed means `scheduled_date < viewer-local today`, `status <> 'DONE'`, `archived_at is null`, active personal scope or active project membership.
- Archived means `archived_at is not null` and current task visibility; Restore is version-safe and forbidden in archived projects.
- Collection reads use opaque tuple cursors and return no more than 30 rows plus one look-ahead row.
- UI uses existing semantic tokens, minimum 44 px controls, visible focus, text plus icon status, and reduced-motion support.
- No authenticated E2E may mutate a hosted/non-local database.

---

### Task 1: Bounded Dashboard collections and Weekly percentage

**Files:**

- Create: `src/components/shared/bounded-card-list.tsx`
- Create: `src/components/shared/bounded-card-list.test.tsx`
- Create: `src/features/weekly/weekly-progress.tsx`
- Create: `src/features/weekly/weekly-progress.test.tsx`
- Modify: `src/features/dashboard/dashboard-screen.tsx`
- Modify: `src/features/weekly/weekly-screen.tsx`

**Interfaces:**

- Produces: `BoundedCardList({ label, children })` and `WeeklyProgress({ completed, total })`.
- Consumes: existing semantic Tailwind tokens and `AppProgress`.

- [ ] **Step 1: Write failing component tests**

```tsx
render(
  <BoundedCardList label="Today's tasks">
    <div>row</div>
  </BoundedCardList>,
);
expect(screen.getByRole("region", { name: "Today's tasks" })).toHaveClass(
  "max-h-[30rem]",
  "overflow-y-auto",
  "overscroll-contain",
);

render(<WeeklyProgress completed={2} total={3} />);
expect(screen.getByText("67%")).toBeVisible();
expect(
  screen.getByRole("progressbar", { name: "2 of 3 tasks completed" }),
).toHaveAttribute("aria-valuenow", "67");
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/components/shared/bounded-card-list.test.tsx src/features/weekly/weekly-progress.test.tsx`

Expected: FAIL because both components do not exist.

- [ ] **Step 3: Implement the shared components and consume them**

```tsx
export function BoundedCardList(props: { label: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={props.label}
      tabIndex={0}
      className="grid max-h-[30rem] gap-3 overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {props.children}
    </div>
  );
}

export function WeeklyProgress({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  if (total === 0) return null;
  const value = Math.round((completed / total) * 100);
  return (
    <>
      <span>{value}%</span>
      <AppProgress value={value} label={`${completed} of ${total} tasks completed`} />
    </>
  );
}
```

Wrap only non-empty Today and Projects collections. Replace the hand-built Weekly bar with `WeeklyProgress` while retaining the existing completed count copy.

- [ ] **Step 4: Verify GREEN and quality gates**

Run: `npx vitest run src/components/shared/bounded-card-list.test.tsx src/features/weekly/weekly-progress.test.tsx`

Run: `npm run lint`

Run: `npm run typecheck`

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/bounded-card-list.tsx src/components/shared/bounded-card-list.test.tsx src/features/dashboard/dashboard-screen.tsx src/features/weekly/weekly-progress.tsx src/features/weekly/weekly-progress.test.tsx src/features/weekly/weekly-screen.tsx
git commit -m "feat: contain dashboard lists and show daily progress"
```

### Task 2: Task-aware activity feed

**Files:**

- Create: `src/components/shared/activity-feed-item.tsx`
- Create: `src/components/shared/activity-feed-item.test.tsx`
- Modify: `src/types/domain.ts`
- Modify: `src/server/repositories/activity-repository.ts`
- Modify: `src/features/projects/project-detail-screen.tsx`
- Modify: `src/features/profile/profile-screen.tsx`

**Interfaces:**

- Produces: `ActivityEventDto.task: { id; title; scheduledDate; archivedAt } | null` and `ActivityFeedItem`.
- Consumes: current privacy-filtered activity join and `formatRelativeDay`.

- [ ] **Step 1: Write failing renderer tests**

```tsx
render(<ActivityFeedItem event={taskEvent} todayDate="2026-08-08" />);
expect(screen.getByText("Fix invitation race")).toBeVisible();
expect(
  screen.getByRole("link", { name: /Open task Fix invitation race/ }),
).toHaveAttribute("href", "/weekly?date=2026-08-07&task=task-1");

render(
  <ActivityFeedItem
    event={{
      ...taskEvent,
      task: { ...taskEvent.task!, archivedAt: "2026-08-08T00:00:00.000Z" },
    }}
    todayDate="2026-08-08"
  />,
);
expect(screen.getByRole("link", { name: /Open task/ })).toHaveAttribute(
  "href",
  "/task-history?view=archived&task=task-1",
);
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/components/shared/activity-feed-item.test.tsx`

Expected: FAIL because task context is absent.

- [ ] **Step 3: Extend the DTO/query and implement one shared renderer**

Select `tasks.title`, `tasks.scheduledDate`, and `tasks.archivedAt` in the existing join and map them without additional queries:

```ts
task: row.taskId && row.taskTitle
  ? {
      id: row.taskId,
      title: row.taskTitle,
      scheduledDate: row.taskScheduledDate!,
      archivedAt: row.taskArchivedAt?.toISOString() ?? null,
    }
  : null;
```

`ActivityFeedItem` must route archived tasks to History, missed tasks to Missed History when `scheduledDate < today` and otherwise to Weekly. Replace duplicate project/profile feed markup with the shared component.

- [ ] **Step 4: Verify GREEN and gates**

Run: `npx vitest run src/components/shared/activity-feed-item.test.tsx src/server/repositories/activity-repository.test.ts`

Run: `npm run lint`

Run: `npm run typecheck`

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/types/domain.ts src/server/repositories/activity-repository.ts src/components/shared/activity-feed-item.tsx src/components/shared/activity-feed-item.test.tsx src/features/projects/project-detail-screen.tsx src/features/profile/profile-screen.tsx
git commit -m "feat: identify tasks in activity feeds"
```

### Task 3: History query and restore domain behavior

**Files:**

- Create: `src/server/repositories/task-history-repository.ts`
- Create: `src/server/repositories/task-history-repository.test.ts`
- Create: `src/server/services/task-history-service.ts`
- Create: `src/server/services/task-history-service.test.ts`
- Create: `src/app/api/tasks/history/route.ts`
- Create: `src/app/api/tasks/[taskId]/restore/route.ts`
- Modify: `src/lib/validation/tasks.ts`
- Modify: `src/server/repositories/task-repository.ts`
- Modify: `src/server/services/task-service.ts`
- Modify: `src/types/domain.ts`

**Interfaces:**

- Produces: `TaskHistoryView`, `TaskHistoryPageDto`, `listTaskHistory`, `getTaskHistory`, `restoreTask`, and archived-safe `getVisibleTask`.
- Consumes: existing `TaskDto`, membership visibility, versioned transaction helper, profile time zone.

- [ ] **Step 1: Write failing cursor/classification and service tests**

```ts
expect(decodeTaskHistoryCursor(encodeTaskHistoryCursor("2026-08-07", taskId))).toEqual({
  sortValue: "2026-08-07",
  id: taskId,
});
expect(() => decodeTaskHistoryCursor("not-a-cursor")).toThrowError(/cursor is invalid/i);

await expect(restoreTask(actorId, taskId, 2)).resolves.toMatchObject({
  id: taskId,
  archivedAt: null,
  version: 3,
});
expect(activityRepository.createActivityEvent).toHaveBeenCalledWith(
  expect.objectContaining({ eventType: "TASK_RESTORED", taskId }),
  expect.anything(),
);
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/server/repositories/task-history-repository.test.ts src/server/services/task-history-service.test.ts`

Expected: FAIL because history and restore functions are missing.

- [ ] **Step 3: Implement bounded history reads and versioned restore**

Add `TASK_RESTORED` to `activityEventTypes`. Implement strict tuple cursor comparisons. Use `findProfileById(userId).timeZone` and `getDateInTimeZone(new Date(), timeZone)` for missed cutoff. Add a guarded repository update:

```ts
.where(and(eq(tasks.id, taskId), eq(tasks.version, version), isNotNull(tasks.archivedAt)))
.set({ archivedAt: null, version: version + 1, updatedAt: new Date() })
```

Add `GET /api/tasks/history` and same-origin-protected `POST /api/tasks/[taskId]/restore`, both through `withApiHandler`.

- [ ] **Step 4: Verify GREEN and gates**

Run: `npx vitest run src/server/repositories/task-history-repository.test.ts src/server/services/task-history-service.test.ts src/server/services/task-service.test.ts`

Run: `npm run lint`

Run: `npm run typecheck`

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/types/domain.ts src/lib/validation/tasks.ts src/server/repositories/task-history-repository.ts src/server/repositories/task-history-repository.test.ts src/server/repositories/task-repository.ts src/server/services/task-history-service.ts src/server/services/task-history-service.test.ts src/server/services/task-service.ts src/app/api/tasks/history/route.ts src/app/api/tasks/[taskId]/restore/route.ts
git commit -m "feat: add task history and restore APIs"
```

### Task 4: Task History page, navigation, and optimistic restore

**Files:**

- Create: `src/app/(app)/task-history/page.tsx`
- Create: `src/features/tasks/task-history-screen.tsx`
- Create: `src/features/tasks/task-history-screen.test.tsx`
- Create: `src/features/tasks/task-history-hooks.ts`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/lib/api/query-keys.ts`
- Modify: `src/lib/pwa/query-persistence.ts`
- Modify: `src/features/tasks/task-hooks.ts`
- Modify: `src/components/ui/task-detail-sheet.tsx`

**Interfaces:**

- Produces: protected `/task-history`, URL-backed `missed|archived` tabs, cursor loading, and optimistic restore.
- Consumes: Task 3 APIs and archived-safe task detail reads.

- [ ] **Step 1: Write failing screen tests**

```tsx
render(<TaskHistoryScreen initialView="missed" />);
expect(screen.getByRole("tab", { name: "Missed" })).toHaveAttribute(
  "aria-selected",
  "true",
);
expect(await screen.findByText("Yesterday's unfinished task")).toBeVisible();

await user.click(screen.getByRole("tab", { name: "Archived" }));
expect(mockRouter.push).toHaveBeenCalledWith("/task-history?view=archived");
await user.click(await screen.findByRole("button", { name: "Restore Archived task" }));
expect(screen.queryByText("Archived task")).not.toBeInTheDocument();
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/features/tasks/task-history-screen.test.tsx`

Expected: FAIL because the route and screen do not exist.

- [ ] **Step 3: Implement navigation, tabs, rows, detail, and cache updates**

Use `useInfiniteQuery` keyed by `queryKeys.taskHistory(view)`. Restore removes the matching row in `onMutate`, rolls back in `onError`, and invalidates history, week, Dashboard, projects, task and activity keys in `onSettled`. Add `History` to the six-column mobile nav and `Task history` desktop label.

- [ ] **Step 4: Verify GREEN and browser behavior**

Run: `npx vitest run src/features/tasks/task-history-screen.test.tsx src/lib/pwa/query-persistence.test.ts`

Run: `npm run lint`

Run: `npm run typecheck`

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/task-history/page.tsx src/features/tasks/task-history-screen.tsx src/features/tasks/task-history-screen.test.tsx src/features/tasks/task-history-hooks.ts src/components/layout/app-shell.tsx src/lib/api/query-keys.ts src/lib/pwa/query-persistence.ts src/features/tasks/task-hooks.ts src/components/ui/task-detail-sheet.tsx
git commit -m "feat: add task history workspace"
```

### Task 5: First-plan verification

**Files:**

- Modify only files required by failing checks.

**Interfaces:**

- Consumes: Tasks 1–4.
- Produces: a complete, independently usable Dashboard/Activity/History increment.

- [ ] **Step 1: Run full verification**

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm run test:coverage`

Run: `npm run format`

Run: `npm run build`

Run: `npx playwright test tests/e2e/app.spec.ts`

Expected: all commands exit 0; no tracked diff is introduced by verification.

- [ ] **Step 2: Resolve verification failures at their owning task**

If a check fails, return to the task that owns the affected file, add a regression test first, apply the smallest correction, rerun that task's focused checks, and create a specifically scoped fix commit before repeating Step 1.
