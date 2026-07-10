import { addDays } from "date-fns";
import { AppError } from "@/lib/api/errors";
import { getWeekDates } from "@/lib/utils/dates";
import type { TaskDto } from "@/types/domain";
import { assertCanMutateTask, toggleCompletionState } from "@/server/policies/project-policy";
import { createActivityEvent } from "@/server/repositories/activity-repository";
import { findProjectRole, isProjectMember } from "@/server/repositories/project-repository";
import {
  findTaskDto,
  insertTask,
  listTaskActivity,
  listWeekTasks,
  updateTaskRow,
} from "@/server/repositories/task-repository";
import { createNotification } from "@/server/services/notification-service";

/**
 * Purpose: Validate visibility and return a task.
 * Inputs: Actor ID and task ID.
 * Output: Task DTO.
 * Side effects: Reads task and membership.
 */
export async function getTask(userId: string, taskId: string): Promise<TaskDto> {
  const task = await findTaskDto(taskId);
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
export async function getWeekTasks(userId: string, weekStart: string): Promise<TaskDto[]> {
  const dates = getWeekDates(weekStart);
  return listWeekTasks({ userId, from: dates[0] ?? weekStart, to: dates[6] ?? weekStart });
}

/**
 * Purpose: Create a personal or project task.
 * Inputs: Actor ID and validated task payload.
 * Output: Created task DTO.
 * Side effects: Writes task, activity, and assignment notification.
 */
export async function createTask(
  userId: string,
  payload: Omit<Parameters<typeof insertTask>[0], "createdBy">,
): Promise<TaskDto> {
  const assigneeId = payload.projectId ? payload.assigneeId : userId;
  if (payload.projectId) {
    const role = await findProjectRole(payload.projectId, userId);
    if (role === "VIEWER" || !role) throw new AppError("FORBIDDEN", 403, "Cannot create task.");
    if (assigneeId && !(await isProjectMember(payload.projectId, assigneeId))) {
      throw new AppError("BAD_REQUEST", 400, "Assignee must be a project member.");
    }
  }
  const task = await insertTask({ ...payload, createdBy: userId, assigneeId });
  await createActivityEvent({
    actorId: userId,
    projectId: task.projectId,
    taskId: task.id,
    eventType: "TASK_CREATED",
    metadata: { title: task.title },
  });
  if (task.assignee && task.assignee.id !== userId) {
    await createNotification({
      recipientId: task.assignee.id,
      type: "TASK_ASSIGNED",
      title: "Task assigned",
      body: task.title,
      href: `/weekly?date=${task.scheduledDate}&task=${task.id}`,
    });
  }
  return task;
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
  payload: Partial<Omit<Parameters<typeof updateTaskRow>[2], "completedAt" | "archivedAt">> & {
    version: number;
  },
): Promise<TaskDto> {
  const task = await getTask(userId, taskId);
  await assertCanEditTask(userId, task, true);
  if (payload.projectId === null && task.projectId !== null) {
    payload.assigneeId = userId;
  }
  const targetProjectId = payload.projectId === undefined ? task.projectId : payload.projectId;
  const targetAssignee = payload.assigneeId === undefined ? task.assignee?.id ?? null : payload.assigneeId;
  if (targetProjectId && targetProjectId !== task.projectId) {
    const targetRole = await findProjectRole(targetProjectId, userId);
    if (targetRole === "VIEWER" || !targetRole) {
      throw new AppError("FORBIDDEN", 403, "Cannot move task into this project.");
    }
  }
  if (targetProjectId && targetAssignee && !(await isProjectMember(targetProjectId, targetAssignee))) {
    throw new AppError("BAD_REQUEST", 400, "Assignee must be a project member.");
  }
  if (!targetProjectId && targetAssignee !== userId) {
    throw new AppError("BAD_REQUEST", 400, "Personal tasks cannot be reassigned.");
  }
  const updated = await updateTaskRow(taskId, payload.version, payload);
  if (!updated) throw new AppError("CONFLICT", 409, "Task changed on another device.");
  const eventType = task.assignee?.id !== updated.assignee?.id ? "TASK_ASSIGNED" : "TASK_UPDATED";
  await createActivityEvent({ actorId: userId, projectId: updated.projectId, taskId, eventType });
  if (eventType === "TASK_ASSIGNED" && updated.assignee && updated.assignee.id !== userId) {
    await createNotification({
      recipientId: updated.assignee.id,
      type: "TASK_ASSIGNED",
      title: "Task assigned",
      body: updated.title,
      href: `/weekly?date=${updated.scheduledDate}&task=${updated.id}`,
    });
  }
  return updated;
}

/**
 * Purpose: Transition a task to IN_PROGRESS.
 * Inputs: Actor ID, task ID, expected version.
 * Output: Updated task DTO.
 * Side effects: Writes task state and activity.
 */
export async function startTask(userId: string, taskId: string, version: number): Promise<TaskDto> {
  const task = await getTask(userId, taskId);
  await assertCanEditTask(userId, task, false);
  if (task.status !== "TODO") return task;
  const updated = await updateTaskRow(taskId, version, { status: "IN_PROGRESS", previousStatus: null });
  if (!updated) throw new AppError("CONFLICT", 409, "Task changed on another device.");
  await createActivityEvent({ actorId: userId, projectId: updated.projectId, taskId, eventType: "TASK_STARTED" });
  return updated;
}

/**
 * Purpose: Complete a task from TODO or IN_PROGRESS.
 * Inputs: Actor ID, task ID, expected version.
 * Output: Updated task DTO.
 * Side effects: Writes task completion timestamp and activity.
 */
export async function completeTask(userId: string, taskId: string, version: number): Promise<TaskDto> {
  const task = await getTask(userId, taskId);
  await assertCanEditTask(userId, task, false);
  if (task.status === "DONE") return task;
  const updated = await updateTaskRow(taskId, version, {
    status: "DONE",
    previousStatus: task.status,
    completedAt: new Date(),
  });
  if (!updated) throw new AppError("CONFLICT", 409, "Task changed on another device.");
  await createActivityEvent({ actorId: userId, projectId: updated.projectId, taskId, eventType: "TASK_COMPLETED" });
  return updated;
}

/**
 * Purpose: Reopen a completed task to its previous non-done state.
 * Inputs: Actor ID, task ID, expected version.
 * Output: Updated task DTO.
 * Side effects: Writes task status and activity.
 */
export async function reopenTask(userId: string, taskId: string, version: number): Promise<TaskDto> {
  const task = await getTask(userId, taskId);
  await assertCanEditTask(userId, task, false);
  const next = toggleCompletionState(task.status, task.previousStatus, new Date());
  if (task.status !== "DONE") return task;
  const updated = await updateTaskRow(taskId, version, next);
  if (!updated) throw new AppError("CONFLICT", 409, "Task changed on another device.");
  await createActivityEvent({ actorId: userId, projectId: updated.projectId, taskId, eventType: "TASK_REOPENED" });
  return updated;
}

/**
 * Purpose: Soft-archive a task.
 * Inputs: Actor ID, task ID, expected version.
 * Output: Archived task DTO.
 * Side effects: Sets archived_at and writes activity.
 */
export async function archiveTask(userId: string, taskId: string, version: number): Promise<TaskDto> {
  const task = await getTask(userId, taskId);
  await assertCanEditTask(userId, task, true);
  const updated = await updateTaskRow(taskId, version, { archivedAt: new Date() });
  if (!updated) throw new AppError("CONFLICT", 409, "Task changed on another device.");
  await createActivityEvent({ actorId: userId, projectId: updated.projectId, taskId, eventType: "TASK_ARCHIVED" });
  return updated;
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
async function assertCanEditTask(userId: string, task: TaskDto, editAny: boolean): Promise<void> {
  if (!task.projectId) {
    if (task.createdBy.id !== userId) throw new AppError("FORBIDDEN", 403, "Cannot edit task.");
    return;
  }
  const role = await findProjectRole(task.projectId, userId);
  assertCanMutateTask(userId, role, task.assignee?.id ?? null, editAny);
}

/**
 * Purpose: Build a week range around a date for dashboard linking.
 * Inputs: ISO date.
 * Output: Seven-day range tuple.
 * Side effects: None.
 */
export function dashboardRangeFrom(date: string): { from: string; to: string } {
  return { from: date, to: addDays(new Date(`${date}T00:00:00.000Z`), 7).toISOString().slice(0, 10) };
}
