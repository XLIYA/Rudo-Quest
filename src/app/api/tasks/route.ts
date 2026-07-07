import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { createTaskSchema } from "@/lib/validation/tasks";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { createTask } from "@/server/services/task-service";

/**
 * Purpose: Create a personal or project task.
 * Inputs: Validated task body.
 * Output: Created task.
 * Side effects: Writes task, activity, and optional assignment notification.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const body = createTaskSchema.parse(await readJson(request));
    return apiSuccess(
      await createTask(user.id, {
        ...body,
        projectId: body.projectId ?? null,
        assigneeId: body.assigneeId ?? null,
      }),
      { status: 201, requestId },
    );
  });
}
