import { AppError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env/server";
import { createNotification, sendPushForNotification } from "@/server/services/notification-service";
import {
  countDueTasksForDate,
  hasNotificationForRecipientHref,
  listNotificationEligibleProfiles,
} from "@/server/repositories/notification-repository";

const defaultReminderTime = "09:00";

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

function getLocalDateTime(now: Date, timeZone: string) {
  const safeTimeZone = timeZone || "UTC";
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: safeTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  }
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

function getReminderTime(value: string | null): string {
  return (value ?? defaultReminderTime).slice(0, 5);
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
    const local = getLocalDateTime(now, profile.timeZone);
    const reminderTime = getReminderTime(profile.dailyReminderTime);
    if (local.time < reminderTime) continue;
    const localDate = local.date;
    const href = `/weekly?date=${localDate}`;
    const alreadySent = await hasNotificationForRecipientHref({
      recipientId: profile.id,
      type: "DAILY_DIGEST",
      href,
    });
    if (alreadySent) continue;
    const dueCount = await countDueTasksForDate(profile.id, localDate);
    if (dueCount === 0) continue;
    const notification = await createNotification({
      recipientId: profile.id,
      type: "DAILY_DIGEST",
      title: "Today in Rudo Quest",
      body: `${dueCount} task${dueCount === 1 ? "" : "s"} scheduled for today.`,
      href,
    });
    await sendPushForNotification(notification, profile.id);
    created += 1;
  }
  return { created, checked: profiles.length };
}
