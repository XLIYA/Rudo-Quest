import { AppError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env/server";
import {
  createNotification,
  preparePushDelivery,
  retryPushDeliveries,
  sendPushForNotification,
} from "@/server/services/notification-service";
import {
  countDueTasksForUsersOnDate,
  listNotificationEligibleProfiles,
} from "@/server/repositories/notification-repository";
import { cleanupExpiredProfileAssetUploads } from "@/server/jobs/profile-upload-cleanup";

const defaultReminderTime = "09:00";

/**
 * Purpose: Verify scheduled-job bearer authorization.
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
 * Purpose: Resolve the scheduler clock into a user's local date and minute.
 * Inputs: Current instant and stored IANA timezone.
 * Output: ISO date and 24-hour HH:mm values.
 * Side effects: None.
 * Failure behavior: Falls back to UTC for legacy invalid timezone values.
 */
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
  /**
   * Purpose: Read one local date-time part from Intl output.
   * Inputs: Intl part type.
   * Output: Part value or a defensive zero value.
   * Side effects: None.
   */
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

/**
 * Purpose: Normalize nullable database reminder times to minute precision.
 * Inputs: Stored SQL time or null.
 * Output: HH:mm reminder time.
 * Side effects: None.
 */
function getReminderTime(value: string | null): string {
  return (value ?? defaultReminderTime).slice(0, 5);
}

/**
 * Purpose: Convert an HH:mm time into minutes since midnight.
 * Inputs: Validated time string.
 * Output: Minute index.
 * Side effects: None.
 */
function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/**
 * Purpose: Determine whether a local time falls inside a possibly overnight quiet period.
 * Inputs: Current local time and quiet-period start/end.
 * Output: True when notification delivery must be suppressed.
 * Side effects: None.
 */
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
  const [uploadCleanup, retries, profiles] = await Promise.all([
    cleanupExpiredProfileAssetUploads(),
    retryPushDeliveries(now),
    listNotificationEligibleProfiles(),
  ]);
  const eligible = profiles.flatMap((profile) => {
    const local = getLocalDateTime(now, profile.timeZone);
    const reminderTime = getReminderTime(profile.dailyReminderTime);
    if (
      isQuietTime(local.time, profile.quietHoursStart, profile.quietHoursEnd) ||
      local.time < reminderTime
    ) {
      return [];
    }
    return [{ profile, localDate: local.date }];
  });
  const profilesByDate = new Map<string, typeof eligible>();
  for (const entry of eligible) {
    const entries = profilesByDate.get(entry.localDate) ?? [];
    entries.push(entry);
    profilesByDate.set(entry.localDate, entries);
  }
  const dueCounts = new Map<string, number>();
  for (const [localDate, entries] of profilesByDate) {
    for (let offset = 0; offset < entries.length; offset += 250) {
      const ids = entries.slice(offset, offset + 250).map(({ profile }) => profile.id);
      const batchCounts = await countDueTasksForUsersOnDate(ids, localDate);
      for (const [userId, count] of batchCounts) dueCounts.set(userId, count);
    }
  }
  let created = 0;
  for (let offset = 0; offset < eligible.length; offset += 10) {
    const batch = eligible.slice(offset, offset + 10);
    const counts = await Promise.all(
      batch.map(async ({ profile, localDate }) => {
        const href = `/weekly?date=${localDate}`;
        const dueCount = dueCounts.get(profile.id) ?? 0;
        const push = await preparePushDelivery(profile.id, profile.notificationsEnabled);
        if (dueCount > 0) {
          const dueNotification = await createNotification({
            recipientId: profile.id,
            type: "TASK_DUE_TODAY",
            title: "Tasks due today",
            body: `${dueCount} task${dueCount === 1 ? "" : "s"} still need attention today.`,
            href,
            dedupeKey: `${profile.id}:${localDate}:TASK_DUE_TODAY`,
          });
          await sendPushForNotification(dueNotification, profile.id, push);
        }
        const digest = await createNotification({
          recipientId: profile.id,
          type: "DAILY_DIGEST",
          title: "Today in Rudo Quest",
          body: `${dueCount} task${dueCount === 1 ? "" : "s"} scheduled for today.`,
          href,
          dedupeKey: `${profile.id}:${localDate}:DAILY_DIGEST`,
        });
        await sendPushForNotification(digest, profile.id, push);
        return dueCount > 0 ? 2 : 1;
      }),
    );
    created += counts.reduce<number>((total, count) => total + count, 0);
  }
  return { created, checked: profiles.length, retries, uploadCleanup };
}
