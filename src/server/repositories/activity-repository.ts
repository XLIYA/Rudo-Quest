import { desc, eq, lt, or } from "drizzle-orm";
import { activityEvents, profiles } from "@/db/schema";
import { getDb } from "@/lib/db/client";
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
  limit?: number;
}): Promise<{ items: ActivityEventDto[]; cursor?: string }> {
  const limit = input.limit ?? 30;
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
    })
    .from(activityEvents)
    .leftJoin(profiles, eq(activityEvents.actorId, profiles.id))
    .where(
      input.cursor
        ? lt(activityEvents.createdAt, new Date(input.cursor))
        : or(eq(activityEvents.actorId, input.userId), eq(activityEvents.actorId, input.userId)),
    )
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit + 1);
  const items = rows.slice(0, limit).map((row) => ({
    id: row.id,
    actor: row.actorId
      ? {
          id: row.actorId,
          handle: row.actorHandle ?? "unknown",
          displayName: row.actorDisplayName ?? "Unknown user",
          avatarUrl: row.actorAvatarPath,
        }
      : null,
    projectId: row.projectId,
    taskId: row.taskId,
    eventType: row.eventType as ActivityEventType,
    label: humanizeActivity(row.eventType as ActivityEventType),
    createdAt: row.createdAt.toISOString(),
  }));
  const next = rows.length > limit ? rows[limit]?.createdAt.toISOString() : undefined;
  return next ? { items, cursor: next } : { items };
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
