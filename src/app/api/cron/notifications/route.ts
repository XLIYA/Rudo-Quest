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
async function handleCronRequest(request: NextRequest) {
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

/**
 * Purpose: Accept Vercel Cron's GET invocation.
 * Inputs: Authorized cron request.
 * Output: Notification job response.
 * Side effects: Runs the scheduled notification job under a distributed lock.
 */
export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

/**
 * Purpose: Accept the documented POST cron invocation for manual schedulers.
 * Inputs: Authorized cron request.
 * Output: Notification job response.
 * Side effects: Runs the scheduled notification job under a distributed lock.
 */
export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}
