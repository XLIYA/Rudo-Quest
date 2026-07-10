import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { activityEvents, profiles, projects, projectMemberships, tasks } from "@/db/schema";
import { getDb } from "@/lib/db/client";
import { createProfileAssetUrlMap, profileAssetUrl } from "@/server/profile-assets";
import type { ProjectColorKey, ProjectIconKey, TaskDto, TaskStatus } from "@/types/domain";

/**
 * Purpose: Map a task query row into the public task DTO.
 * Inputs: Joined task row from repository selects.
 * Output: TaskDto with ISO date strings.
 * Side effects: None.
 */
function toTaskDto(row: {
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
}, avatarUrls: Map<string, string>): TaskDto {
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
      and(eq(projectMemberships.projectId, tasks.projectId), eq(projectMemberships.userId, input.userId)),
    )
    .where(
      and(
        gte(tasks.scheduledDate, input.from),
        lte(tasks.scheduledDate, input.to),
        isNull(tasks.archivedAt),
      ),
    )
    .orderBy(asc(tasks.scheduledDate), asc(tasks.scheduledTime), asc(tasks.createdAt));
  const avatarUrls = await createProfileAssetUrlMap(
    rows.flatMap((row) => [row.createdByAvatarPath, row.assigneeAvatarPath]),
  );
  return rows
    .filter(
      (row) =>
        (row.projectId === null && (row.assigneeId === input.userId || row.createdById === input.userId)) ||
        (row.projectId !== null && row.viewerRole !== null),
    )
    .map((row) => toTaskDto(row, avatarUrls));
}

/**
 * Purpose: Read one task DTO by ID.
 * Inputs: Task ID.
 * Output: Task DTO or null.
 * Side effects: Reads task joins.
 */
export async function findTaskDto(taskId: string): Promise<TaskDto | null> {
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
    })
    .from(tasks)
    .innerJoin(creator, eq(tasks.createdBy, creator.id))
    .leftJoin(assignee, eq(tasks.assigneeId, assignee.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const avatarUrls = await createProfileAssetUrlMap([row.createdByAvatarPath, row.assigneeAvatarPath]);
  return toTaskDto(row, avatarUrls);
}

/**
 * Purpose: Insert a task.
 * Inputs: Validated task fields and creator ID.
 * Output: Created task DTO.
 * Side effects: Writes tasks.
 */
export async function insertTask(input: {
  createdBy: string;
  projectId: string | null;
  assigneeId: string | null;
  title: string;
  description?: string | null;
  iconKey?: ProjectIconKey | null;
  scheduledDate: string;
  scheduledTime?: string | null;
  scheduledTimeZone: string;
}): Promise<TaskDto> {
  const [created] = await getDb()
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
  const dto = created ? await findTaskDto(created.id) : null;
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
): Promise<TaskDto | null> {
  const [updated] = await getDb()
    .update(tasks)
    .set({ ...values, version: version + 1, updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.version, version)))
    .returning({ id: tasks.id });
  return updated ? findTaskDto(updated.id) : null;
}

/**
 * Purpose: Read a task's activity timeline.
 * Inputs: Task ID.
 * Output: Activity rows for a task.
 * Side effects: Reads activity_events.
 */
export async function listTaskActivity(taskId: string) {
  return getDb()
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.taskId, taskId))
    .orderBy(desc(activityEvents.createdAt));
}

/**
 * Purpose: Read completion counts by day for heatmaps.
 * Inputs: User ID and date range.
 * Output: Date/count pairs.
 * Side effects: Reads tasks.
 */
export async function listCompletionCounts(input: { userId: string; from: string; to: string }) {
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
  for (const row of rows) counts.set(row.scheduledDate, (counts.get(row.scheduledDate) ?? 0) + 1);
  return Array.from(counts, ([date, count]) => ({ date, count }));
}

/**
 * Purpose: Read dashboard task rows for date range aggregation.
 * Inputs: User ID and date bounds.
 * Output: Task DTOs.
 * Side effects: Reads week tasks.
 */
export async function listDashboardTasks(input: { userId: string; from: string; to: string }) {
  return listWeekTasks(input);
}
