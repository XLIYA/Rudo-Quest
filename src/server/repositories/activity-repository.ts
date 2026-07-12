import { and, desc, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { AppError } from "@/lib/api/errors";
import { activityEvents, profiles, projectMemberships, tasks } from "@/db/schema";
import { getDb } from "@/lib/db/client";
import { createProfileAssetUrlMap, profileAssetUrl } from "@/server/profile-assets";
import type { ActivityEventDto, ActivityEventType } from "@/types/domain";

/**
 * Purpose: Persist a sanitized activity event.
 * Inputs: Actor, project/task scope, event type, and safe metadata.
 * Output: Created activity row.
 * Side effects: Writes activity_events.
 * Business rule: Callers must not include private task descriptions in metadata.
 */
export async function createActivityEvent(input: {
  actorId: string | null;
  projectId?: string | null;
  taskId?: string | null;
  eventType: ActivityEventType;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const [created] = await getDb()
    .insert(activityEvents)
    .values({
      actorId: input.actorId,
      projectId: input.projectId ?? null,
      taskId: input.taskId ?? null,
      eventType: input.eventType,
      metadata: input.metadata ?? {},
    })
    .returning();
  return created;
}

/**
 * Purpose: Read a user's accessible activity timeline.
 * Inputs: User ID and optional cursor timestamp.
 * Output: Activity DTOs and next cursor.
 * Side effects: Reads activity and profile rows.
 */
export async function listActivityForUser(input: {
  userId: string;
  cursor?: string;
  projectId?: string;
  limit?: number;
}): Promise<{ items: ActivityEventDto[]; cursor?: string }> {
  const limit = input.limit ?? 30;
  const cursor = input.cursor ? decodeActivityCursor(input.cursor) : null;
  const rows = await getDb()
    .select({
      id: activityEvents.id,
      actorId: activityEvents.actorId,
      actorHandle: profiles.handle,
      actorDisplayName: profiles.displayName,
      actorAvatarPath: profiles.avatarPath,
      projectId: activityEvents.projectId,
      taskId: activityEvents.taskId,
      eventType: activityEvents.eventType,
      createdAt: activityEvents.createdAt,
      viewerUserId: projectMemberships.userId,
      taskProjectId: tasks.projectId,
      taskCreatedBy: tasks.createdBy,
      taskAssigneeId: tasks.assigneeId,
    })
    .from(activityEvents)
    .leftJoin(profiles, eq(activityEvents.actorId, profiles.id))
    .leftJoin(
      projectMemberships,
      and(
        eq(projectMemberships.projectId, activityEvents.projectId),
        eq(projectMemberships.userId, input.userId),
      ),
    )
    .leftJoin(tasks, eq(activityEvents.taskId, tasks.id))
    .where(
      and(
        cursor
          ? or(
              lt(activityEvents.createdAt, cursor.createdAt),
              and(
                eq(activityEvents.createdAt, cursor.createdAt),
                lt(activityEvents.id, cursor.id),
              ),
            )
          : undefined,
        input.projectId ? eq(activityEvents.projectId, input.projectId) : undefined,
        or(
          isNotNull(projectMemberships.userId),
          and(isNull(activityEvents.projectId), eq(activityEvents.actorId, input.userId)),
          and(
            isNull(tasks.projectId),
            or(eq(tasks.createdBy, input.userId), eq(tasks.assigneeId, input.userId)),
          ),
        ),
      ),
    )
    .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
    .limit(limit + 1);
  const avatarUrls = await createProfileAssetUrlMap(
    rows.map((row) => row.actorAvatarPath),
  );
  const items = rows.slice(0, limit).map((row) => ({
    id: row.id,
    actor: row.actorId
      ? {
          id: row.actorId,
          handle: row.actorHandle ?? "unknown",
          displayName: row.actorDisplayName ?? "Unknown user",
          avatarUrl: profileAssetUrl(row.actorAvatarPath, avatarUrls),
        }
      : null,
    projectId: row.projectId,
    taskId: row.taskId,
    eventType: row.eventType as ActivityEventType,
    label: humanizeActivity(row.eventType as ActivityEventType),
    createdAt: row.createdAt.toISOString(),
  }));
  const nextRow = rows.length > limit ? rows[limit] : undefined;
  const next = nextRow ? encodeActivityCursor(nextRow.createdAt, nextRow.id) : undefined;
  return next ? { items, cursor: next } : { items };
}

function encodeActivityCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
    "utf8",
  ).toString("base64url");
}

function decodeActivityCursor(value: string): { createdAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: string;
      id?: string;
    };
    if (!parsed.createdAt || !parsed.id) throw new Error("missing cursor fields");
    const date = new Date(parsed.createdAt);
    if (Number.isNaN(date.getTime())) throw new Error("invalid cursor date");
    return { createdAt: date, id: parsed.id };
  } catch {
    throw new AppError("BAD_REQUEST", 400, "Activity cursor is invalid.");
  }
}

export function canViewActivityRow(
  userId: string,
  row: {
    actorId: string | null;
    projectId: string | null;
    viewerUserId: string | null;
    taskProjectId: string | null;
    taskCreatedBy: string | null;
    taskAssigneeId: string | null;
  },
): boolean {
  if (row.viewerUserId === userId) return true;
  if (!row.projectId && row.actorId === userId) return true;
  return (
    !row.taskProjectId && (row.taskCreatedBy === userId || row.taskAssigneeId === userId)
  );
}

/**
 * Purpose: Convert a stored activity type into user-facing copy.
 * Inputs: Activity event type.
 * Output: Human-readable label.
 * Side effects: None.
 */
export function humanizeActivity(type: ActivityEventType): string {
  const labels: Record<ActivityEventType, string> = {
    PROJECT_CREATED: "created a project",
    PROJECT_UPDATED: "updated a project",
    PROJECT_ARCHIVED: "archived a project",
    MEMBER_INVITED: "invited a member",
    MEMBER_JOINED: "joined a project",
    MEMBER_REMOVED: "removed a member",
    TASK_CREATED: "created a task",
    TASK_UPDATED: "updated a task",
    TASK_ASSIGNED: "assigned a task",
    TASK_STARTED: "started a task",
    TASK_COMPLETED: "completed a task",
    TASK_REOPENED: "reopened a task",
    TASK_ARCHIVED: "archived a task",
    GITHUB_CONNECTED: "connected GitHub",
    GITHUB_DISCONNECTED: "disconnected GitHub",
  };
  return labels[type];
}
