import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getAssignedTasks } from "@/server/services/task-service";

/**
 * Purpose: Return incomplete tasks assigned to the authenticated user.
 * Inputs: Authenticated request.
 * Output: Visible assigned task DTOs.
 * Side effects: Reads tasks, profile assets, and project membership.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    return apiSuccess(await getAssignedTasks(user.id), { requestId });
  });
}
