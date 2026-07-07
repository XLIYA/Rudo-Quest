import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getNotifications } from "@/server/services/notification-service";

/**
 * Purpose: Return current user's notification center data.
 * Inputs: Auth cookies.
 * Output: Notification DTOs.
 * Side effects: Reads notifications.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    return apiSuccess(await getNotifications(user.id), { requestId });
  });
}
