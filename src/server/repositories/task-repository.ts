import { and, asc, desc, eq, gte, isNull, isNotNull, lte, or, sql } from "drizzle-orm";
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
import type {
  ProjectColorKey,
  ProjectIconKey,
  TaskDto,
  TaskStatus,
} from "@/types/domain";

/**
 * Purpose: Map a task query row into the public task DTO.
 * Inputs: Joined task row from repository selects.
 * Output: TaskDto with ISO date strings.
 * Side effects: None.
 */
function toTaskDto(
  row: {
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
  },
  avatarUrls: Map<string, string>,
  viewerUserId?: string,
): TaskDto {
  const canEditDetails = row.projectId
    ? row.viewerRole === "OWNER" || row.viewerRole === "ADMIN"
    : row.createdById === viewerUserId;
  const canTransition = row.projectId
    ? canEditDetails || (row.viewerRole === "MEMBER" && row.assigneeId === viewerUserId)
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
  from: string;
  to: string;
  projectId?: string;
}): Promise<TaskDto[]> {
  const creator = alias(profiles, "creator_profiles");
  const assignee = alias(profiles, "assignee_profiles");
  const rows = await getDb()
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
        eq(projectMemberships.userId, input.userId),
      ),
    )
    .where(
      and(
        gte(tasks.scheduledDate, input.from),
        lte(tasks.scheduledDate, input.to),
        input.projectId ? eq(tasks.projectId, input.projectId) : undefined,
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
 * Purpose: Read a task's activity timeline.
 * Inputs: Task ID.
 * Output: Activity rows for a task.
 * Side effects: Reads activity_events.
 */
export async function listTaskActivity(taskId: string) {
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
  const { humanizeActivity } = await import("@/server/repositories/activity-repository");
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
    eventType: row.eventType,
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
}) {
  const rows = await getDb()
    .select({
      scheduledDate: tasks.scheduledDate,
      id: tasks.id,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.assigneeId, input.userId),
        eq(tasks.status, "DONE"),
        gte(tasks.scheduledDate, input.from),
        lte(tasks.scheduledDate, input.to),
        isNull(tasks.archivedAt),
      ),
    );
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.scheduledDate, (counts.get(row.scheduledDate) ?? 0) + 1);
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
  from: string;
  to: string;
}) {
  return listWeekTasks(input);
}
