import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { createSubtaskSchema } from "@/lib/validation/tasks";
import { readJson, withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertRateLimit } from "@/server/security/rate-limit";
import { createSubtask, getStorySubtasks } from "@/server/services/task-service";

type Context = { params: Promise<{ taskId: string }> };

/**
 * Purpose: Return active one-level children for a visible Story.
 * Inputs: Story task ID.
 * Output: Ordered Subtask DTOs.
 * Side effects: Reads Story visibility and child rows.
 */
export async function GET(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    return apiSuccess(await getStorySubtasks(user.id, uuidSchema.parse(taskId)), {
      requestId,
    });
  });
}

/**
 * Purpose: Create a Subtask within a Story's fixed scope.
 * Inputs: Story task ID and validated child fields.
 * Output: Created Subtask DTO.
 * Side effects: Writes task/activity and recalculates Story status atomically.
 */
export async function POST(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("subtask-create", user.id, 120, 60);
    const { taskId } = await context.params;
    const body = createSubtaskSchema.parse(await readJson(request));
    return apiSuccess(await createSubtask(user.id, uuidSchema.parse(taskId), body), {
      status: 201,
      requestId,
    });
  });
}
