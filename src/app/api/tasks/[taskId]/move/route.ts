import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { taskMoveSchema } from "@/lib/validation/tasks";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { moveTask } from "@/server/services/task-service";

type Context = { params: Promise<{ taskId: string }> };

/**
 * Purpose: Move a task to a requested Kanban status.
 * Inputs: Task ID, expected version, and TODO/IN_PROGRESS/DONE target.
 * Output: Updated task DTO.
 * Side effects: Commits a versioned task transition and activity event.
 */
export async function POST(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    const body = taskMoveSchema.parse(await readJson(request));
    return apiSuccess(
      await moveTask(user.id, uuidSchema.parse(taskId), body.version, body.status),
      { requestId },
    );
  });
}
