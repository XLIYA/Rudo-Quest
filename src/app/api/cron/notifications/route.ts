import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";
import {
  assertCronAuthorized,
  runNotificationCron,
} from "@/server/jobs/notification-job";
import { withDistributedLock } from "@/server/security/distributed-lock";

export const maxDuration = 300;

/**
 * Purpose: Execute scheduled notification jobs from Vercel Cron.
 * Inputs: Bearer CRON_SECRET authorization header.
 * Output: Job summary.
 * Side effects: Creates notifications, sends push, logs deliveries.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(
    request,
    async (requestId) => {
      assertCronAuthorized(request.headers.get("authorization"));
      const result = await withDistributedLock("notification-cron", 10 * 60, () =>
        runNotificationCron(),
      );
      return apiSuccess(result ?? { skipped: "already_running" as const }, {
        requestId,
      });
    },
    { allowMissingOrigin: true },
  );
}
