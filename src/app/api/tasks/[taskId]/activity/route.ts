import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getTaskActivity } from "@/server/services/task-service";

type Context = { params: Promise<{ taskId: string }> };

/**
 * Purpose: Return safe activity history for a visible task.
 * Inputs: Task ID route parameter and authenticated cookies.
 * Output: Human-readable task activity DTOs without private metadata.
 * Side effects: Reads task visibility and activity rows.
 * Failure behavior: Returns NOT_FOUND for inaccessible tasks.
 */
export async function GET(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    return apiSuccess(await getTaskActivity(user.id, uuidSchema.parse(taskId)), {
      requestId,
    });
  });
}
