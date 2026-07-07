import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertRateLimit } from "@/server/security/rate-limit";
import { subscribeToPush, unsubscribeFromPush } from "@/server/services/notification-service";

/**
 * Purpose: Store a browser push subscription after explicit opt-in.
 * Inputs: PushSubscription JSON body.
 * Output: Stored subscription ID.
 * Side effects: Writes push_subscriptions.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("push-subscribe", user.id, 20, 3600);
    return apiSuccess(await subscribeToPush(user.id, await readJson(request), request.headers.get("user-agent")), {
      requestId,
    });
  });
}

/**
 * Purpose: Remove a browser push subscription.
 * Inputs: PushSubscription endpoint JSON body.
 * Output: Deleted count.
 * Side effects: Deletes push_subscriptions.
 */
export async function DELETE(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    return apiSuccess(await unsubscribeFromPush(user.id, await readJson(request)), { requestId });
  });
}
