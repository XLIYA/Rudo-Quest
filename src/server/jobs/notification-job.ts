import { format } from "date-fns";
import { AppError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env/server";
import { createNotification, sendPushForNotification } from "@/server/services/notification-service";
import {
  countDueTasksForDate,
  listNotificationEligibleProfiles,
} from "@/server/repositories/notification-repository";

/**
 * Purpose: Verify Vercel Cron authorization.
 * Inputs: Authorization header value.
 * Output: Void when valid.
 * Side effects: None.
 * Failure behavior: Throws UNAUTHORIZED when CRON_SECRET is absent or mismatched.
 */
export function assertCronAuthorized(header: string | null): void {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret || header !== `Bearer ${secret}`) {
    throw new AppError("UNAUTHORIZED", 401, "Cron authorization failed.");
  }
}

/**
 * Purpose: Run daily digest and due-today reminder job.
 * Inputs: Current clock date.
 * Output: Summary counts.
 * Side effects: Creates notifications and sends push where eligible.
 * Business rule: V1 keeps scheduling idempotency at the notification title/day layer.
 */
export async function runNotificationCron(now = new Date()) {
  const profiles = await listNotificationEligibleProfiles();
  let created = 0;
  for (const profile of profiles) {
    const localDate = format(now, "yyyy-MM-dd");
    const dueCount = await countDueTasksForDate(profile.id, localDate);
    if (dueCount === 0) continue;
    const notification = await createNotification({
      recipientId: profile.id,
      type: "DAILY_DIGEST",
      title: "Today in Rudo Quest",
      body: `${dueCount} task${dueCount === 1 ? "" : "s"} scheduled for today.`,
      href: `/weekly?date=${localDate}`,
    });
    await sendPushForNotification(notification, profile.id);
    created += 1;
  }
  return { created, checked: profiles.length };
}
