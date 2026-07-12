import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { readNotification } from "@/server/services/notification-service";

type Context = { params: Promise<{ notificationId: string }> };

/**
 * Purpose: Mark a notification read.
 * Inputs: Notification ID route parameter.
 * Output: Updated notification DTO.
 * Side effects: Writes read_at.
 */
export async function PATCH(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { notificationId } = await context.params;
    return apiSuccess(await readNotification(user.id, uuidSchema.parse(notificationId)), {
      requestId,
    });
  });
}
