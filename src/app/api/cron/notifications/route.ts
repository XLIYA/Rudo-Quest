import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";
import {
  assertCronAuthorized,
  runNotificationCron,
} from "@/server/jobs/notification-job";

/**
 * Purpose: Execute scheduled notification jobs from Vercel Cron.
 * Inputs: Bearer CRON_SECRET authorization header.
 * Output: Job summary.
 * Side effects: Creates notifications, sends push, logs deliveries.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(
    request,
    async (requestId) => {
      assertCronAuthorized(request.headers.get("authorization"));
      return apiSuccess(await runNotificationCron(), { requestId });
    },
    { allowMissingOrigin: true },
  );
}
