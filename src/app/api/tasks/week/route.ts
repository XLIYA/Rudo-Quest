import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { weekQuerySchema } from "@/lib/validation/tasks";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getWeekTasks } from "@/server/services/task-service";

/**
 * Purpose: Return weekly task data for the authenticated user.
 * Inputs: weekStart query parameter.
 * Output: Task DTOs.
 * Side effects: Reads tasks.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const query = weekQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return apiSuccess(await getWeekTasks(user.id, query.weekStart, query.projectId), {
      requestId,
    });
  });
}
