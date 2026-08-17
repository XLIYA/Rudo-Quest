import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNull,
  isNotNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  activityEvents,
  profiles,
  projects,
  projectMemberships,
  tasks,
} from "@/db/schema";
import { getDb, type DbExecutor } from "@/lib/db/client";
import { createProfileAssetUrlMap, profileAssetUrl } from "@/server/profile-assets";
import { humanizeActivity } from "@/server/repositories/activity-repository";
import type {
  ProjectColorKey,
  ProjectIconKey,
  TaskActivityDto,
  TaskDto,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/types/domain";
import { getDateInTimeZone } from "@/lib/utils/dates";

/**
 * Purpose: Map a task query row into the public task DTO.
 * Inputs: Joined task row from repository selects.
 * Output: TaskDto with ISO date strings.
 * Side effects: None.
 */
export type TaskDtoRow = {
  id: string;
  projectId: string | null;
  createdById: string;
  createdByHandle: string;
  createdByDisplayName: string;
  createdByAvatarPath: string | null;
  assigneeId: string | null;
  assigneeHandle: string | null;
  assigneeDisplayName: string | null;
  assigneeAvatarPath: string | null;
  title: string;
  description: string | null;
  iconKey: string | null;
  taskType: string;
  priority: string;
  parentTaskId: string | null;
  subtaskTotal: number;
  subtaskCompleted: number;
  status: string;
  previousStatus: string | null;
  scheduledDate: string;
  scheduledTime: string | null;
  scheduledTimeZone: string;
  completedAt: Date | null;
  archivedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  projectTitle: string | null;
  projectColorKey: string | null;
  projectIconKey: string | null;
  viewerRole?: string | null;
};

export function toTaskDto(
  row: TaskDtoRow,
  avatarUrls: Map<string, string>,
  viewerUserId?: string,
): TaskDto {
  const canEditDetails = row.projectId
    ? row.viewerRole === "OWNER" ||
      row.viewerRole === "ADMIN" ||
      (row.viewerRole === "MEMBER" && row.assigneeId === viewerUserId)
    : row.createdById === viewerUserId;
  const canTransition = row.projectId
    ? canEditDetails || (row.viewerRole === "MEMBER" && row.assigneeId === viewerUserId)
    : row.createdById === viewerUserId;
  const canCreateSubtasks = row.projectId
    ? row.viewerRole === "OWNER" ||
      row.viewerRole === "ADMIN" ||
      row.viewerRole === "MEMBER"
    : row.createdById === viewerUserId;
  return {
    id: row.id,
    projectId: row.projectId,
    createdBy: {
      id: row.createdById,
      handle: row.createdByHandle,
      displayName: row.createdByDisplayName,
      avatarUrl: profileAssetUrl(row.createdByAvatarPath, avatarUrls),
    },
    assignee: row.assigneeId
      ? {
          id: row.assigneeId,
          handle: row.assigneeHandle ?? "unknown",
          displayName: row.assigneeDisplayName ?? "Unknown user",
          avatarUrl: profileAssetUrl(row.assigneeAvatarPath, avatarUrls),
        }
      : null,
    title: row.title,
    description: row.description,
    iconKey: row.iconKey as ProjectIconKey | null,
    taskType: row.taskType as TaskType,
    priority: row.priority as TaskPriority,
    parentTaskId: row.parentTaskId,
    subtaskTotal: row.subtaskTotal,
    subtaskCompleted: row.subtaskCompleted,
    subtaskProgressPercent: row.subtaskTotal
      ? Math.round((row.subtaskCompleted / row.subtaskTotal) * 100)
      : 0,
    status: row.status as TaskStatus,
    previousStatus: row.previousStatus as Exclude<TaskStatus, "DONE"> | null,
    scheduledDate: row.scheduledDate,
    scheduledTime: row.scheduledTime,
    scheduledTimeZone: row.scheduledTimeZone,
    completedAt: row.completedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    permissions: {
      canEditDetails,
      canCreateSubtasks,
      canTransition,
      canArchive: canTransition,
    },
    project: row.projectId
      ? {
          id: row.projectId,
          title: row.projectTitle ?? "Project",
          colorKey: row.projectColorKey as ProjectColorKey,
          iconKey: row.projectIconKey as ProjectIconKey,
        }
      : null,
  };
}

/**
 * Purpose: Read tasks visible in a week for the current user.
 * Inputs: User ID and ISO week date bounds.
 * Output: Task DTOs.
 * Side effects: Reads task, profile, and project rows.
 */
export async function listWeekTasks(input: {
  userId: string;
  from?: string;
  to: string;
  projectId?: string;
  personalOnly?: boolean;
  incompleteOnly?: boolean;
  includeOpenOutsideWeek?: boolean;
}): Promise<TaskDto[]> {
  const db = getDb();
  const creator = alias(profiles, "creator_profiles");
  const assignee = alias(profiles, "assignee_profiles");
  const subtaskSummary = createSubtaskSummary(db, "week_subtask_summary");
  const rows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      createdById: tasks.createdBy,
      createdByHandle: creator.handle,
      createdByDisplayName: creator.displayName,
      createdByAvatarPath: creator.avatarPath,
      assigneeId: tasks.assigneeId,
      assigneeHandle: assignee.handle,
      assigneeDisplayName: assignee.displayName,
      assigneeAvatarPath: assignee.avatarPath,
      title: tasks.title,
      description: tasks.description,
      iconKey: tasks.iconKey,
      taskType: tasks.taskType,
      priority: tasks.priority,
      parentTaskId: tasks.parentTaskId,
      subtaskTotal: sql<number>`coalesce(${subtaskSummary.total}, 0)`.mapWith(Number),
      subtaskCompleted: sql<number>`coalesce(${subtaskSummary.completed}, 0)`.mapWith(
        Number,
      ),
      status: tasks.status,
      previousStatus: tasks.previousStatus,
      scheduledDate: tasks.scheduledDate,
      scheduledTime: tasks.scheduledTime,
      scheduledTimeZone: tasks.scheduledTimeZone,
      completedAt: tasks.completedAt,
      archivedAt: tasks.archivedAt,
      version: tasks.version,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      projectTitle: projects.title,
      projectColorKey: projects.colorKey,
      projectIconKey: projects.iconKey,
      viewerRole: projectMemberships.role,
    })
    .from(tasks)
    .innerJoin(creator, eq(tasks.createdBy, creator.id))
    .leftJoin(assignee, eq(tasks.assigneeId, assignee.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(subtaskSummary, eq(subtaskSummary.parentTaskId, tasks.id))
    .leftJoin(
      projectMemberships,
      and(
        eq(projectMemberships.projectId, tasks.projectId),
        eq(projectMemberships.userId, input.userId),
      ),
    )
    .where(
      and(
        or(
          and(
            input.from ? gte(tasks.scheduledDate, input.from) : undefined,
            lte(tasks.scheduledDate, input.to),
          ),
          input.includeOpenOutsideWeek ? ne(tasks.status, "DONE") : undefined,
        ),
        input.incompleteOnly ? ne(tasks.status, "DONE") : undefined,
        input.projectId ? eq(tasks.projectId, input.projectId) : undefined,
        input.personalOnly ? isNull(tasks.projectId) : undefined,
        isNull(tasks.parentTaskId),
        isNull(tasks.archivedAt),
        or(
          and(
            isNull(tasks.projectId),
            or(eq(tasks.createdBy, input.userId), eq(tasks.assigneeId, input.userId)),
          ),
          and(
            isNotNull(tasks.projectId),
            isNull(projects.archivedAt),
            isNotNull(projectMemberships.userId),
          ),
        ),
      ),
    )
    .orderBy(asc(tasks.scheduledDate), asc(tasks.scheduledTime), asc(tasks.createdAt));
  const avatarUrls = await createProfileAssetUrlMap(
    rows.flatMap((row) => [row.createdByAvatarPath, row.assigneeAvatarPath]),
  );
  return rows.map((row) => toTaskDto(row, avatarUrls, input.userId));
}

/**
 * Purpose: Read one task DTO by ID.
 * Inputs: Task ID.
 * Output: Task DTO or null.
 * Side effects: Reads task joins.
 */
export async function findTaskDto(
  taskId: string,
  viewerUserId?: string,
  db: DbExecutor = getDb(),
): Promise<TaskDto | null> {
  const creator = alias(profiles, "creator_profiles");
  const assignee = alias(profiles, "assignee_profiles");
  const subtaskSummary = createSubtaskSummary(db, "detail_subtask_summary");
  const rows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      createdById: tasks.createdBy,
      createdByHandle: creator.handle,
      createdByDisplayName: creator.displayName,
      createdByAvatarPath: creator.avatarPath,
      assigneeId: tasks.assigneeId,
      assigneeHandle: assignee.handle,
      assigneeDisplayName: assignee.displayName,
      assigneeAvatarPath: assignee.avatarPath,
      title: tasks.title,
      description: tasks.description,
      iconKey: tasks.iconKey,
      taskType: tasks.taskType,
      priority: tasks.priority,
      parentTaskId: tasks.parentTaskId,
      subtaskTotal: sql<number>`coalesce(${subtaskSummary.total}, 0)`.mapWith(Number),
      subtaskCompleted: sql<number>`coalesce(${subtaskSummary.completed}, 0)`.mapWith(
        Number,
      ),
      status: tasks.status,
      previousStatus: tasks.previousStatus,
      scheduledDate: tasks.scheduledDate,
      scheduledTime: tasks.scheduledTime,
      scheduledTimeZone: tasks.scheduledTimeZone,
      completedAt: tasks.completedAt,
      archivedAt: tasks.archivedAt,
      version: tasks.version,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      projectTitle: projects.title,
      projectColorKey: projects.colorKey,
      projectIconKey: projects.iconKey,
      viewerRole: projectMemberships.role,
    })
    .from(tasks)
    .innerJoin(creator, eq(tasks.createdBy, creator.id))
    .leftJoin(assignee, eq(tasks.assigneeId, assignee.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(subtaskSummary, eq(subtaskSummary.parentTaskId, tasks.id))
    .leftJoin(
      projectMemberships,
      viewerUserId
        ? and(
            eq(projectMemberships.projectId, tasks.projectId),
            eq(projectMemberships.userId, viewerUserId),
          )
        : sql`false`,
    )
    .where(eq(tasks.id, taskId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const avatarUrls = await createProfileAssetUrlMap([
    row.createdByAvatarPath,
    row.assigneeAvatarPath,
  ]);
  return toTaskDto(row, avatarUrls, viewerUserId);
}

/**
 * Purpose: Insert a task.
 * Inputs: Validated task fields and creator ID.
 * Output: Created task DTO.
 * Side effects: Writes tasks.
 */
export async function insertTask(
  input: {
    createdBy: string;
    projectId: string | null;
    assigneeId: string | null;
    title: string;
    description?: string | null;
    iconKey?: ProjectIconKey | null;
    taskType?: TaskType;
    priority?: TaskPriority;
    parentTaskId?: string | null;
    scheduledDate: string;
    scheduledTime?: string | null;
    scheduledTimeZone: string;
  },
  db: DbExecutor = getDb(),
): Promise<TaskDto> {
  const [created] = await db
    .insert(tasks)
    .values({
      projectId: input.projectId,
      createdBy: input.createdBy,
      assigneeId: input.assigneeId,
      title: input.title,
      description: input.description ?? null,
      iconKey: input.iconKey ?? null,
      taskType: input.taskType ?? "TASK",
      priority: input.priority ?? "NONE",
      parentTaskId: input.parentTaskId ?? null,
      status: "TODO",
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime ?? null,
      scheduledTimeZone: input.scheduledTimeZone,
    })
    .returning({ id: tasks.id });
  const dto = created ? await findTaskDto(created.id, input.createdBy, db) : null;
  if (!dto) throw new Error("Task insert failed.");
  return dto;
}

/**
 * Purpose: Update task fields with optimistic concurrency.
 * Inputs: Task ID, expected version, and mutable fields.
 * Output: Updated task DTO or null when version mismatches.
 * Side effects: Writes task and increments version.
 */
export async function updateTaskRow(
  taskId: string,
  version: number,
  values: Partial<{
    projectId: string | null;
    assigneeId: string | null;
    title: string;
    description: string | null;
    iconKey: ProjectIconKey | null;
    taskType: TaskType;
    priority: TaskPriority;
    status: TaskStatus;
    previousStatus: Exclude<TaskStatus, "DONE"> | null;
    scheduledDate: string;
    scheduledTime: string | null;
    scheduledTimeZone: string;
    completedAt: Date | null;
    archivedAt: Date | null;
  }>,
  viewerUserId: string,
  db: DbExecutor = getDb(),
): Promise<TaskDto | null> {
  const [updated] = await db
    .update(tasks)
    .set({ ...values, version: version + 1, updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.version, version)))
    .returning({ id: tasks.id });
  return updated ? findTaskDto(updated.id, viewerUserId, db) : null;
}

/**
 * Purpose: Restore an archived task with an archive-state and optimistic-version guard.
 * Inputs: Task identity, expected version, viewer identity, and optional transaction executor.
 * Output: Restored task DTO or null when the row is stale or no longer archived.
 * Side effects: Clears archived_at and increments the task version.
 */
export async function restoreTaskRow(
  taskId: string,
  version: number,
  viewerUserId: string,
  db: DbExecutor = getDb(),
): Promise<TaskDto | null> {
  const [updated] = await db
    .update(tasks)
    .set({ archivedAt: null, version: version + 1, updatedAt: new Date() })
    .where(
      and(eq(tasks.id, taskId), eq(tasks.version, version), isNotNull(tasks.archivedAt)),
    )
    .returning({ id: tasks.id });
  return updated ? findTaskDto(updated.id, viewerUserId, db) : null;
}

/**
 * Purpose: Build one aggregate of active child counts for bounded task DTO queries.
 * Inputs: Database executor and a query-unique alias.
 * Output: Joinable parent/count subquery.
 * Side effects: None until consumed by a query.
 */
export function createSubtaskSummary(db: DbExecutor, aliasName: string) {
  const children = alias(tasks, `${aliasName}_tasks`);
  return db
    .select({
      parentTaskId: children.parentTaskId,
      total: sql<number>`count(*)::int`.as("total"),
      completed: sql<number>`count(*) filter (where ${children.status} = 'DONE')::int`.as(
        "completed",
      ),
    })
    .from(children)
    .where(and(isNotNull(children.parentTaskId), isNull(children.archivedAt)))
    .groupBy(children.parentTaskId)
    .as(aliasName);
}

/**
 * Purpose: Return active Story-child completion counts.
 * Inputs: Story ID and optional transaction executor.
 * Output: Active total and completed counts.
 * Side effects: Reads child task rows.
 */
export async function getSubtaskProgress(
  parentTaskId: string,
  db: DbExecutor = getDb(),
): Promise<{ total: number; completed: number }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`.mapWith(Number),
      completed:
        sql<number>`count(*) filter (where ${tasks.status} = 'DONE')::int`.mapWith(
          Number,
        ),
    })
    .from(tasks)
    .where(and(eq(tasks.parentTaskId, parentTaskId), isNull(tasks.archivedAt)));
  return row ?? { total: 0, completed: 0 };
}

/**
 * Purpose: Detect any persisted children before changing a Story's structural type.
 * Inputs: Story ID and optional transaction executor.
 * Output: True when active or archived children exist.
 * Side effects: Reads at most one child row.
 */
export async function hasAnySubtasks(
  parentTaskId: string,
  db: DbExecutor = getDb(),
): Promise<boolean> {
  const [row] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.parentTaskId, parentTaskId))
    .limit(1);
  return Boolean(row);
}

export type StoryRollupTransition = "completed" | "reopened" | null;

/**
 * Purpose: Recalculate a Story's derived status while holding its row lock.
 * Inputs: Story ID, viewer identity for DTO permissions, and transaction executor.
 * Output: Updated/current Story plus the automatic transition kind.
 * Side effects: May update Story status, completion timestamp, and version.
 */
export async function rollUpStoryStatus(
  storyId: string,
  viewerUserId: string,
  db: DbExecutor = getDb(),
): Promise<{ story: TaskDto | null; transition: StoryRollupTransition }> {
  const [story] = await db
    .select({ id: tasks.id, taskType: tasks.taskType, status: tasks.status })
    .from(tasks)
    .where(eq(tasks.id, storyId))
    .limit(1)
    .for("update");
  if (!story || story.taskType !== "STORY") return { story: null, transition: null };

  const progress = await getSubtaskProgress(storyId, db);
  if (progress.total === 0) {
    return { story: await findTaskDto(storyId, viewerUserId, db), transition: null };
  }
  const shouldComplete = progress.completed === progress.total;
  const transition: StoryRollupTransition = shouldComplete
    ? story.status === "DONE"
      ? null
      : "completed"
    : story.status === "DONE"
      ? "reopened"
      : null;
  if (!transition) {
    return { story: await findTaskDto(storyId, viewerUserId, db), transition: null };
  }

  await db
    .update(tasks)
    .set(
      transition === "completed"
        ? {
            status: "DONE",
            previousStatus: story.status as Exclude<TaskStatus, "DONE">,
            completedAt: new Date(),
            version: sql`${tasks.version} + 1`,
            updatedAt: new Date(),
          }
        : {
            status: "IN_PROGRESS",
            previousStatus: null,
            completedAt: null,
            version: sql`${tasks.version} + 1`,
            updatedAt: new Date(),
          },
    )
    .where(eq(tasks.id, storyId));
  return {
    story: await findTaskDto(storyId, viewerUserId, db),
    transition,
  };
}

/**
 * Purpose: List active one-level children for an authorized Story.
 * Inputs: Story ID, viewer identity, and optional transaction executor.
 * Output: Ordered Subtask DTOs.
 * Side effects: Reads child task and profile/project joins.
 */
export async function listSubtasks(
  parentTaskId: string,
  viewerUserId: string,
  db: DbExecutor = getDb(),
): Promise<TaskDto[]> {
  const creator = alias(profiles, "subtask_creator_profiles");
  const assignee = alias(profiles, "subtask_assignee_profiles");
  const rows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      createdById: tasks.createdBy,
      createdByHandle: creator.handle,
      createdByDisplayName: creator.displayName,
      createdByAvatarPath: creator.avatarPath,
      assigneeId: tasks.assigneeId,
      assigneeHandle: assignee.handle,
      assigneeDisplayName: assignee.displayName,
      assigneeAvatarPath: assignee.avatarPath,
      title: tasks.title,
      description: tasks.description,
      iconKey: tasks.iconKey,
      taskType: tasks.taskType,
      priority: tasks.priority,
      parentTaskId: tasks.parentTaskId,
      subtaskTotal: sql<number>`0`.mapWith(Number),
      subtaskCompleted: sql<number>`0`.mapWith(Number),
      status: tasks.status,
      previousStatus: tasks.previousStatus,
      scheduledDate: tasks.scheduledDate,
      scheduledTime: tasks.scheduledTime,
      scheduledTimeZone: tasks.scheduledTimeZone,
      completedAt: tasks.completedAt,
      archivedAt: tasks.archivedAt,
      version: tasks.version,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      projectTitle: projects.title,
      projectColorKey: projects.colorKey,
      projectIconKey: projects.iconKey,
      viewerRole: projectMemberships.role,
    })
    .from(tasks)
    .innerJoin(creator, eq(tasks.createdBy, creator.id))
    .leftJoin(assignee, eq(tasks.assigneeId, assignee.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(
      projectMemberships,
      and(
        eq(projectMemberships.projectId, tasks.projectId),
        eq(projectMemberships.userId, viewerUserId),
      ),
    )
    .where(and(eq(tasks.parentTaskId, parentTaskId), isNull(tasks.archivedAt)))
    .orderBy(asc(tasks.scheduledDate), asc(tasks.scheduledTime), asc(tasks.createdAt));
  const avatarUrls = await createProfileAssetUrlMap(
    rows.flatMap((row) => [row.createdByAvatarPath, row.assigneeAvatarPath]),
  );
  return rows.map((row) => toTaskDto(row, avatarUrls, viewerUserId));
}

/**
 * Purpose: Read a task's activity timeline.
 * Inputs: Task ID.
 * Output: Activity rows for a task.
 * Side effects: Reads activity_events.
 */
export async function listTaskActivity(taskId: string): Promise<TaskActivityDto[]> {
  const rows = await getDb()
    .select({
      id: activityEvents.id,
      actorId: activityEvents.actorId,
      actorHandle: profiles.handle,
      actorDisplayName: profiles.displayName,
      actorAvatarPath: profiles.avatarPath,
      eventType: activityEvents.eventType,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .leftJoin(profiles, eq(activityEvents.actorId, profiles.id))
    .where(eq(activityEvents.taskId, taskId))
    .orderBy(desc(activityEvents.createdAt));
  const avatarUrls = await createProfileAssetUrlMap(
    rows.map((row) => row.actorAvatarPath),
  );
  return rows.map((row) => ({
    id: row.id,
    actor: row.actorId
      ? {
          id: row.actorId,
          handle: row.actorHandle ?? "unknown",
          displayName: row.actorDisplayName ?? "Unknown user",
          avatarUrl: profileAssetUrl(row.actorAvatarPath, avatarUrls),
        }
      : null,
    eventType: row.eventType as TaskActivityDto["eventType"],
    label: humanizeActivity(row.eventType as Parameters<typeof humanizeActivity>[0]),
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Purpose: Read completion counts by day for heatmaps.
 * Inputs: User ID and date range.
 * Output: Date/count pairs.
 * Side effects: Reads tasks.
 */
export async function listCompletionCounts(input: {
  userId: string;
  from: string;
  to: string;
  timeZone: string;
}) {
  const rangeStart = new Date(`${input.from}T00:00:00.000Z`);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
  const rangeEnd = new Date(`${input.to}T23:59:59.999Z`);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
  const rows = await getDb()
    .select({
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.assigneeId, input.userId),
        eq(tasks.status, "DONE"),
        isNotNull(tasks.completedAt),
        gte(tasks.completedAt, rangeStart),
        lte(tasks.completedAt, rangeEnd),
        isNull(tasks.archivedAt),
        isNull(tasks.parentTaskId),
      ),
    );
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.completedAt) continue;
    const date = getDateInTimeZone(row.completedAt, input.timeZone);
    if (date < input.from || date > input.to) continue;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return Array.from(counts, ([date, count]) => ({ date, count }));
}

/**
 * Purpose: Read dashboard task rows for date range aggregation.
 * Inputs: User ID and date bounds.
 * Output: Task DTOs.
 * Side effects: Reads week tasks.
 */
export async function listDashboardTasks(input: {
  userId: string;
  from?: string;
  to: string;
  incompleteOnly?: boolean;
}) {
  return listWeekTasks(input);
}
