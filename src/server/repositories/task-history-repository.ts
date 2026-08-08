import { and, desc, eq, isNotNull, isNull, lt, ne, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { profiles, projects, projectMemberships, tasks } from "@/db/schema";
import { AppError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { uuidSchema } from "@/lib/validation/common";
import { createProfileAssetUrlMap } from "@/server/profile-assets";
import { toTaskDto, type TaskDtoRow } from "@/server/repositories/task-repository";
import type { TaskHistoryPageDto, TaskHistoryView } from "@/types/domain";

type TaskHistoryCursor = { sortValue: string; id: string };

/**
 * Purpose: Encode the last delivered history ordering tuple.
 * Inputs: View-specific sort value and task UUID.
 * Output: Opaque base64url cursor.
 * Side effects: None.
 */
export function encodeTaskHistoryCursor(sortValue: string, id: string): string {
  return Buffer.from(JSON.stringify({ sortValue, id }), "utf8").toString("base64url");
}

/**
 * Purpose: Decode and validate the structural shape of a task-history cursor.
 * Inputs: Opaque base64url cursor.
 * Output: Ordering tuple.
 * Side effects: None.
 * Failure behavior: Throws a typed 400 for malformed input.
 */
export function decodeTaskHistoryCursor(value: string): TaskHistoryCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      sortValue?: unknown;
      id?: unknown;
    };
    const id = uuidSchema.safeParse(parsed.id);
    if (
      !id.success ||
      typeof parsed.sortValue !== "string" ||
      !parsed.sortValue ||
      parsed.sortValue.length > 64
    ) {
      throw new Error("invalid cursor fields");
    }
    return { sortValue: parsed.sortValue, id: id.data };
  } catch {
    throw new AppError("BAD_REQUEST", 400, "Task history cursor is invalid.");
  }
}

/**
 * Purpose: Read one bounded page of missed or archived top-level tasks visible to a user.
 * Inputs: Viewer, view, authoritative local date, optional cursor, and bounded limit.
 * Output: Task DTO page with an opaque continuation cursor.
 * Side effects: Reads task, project, membership, and profile rows.
 */
export async function listTaskHistory(input: {
  userId: string;
  view: TaskHistoryView;
  todayDate: string;
  cursor?: string;
  limit?: number;
}): Promise<TaskHistoryPageDto> {
  const limit = Math.min(30, Math.max(1, input.limit ?? 30));
  const cursor = input.cursor ? decodeTaskHistoryCursor(input.cursor) : null;
  const creator = alias(profiles, "history_creator_profiles");
  const assignee = alias(profiles, "history_assignee_profiles");
  const cursorCondition = cursor ? historyCursorCondition(input.view, cursor) : undefined;
  const visibility = or(
    and(
      isNull(tasks.projectId),
      or(eq(tasks.createdBy, input.userId), eq(tasks.assigneeId, input.userId)),
    ),
    and(isNotNull(tasks.projectId), isNotNull(projectMemberships.userId)),
  );
  const viewCondition =
    input.view === "missed"
      ? and(
          isNull(tasks.archivedAt),
          ne(tasks.status, "DONE"),
          lt(tasks.scheduledDate, input.todayDate),
          or(isNull(tasks.projectId), isNull(projects.archivedAt)),
        )
      : isNotNull(tasks.archivedAt);

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
    .where(and(viewCondition, visibility, cursorCondition))
    .orderBy(
      input.view === "missed" ? desc(tasks.scheduledDate) : desc(tasks.archivedAt),
      desc(tasks.id),
    )
    .limit(limit + 1);

  const deliveredRows = rows.slice(0, limit);
  const avatarUrls = await createProfileAssetUrlMap(
    deliveredRows.flatMap((row) => [row.createdByAvatarPath, row.assigneeAvatarPath]),
  );
  const items = deliveredRows.map((row) =>
    toTaskDto(row as TaskDtoRow, avatarUrls, input.userId),
  );
  if (rows.length <= limit) return { items };

  const last = deliveredRows[deliveredRows.length - 1];
  if (!last) return { items };
  const sortValue =
    input.view === "missed" ? last.scheduledDate : last.archivedAt?.toISOString();
  return sortValue
    ? { items, cursor: encodeTaskHistoryCursor(sortValue, last.id) }
    : { items };
}

/**
 * Purpose: Build the strict tuple comparison for a view-specific history cursor.
 * Inputs: History view and decoded cursor.
 * Output: Drizzle SQL condition.
 * Side effects: None.
 * Failure behavior: Rejects sort values that do not match the selected view.
 */
function historyCursorCondition(view: TaskHistoryView, cursor: TaskHistoryCursor): SQL {
  if (view === "missed") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor.sortValue)) {
      throw new AppError("BAD_REQUEST", 400, "Task history cursor is invalid.");
    }
    return or(
      lt(tasks.scheduledDate, cursor.sortValue),
      and(eq(tasks.scheduledDate, cursor.sortValue), lt(tasks.id, cursor.id)),
    )!;
  }

  const archivedAt = new Date(cursor.sortValue);
  if (
    Number.isNaN(archivedAt.getTime()) ||
    archivedAt.toISOString() !== cursor.sortValue
  ) {
    throw new AppError("BAD_REQUEST", 400, "Task history cursor is invalid.");
  }
  return or(
    lt(tasks.archivedAt, archivedAt),
    and(eq(tasks.archivedAt, archivedAt), lt(tasks.id, cursor.id)),
  )!;
}
