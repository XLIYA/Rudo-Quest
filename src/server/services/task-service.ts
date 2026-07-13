import { AppError } from "@/lib/api/errors";
import { runDbTransaction } from "@/lib/db/client";
import { getWeekDates } from "@/lib/utils/dates";
import type { TaskDto } from "@/types/domain";
import {
  assertCanMutateTask,
  toggleCompletionState,
} from "@/server/policies/project-policy";
import { createActivityEvent } from "@/server/repositories/activity-repository";
import {
  findProjectRole,
  findProjectAccess,
  isProjectMember,
} from "@/server/repositories/project-repository";
import {
  findTaskDto,
  insertTask,
  listTaskActivity,
  listWeekTasks,
  updateTaskRow,
} from "@/server/repositories/task-repository";
import {
  createNotification,
  deliverPushBestEffort,
} from "@/server/services/notification-service";

/**
 * Purpose: Validate visibility and return a task.
 * Inputs: Actor ID and task ID.
 * Output: Task DTO.
 * Side effects: Reads task and membership.
 */
export async function getTask(userId: string, taskId: string): Promise<TaskDto> {
  const task = await findTaskDto(taskId, userId);
  if (!task || task.archivedAt) throw new AppError("NOT_FOUND", 404, "Task not found.");
  await assertCanViewTask(userId, task);
  return task;
}

/**
 * Purpose: List current user's weekly tasks Monday through Sunday.
 * Inputs: Actor ID and week start date.
 * Output: Task DTOs.
 * Side effects: Reads tasks.
 */
export async function getWeekTasks(
  userId: string,
  weekStart: string,
  projectId?: string,
): Promise<TaskDto[]> {
  const dates = getWeekDates(weekStart);
  return listWeekTasks({
    userId,
    from: dates[0] ?? weekStart,
    to: dates[6] ?? weekStart,
    projectId,
  });
}

/**
 * Purpose: Create a personal or project task.
 * Inputs: Actor ID and validated task payload.
 * Output: Created task DTO.
 * Side effects: Writes task, activity, and assignment notification.
 */
export async function createTask(
  userId: string,
  payload: Omit<Parameters<typeof insertTask>[0], "createdBy" | "assigneeId"> & {
    assigneeId?: string | null;
  },
): Promise<TaskDto> {
  const assigneeId = payload.projectId
    ? payload.assigneeId === undefined
      ? userId
      : payload.assigneeId
    : userId;
  if (payload.projectId) {
    const access = await findProjectAccess(payload.projectId, userId);
    if (access?.archivedAt)
      throw new AppError("CONFLICT", 409, "Archived projects are read-only.");
    if (access?.role === "VIEWER" || !access)
      throw new AppError("FORBIDDEN", 403, "Cannot create task.");
    if (assigneeId && !(await isProjectMember(payload.projectId, assigneeId))) {
      throw new AppError("BAD_REQUEST", 400, "Assignee must be a project member.");
    }
  }
  const result = await runDbTransaction(async (tx) => {
    const task = await insertTask({ ...payload, createdBy: userId, assigneeId }, tx);
    await createActivityEvent(
      {
        actorId: userId,
        projectId: task.projectId,
        taskId: task.id,
        eventType: "TASK_CREATED",
        metadata: { title: task.title },
      },
      tx,
    );
    const assignmentNotification =
      task.assignee && task.assignee.id !== userId
        ? await createNotification(
            {
              recipientId: task.assignee.id,
              type: "TASK_ASSIGNED",
              title: "Task assigned",
              body: task.title,
              href: `/weekly?date=${task.scheduledDate}&task=${task.id}`,
            },
            tx,
          )
        : null;
    return { task, assignmentNotification };
  });
  if (result.assignmentNotification && result.task.assignee) {
    await deliverPushBestEffort(result.assignmentNotification, result.task.assignee.id);
  }
  return result.task;
}

/**
 * Purpose: Update task fields under optimistic concurrency.
 * Inputs: Actor ID, task ID, expected version, and field changes.
 * Output: Updated task DTO.
 * Side effects: Writes task and activity; may send assignment notification.
 */
export async function updateTask(
  userId: string,
  taskId: string,
  payload: Partial<
    Omit<Parameters<typeof updateTaskRow>[2], "completedAt" | "archivedAt">
  > & {
    version: number;
  },
): Promise<TaskDto> {
  const task = await getTask(userId, taskId);
  const { version, ...changes } = payload;
  const changedKeys = Object.keys(changes);
  const assignmentOnly =
    changedKeys.length > 0 && changedKeys.every((key) => key === "assigneeId");
  await assertCanEditTask(userId, task, false, assignmentOnly);
  if (changes.projectId === null && task.projectId !== null) {
    if (task.createdBy.id !== userId) {
      throw new AppError(
        "FORBIDDEN",
        403,
        "Only the task creator can make this a personal task.",
      );
    }
    changes.assigneeId = userId;
  }
  const targetProjectId =
    changes.projectId === undefined ? task.projectId : changes.projectId;
  const targetAssignee =
    changes.assigneeId === undefined ? (task.assignee?.id ?? null) : changes.assigneeId;
  if (targetProjectId && targetProjectId !== task.projectId) {
    const targetAccess = await findProjectAccess(targetProjectId, userId);
    if (targetAccess?.archivedAt) {
      throw new AppError("CONFLICT", 409, "Archived projects are read-only.");
    }
    if (targetAccess?.role === "VIEWER" || !targetAccess) {
      throw new AppError("FORBIDDEN", 403, "Cannot move task into this project.");
    }
  }
  if (
    targetProjectId &&
    targetAssignee &&
    !(await isProjectMember(targetProjectId, targetAssignee))
  ) {
    throw new AppError("BAD_REQUEST", 400, "Assignee must be a project member.");
  }
  if (!targetProjectId && targetAssignee !== userId) {
    throw new AppError("BAD_REQUEST", 400, "Personal tasks cannot be reassigned.");
  }
  const result = await runDbTransaction(async (tx) => {
    const updated = await updateTaskRow(taskId, version, changes, userId, tx);
    if (!updated) throw new AppError("CONFLICT", 409, "Task changed on another device.");
    const eventType =
      task.assignee?.id !== updated.assignee?.id ? "TASK_ASSIGNED" : "TASK_UPDATED";
    await createActivityEvent(
      { actorId: userId, projectId: updated.projectId, taskId, eventType },
      tx,
    );
    const assignmentNotification =
      eventType === "TASK_ASSIGNED" && updated.assignee && updated.assignee.id !== userId
        ? await createNotification(
            {
              recipientId: updated.assignee.id,
              type: "TASK_ASSIGNED",
              title: "Task assigned",
              body: updated.title,
              href: `/weekly?date=${updated.scheduledDate}&task=${updated.id}`,
            },
            tx,
          )
        : null;
    return { updated, assignmentNotification };
  });
  if (result.assignmentNotification && result.updated.assignee) {
    await deliverPushBestEffort(
      result.assignmentNotification,
      result.updated.assignee.id,
    );
  }
  return result.updated;
}

/**
 * Purpose: Transition a task to IN_PROGRESS.
 * Inputs: Actor ID, task ID, expected version.
 * Output: Updated task DTO.
 * Side effects: Writes task state and activity.
 */
export async function startTask(
  userId: string,
  taskId: string,
  version: number,
): Promise<TaskDto> {
  const task = await getTask(userId, taskId);
  await assertCanEditTask(userId, task, false);
  assertTaskVersion(task, version);
  if (task.status !== "TODO") return task;
  return commitTaskTransition(
    userId,
    taskId,
    version,
    {
      status: "IN_PROGRESS",
      previousStatus: null,
    },
    "TASK_STARTED",
  );
}

/**
 * Purpose: Complete a task from TODO or IN_PROGRESS.
 * Inputs: Actor ID, task ID, expected version.
 * Output: Updated task DTO.
 * Side effects: Writes task completion timestamp and activity.
 */
export async function completeTask(
  userId: string,
  taskId: string,
  version: number,
): Promise<TaskDto> {
  const task = await getTask(userId, taskId);
  await assertCanEditTask(userId, task, false);
  assertTaskVersion(task, version);
  if (task.status === "DONE") return task;
  return commitTaskTransition(
    userId,
    taskId,
    version,
    {
      status: "DONE",
      previousStatus: task.status,
      completedAt: new Date(),
    },
    "TASK_COMPLETED",
  );
}

/**
 * Purpose: Reopen a completed task to its previous non-done state.
 * Inputs: Actor ID, task ID, expected version.
 * Output: Updated task DTO.
 * Side effects: Writes task status and activity.
 */
export async function reopenTask(
  userId: string,
  taskId: string,
  version: number,
): Promise<TaskDto> {
  const task = await getTask(userId, taskId);
  await assertCanEditTask(userId, task, false);
  assertTaskVersion(task, version);
  const next = toggleCompletionState(task.status, task.previousStatus, new Date());
  if (task.status !== "DONE") return task;
  return commitTaskTransition(userId, taskId, version, next, "TASK_REOPENED");
}

/**
 * Purpose: Soft-archive a task.
 * Inputs: Actor ID, task ID, expected version.
 * Output: Archived task DTO.
 * Side effects: Sets archived_at and writes activity.
 */
export async function archiveTask(
  userId: string,
  taskId: string,
  version: number,
): Promise<TaskDto> {
  const task = await getTask(userId, taskId);
  await assertCanEditTask(userId, task, false);
  return commitTaskTransition(
    userId,
    taskId,
    version,
    { archivedAt: new Date() },
    "TASK_ARCHIVED",
  );
}

/**
 * Purpose: Atomically commit a versioned task transition and its activity event.
 * Inputs: Actor, task, expected version, validated changes, and activity type.
 * Output: Updated task DTO.
 * Side effects: Updates the task and inserts activity in one transaction.
 * Failure behavior: Throws conflict when optimistic concurrency detects a stale version.
 */
async function commitTaskTransition(
  userId: string,
  taskId: string,
  version: number,
  changes: Parameters<typeof updateTaskRow>[2],
  eventType: Parameters<typeof createActivityEvent>[0]["eventType"],
): Promise<TaskDto> {
  return runDbTransaction(async (tx) => {
    const updated = await updateTaskRow(taskId, version, changes, userId, tx);
    if (!updated) throw new AppError("CONFLICT", 409, "Task changed on another device.");
    await createActivityEvent(
      { actorId: userId, projectId: updated.projectId, taskId, eventType },
      tx,
    );
    return updated;
  });
}

/**
 * Purpose: Reject stale task actions even when the requested transition is already applied.
 * Inputs: Current task DTO and client-expected version.
 * Output: Void for a current version.
 * Side effects: None.
 * Failure behavior: Throws CONFLICT so clients refetch instead of accepting a stale no-op.
 */
function assertTaskVersion(task: TaskDto, expectedVersion: number): void {
  if (task.version !== expectedVersion) {
    throw new AppError("CONFLICT", 409, "Task changed on another device.");
  }
}

/**
 * Purpose: Read a task's safe activity history.
 * Inputs: Actor ID and task ID.
 * Output: Activity rows.
 * Side effects: Reads task and activity.
 */
export async function getTaskActivity(userId: string, taskId: string) {
  await getTask(userId, taskId);
  return listTaskActivity(taskId);
}

/**
 * Purpose: Enforce task visibility.
 * Inputs: Actor ID and task DTO.
 * Output: Void when task is visible.
 * Side effects: Reads role for project tasks.
 */
async function assertCanViewTask(userId: string, task: TaskDto): Promise<void> {
  if (!task.projectId) {
    if (task.createdBy.id !== userId && task.assignee?.id !== userId) {
      throw new AppError("NOT_FOUND", 404, "Task not found.");
    }
    return;
  }
  const role = await findProjectRole(task.projectId, userId);
  if (!role) throw new AppError("NOT_FOUND", 404, "Task not found.");
}

/**
 * Purpose: Enforce task mutation permissions.
 * Inputs: Actor ID, task DTO, and whether broad edit permission is required.
 * Output: Void when mutation is permitted.
 * Side effects: Reads role for project tasks.
 */
async function assertCanEditTask(
  userId: string,
  task: TaskDto,
  editAny: boolean,
  allowMemberAssignment = false,
): Promise<void> {
  if (!task.projectId) {
    if (task.createdBy.id !== userId)
      throw new AppError("FORBIDDEN", 403, "Cannot edit task.");
    return;
  }
  const access = await findProjectAccess(task.projectId, userId);
  if (access?.archivedAt) {
    throw new AppError("CONFLICT", 409, "Archived projects are read-only.");
  }
  if (allowMemberAssignment && access?.role === "MEMBER") return;
  assertCanMutateTask(userId, access?.role ?? null, task.assignee?.id ?? null, editAny);
}
