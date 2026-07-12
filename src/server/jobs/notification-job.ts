import { AppError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env/server";
import {
  createNotification,
  retryPushDeliveries,
  sendPushForNotification,
} from "@/server/services/notification-service";
import {
  countDueTasksForDate,
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

function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function isQuietTime(localTime: string, start: string, end: string): boolean {
  const current = minutes(localTime);
  const from = minutes(start.slice(0, 5));
  const to = minutes(end.slice(0, 5));
  if (from === to) return false;
  return from < to ? current >= from && current < to : current >= from || current < to;
}

/**
 * Purpose: Run daily digest and due-today reminder job.
 * Inputs: Current clock date.
 * Output: Summary counts.
 * Side effects: Creates notifications and sends push where eligible.
 * Business rule: Each reminder type is deduplicated by a database unique key and is suppressed during quiet hours.
 */
export async function runNotificationCron(now = new Date()) {
  const retries = await retryPushDeliveries(now);
  const profiles = await listNotificationEligibleProfiles();
  let created = 0;
  for (const profile of profiles) {
    const local = getLocalDateTime(now, profile.timeZone);
    const reminderTime = getReminderTime(profile.dailyReminderTime);
    if (isQuietTime(local.time, profile.quietHoursStart, profile.quietHoursEnd)) continue;
    if (local.time < reminderTime) continue;
    const localDate = local.date;
    const href = `/weekly?date=${localDate}`;
    const dueCount = await countDueTasksForDate(profile.id, localDate);
    if (dueCount > 0) {
      const dueNotification = await createNotification({
        recipientId: profile.id,
        type: "TASK_DUE_TODAY",
        title: "Tasks due today",
        body: `${dueCount} task${dueCount === 1 ? "" : "s"} still need attention today.`,
        href,
        dedupeKey: `${profile.id}:${localDate}:TASK_DUE_TODAY`,
      });
      await sendPushForNotification(dueNotification, profile.id);
    }
    const digest = await createNotification({
      recipientId: profile.id,
      type: "DAILY_DIGEST",
      title: "Today in Rudo Quest",
      body: `${dueCount} task${dueCount === 1 ? "" : "s"} scheduled for today.`,
      href,
      dedupeKey: `${profile.id}:${localDate}:DAILY_DIGEST`,
    });
    await sendPushForNotification(digest, profile.id);
    created += dueCount > 0 ? 2 : 1;
  }
  return { created, checked: profiles.length, retries };
}
