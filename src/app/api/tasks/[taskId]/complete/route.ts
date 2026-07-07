import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { taskActionSchema } from "@/lib/validation/tasks";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { completeTask } from "@/server/services/task-service";

type Context = { params: Promise<{ taskId: string }> };

/**
 * Purpose: Complete a task.
 * Inputs: Task ID and expected version.
 * Output: Updated task DTO.
 * Side effects: Writes DONE status, completed_at, and activity.
 */
export async function POST(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    const body = taskActionSchema.parse(await readJson(request));
    return apiSuccess(await completeTask(user.id, uuidSchema.parse(taskId), body.version), { requestId });
  });
}
