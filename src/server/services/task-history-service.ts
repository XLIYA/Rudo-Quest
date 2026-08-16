import { AppError } from "@/lib/api/errors";
import { runDbTransaction } from "@/lib/db/client";
import { getDateInTimeZone } from "@/lib/utils/dates";
import { createActivityEvent } from "@/server/repositories/activity-repository";
import {
  listTaskHistory,
  listProjectArchivedTasks,
} from "@/server/repositories/task-history-repository";
import { findProfileById } from "@/server/repositories/profile-repository";
import { findProjectAccess } from "@/server/repositories/project-repository";
import { restoreTaskRow, rollUpStoryStatus } from "@/server/repositories/task-repository";
import { getVisibleTask } from "@/server/services/task-service";
import type {
  TaskHistoryPageDto,
  TaskHistoryView,
  TaskDto,
  ArchivedTaskFilters,
} from "@/types/domain";

/**
 * Purpose: Resolve the viewer-local missed cutoff and read one task-history page.
 * Inputs: Viewer identity and validated history options.
 * Output: Cursor-paginated visible task history.
 * Side effects: Reads profile and task data.
 */
export async function getTaskHistory(
  userId: string,
  input: { view: TaskHistoryView; cursor?: string },
): Promise<TaskHistoryPageDto> {
  const profile = await findProfileById(userId);
  if (!profile) throw new AppError("NOT_FOUND", 404, "Profile not found.");
  return listTaskHistory({
    userId,
    view: input.view,
    todayDate: getDateInTimeZone(new Date(), profile.timeZone),
    cursor: input.cursor,
  });
}

/**
 * Purpose: Fetch archived tasks for a specific project with search and filters.
 * Inputs: User ID, project ID, search term, filters, and pagination cursor.
 * Output: Cursor-paginated archived task DTOs.
 * Side effects: Reads task and membership data.
 */
export async function getProjectArchivedTasks(
  userId: string,
  projectId: string,
  input: {
    search?: string;
    filters?: ArchivedTaskFilters;
    cursor?: string;
    limit?: number;
  },
): Promise<TaskHistoryPageDto> {
  const access = await findProjectAccess(projectId, userId);
  if (!access) throw new AppError("NOT_FOUND", 404, "Project not found.");
  if (access.archivedAt)
    throw new AppError("CONFLICT", 409, "Archived projects are read-only.");

  return listProjectArchivedTasks({
    userId,
    projectId,
    search: input.search,
    filters: input.filters,
    cursor: input.cursor,
    limit: input.limit,
  });
}

/**
 * Purpose: Restore an archived task under visibility, permission, project, and version guards.
 * Inputs: Actor, task identity, and expected optimistic version.
 * Output: Restored task DTO.
 * Side effects: Updates task and records TASK_RESTORED atomically.
 */
export async function restoreTask(
  userId: string,
  taskId: string,
  version: number,
): Promise<TaskDto> {
  const task = await getVisibleTask(userId, taskId);
  if (!task.archivedAt) {
    throw new AppError("CONFLICT", 409, "Task is no longer archived.");
  }
  if (!task.permissions.canArchive) {
    throw new AppError("FORBIDDEN", 403, "Cannot restore task.");
  }
  if (task.projectId) {
    const access = await findProjectAccess(task.projectId, userId);
    if (!access) throw new AppError("NOT_FOUND", 404, "Task not found.");
    if (access.archivedAt) {
      throw new AppError(
        "CONFLICT",
        409,
        "Restore the project before restoring this task.",
      );
    }
  }
  if (task.parentTaskId) {
    const story = await getVisibleTask(userId, task.parentTaskId);
    if (story.archivedAt) {
      throw new AppError(
        "CONFLICT",
        409,
        "Restore the Story before restoring this Subtask.",
      );
    }
  }

  return runDbTransaction(async (tx) => {
    const restored = await restoreTaskRow(taskId, version, userId, tx);
    if (!restored) {
      throw new AppError("CONFLICT", 409, "Task changed on another device.");
    }
    await createActivityEvent(
      {
        actorId: userId,
        projectId: restored.projectId,
        taskId,
        eventType: "TASK_RESTORED",
      },
      tx,
    );
    if (restored.parentTaskId) {
      const rollup = await rollUpStoryStatus(restored.parentTaskId, userId, tx);
      if (rollup.story && rollup.transition) {
        await createActivityEvent(
          {
            actorId: userId,
            projectId: rollup.story.projectId,
            taskId: rollup.story.id,
            eventType:
              rollup.transition === "completed" ? "TASK_COMPLETED" : "TASK_REOPENED",
          },
          tx,
        );
      }
    }
    return restored;
  });
}
