import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { updateTaskSchema } from "@/lib/validation/tasks";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { archiveTask, getTask, updateTask } from "@/server/services/task-service";

type Context = { params: Promise<{ taskId: string }> };

/**
 * Purpose: Return one visible task.
 * Inputs: Task ID route parameter.
 * Output: Task DTO.
 * Side effects: Reads task and permissions.
 */
export async function GET(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    return apiSuccess(await getTask(user.id, uuidSchema.parse(taskId)), { requestId });
  });
}

/**
 * Purpose: Update task fields using optimistic concurrency.
 * Inputs: Task ID route parameter and versioned body.
 * Output: Updated task DTO.
 * Side effects: Writes task, activity, and optional notification.
 */
export async function PATCH(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    const body = updateTaskSchema.parse(await readJson(request));
    return apiSuccess(await updateTask(user.id, uuidSchema.parse(taskId), body), { requestId });
  });
}

/**
 * Purpose: Archive a task with optimistic concurrency.
 * Inputs: Task ID route parameter and version body.
 * Output: Archived task DTO.
 * Side effects: Sets archived_at and writes activity.
 */
export async function DELETE(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    const body = updateTaskSchema.pick({ version: true }).parse(await readJson(request));
    return apiSuccess(await archiveTask(user.id, uuidSchema.parse(taskId), body.version), { requestId });
  });
}
