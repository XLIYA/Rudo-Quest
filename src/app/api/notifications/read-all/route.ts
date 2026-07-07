import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { readAllNotifications } from "@/server/services/notification-service";

/**
 * Purpose: Mark all current-user notifications as read.
 * Inputs: Auth cookies.
 * Output: Updated count.
 * Side effects: Writes read_at for unread notifications.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    return apiSuccess(await readAllNotifications(user.id), { requestId });
  });
}
