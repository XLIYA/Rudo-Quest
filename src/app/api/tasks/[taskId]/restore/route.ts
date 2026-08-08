import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { taskActionSchema } from "@/lib/validation/tasks";
import { readJson, withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertRateLimit } from "@/server/security/rate-limit";
import { restoreTask } from "@/server/services/task-history-service";

type Context = { params: Promise<{ taskId: string }> };

/**
 * Purpose: Restore one archived task with optimistic concurrency.
 * Inputs: Task ID route parameter and expected version body.
 * Output: Restored task DTO.
 * Side effects: Clears archived_at and writes TASK_RESTORED activity atomically.
 */
export async function POST(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("task-restore", user.id, 120, 60);
    const { taskId } = await context.params;
    const body = taskActionSchema.parse(await readJson(request));
    return apiSuccess(
      await restoreTask(user.id, uuidSchema.parse(taskId), body.version),
      { requestId },
    );
  });
}
