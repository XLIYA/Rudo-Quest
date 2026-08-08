import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { taskHistoryQuerySchema } from "@/lib/validation/tasks";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getTaskHistory } from "@/server/services/task-history-service";

/**
 * Purpose: Return one cursor-paginated Missed or Archived task page.
 * Inputs: Validated view and optional opaque cursor query parameters.
 * Output: Visible task-history DTO page.
 * Side effects: Reads profile timezone, tasks, projects, and memberships.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const query = taskHistoryQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return apiSuccess(await getTaskHistory(user.id, query), { requestId });
  });
}
