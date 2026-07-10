import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { notificationDeliveries, notifications, profiles, pushSubscriptions, tasks } from "@/db/schema";
import { getDb } from "@/lib/db/client";
import type { NotificationDto, NotificationType } from "@/types/domain";

/**
 * Purpose: Create an in-app notification.
 * Inputs: Recipient, type, title, optional body and href.
 * Output: Created notification DTO.
 * Side effects: Writes notifications.
 */
export async function insertNotification(input: {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
}): Promise<NotificationDto> {
  const [created] = await getDb()
    .insert(notifications)
    .values({
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    })
    .returning();
  if (!created) throw new Error("Notification insert failed.");
  return toNotificationDto(created);
}

/**
 * Purpose: List current user's notifications.
 * Inputs: User ID.
 * Output: Notification DTOs ordered newest first.
 * Side effects: Reads notifications.
 */
export async function listNotifications(userId: string): Promise<NotificationDto[]> {
  const rows = await getDb()
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(80);
  return rows.map(toNotificationDto);
}

/**
 * Purpose: Check whether a notification already exists for a recipient/type/href.
 * Inputs: Recipient ID, notification type, and href.
 * Output: Boolean existence flag.
 * Side effects: Reads notifications.
 */
export async function hasNotificationForRecipientHref(input: {
  recipientId: string;
  type: NotificationType;
  href: string;
}): Promise<boolean> {
  const rows = await getDb()
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, input.recipientId),
        eq(notifications.type, input.type),
        eq(notifications.href, input.href),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Purpose: Mark a notification read.
 * Inputs: User ID and notification ID.
 * Output: Updated notification DTO or null.
 * Side effects: Writes read_at.
 */
export async function markNotificationRead(userId: string, notificationId: string) {
  const [updated] = await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.recipientId, userId)))
    .returning();
  return updated ? toNotificationDto(updated) : null;
}

/**
 * Purpose: Mark all unread notifications read.
 * Inputs: User ID.
 * Output: Count of notifications updated.
 * Side effects: Writes read_at on unread notifications.
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const rows = await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.recipientId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return rows.length;
}

/**
 * Purpose: Upsert a browser push subscription.
 * Inputs: User ID, endpoint, keys, and optional user agent.
 * Output: Stored subscription row.
 * Side effects: Writes push_subscriptions.
 */
export async function upsertPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  const [row] = await getDb()
    .insert(pushSubscriptions)
    .values(input)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      },
    })
    .returning();
  return row;
}

/**
 * Purpose: Delete a browser push subscription by endpoint.
 * Inputs: User ID and endpoint.
 * Output: Number of deleted rows.
 * Side effects: Deletes push_subscriptions.
 */
export async function deletePushSubscription(userId: string, endpoint: string): Promise<number> {
  const rows = await getDb()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id });
  return rows.length;
}

/**
 * Purpose: List push subscriptions for a user.
 * Inputs: User ID.
 * Output: Subscription rows.
 * Side effects: Reads push_subscriptions.
 */
export async function listPushSubscriptions(userId: string) {
  return getDb()
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

/**
 * Purpose: Record a push delivery attempt.
 * Inputs: Notification ID, subscription ID, status, and optional failure reason.
 * Output: Delivery row.
 * Side effects: Writes notification_deliveries and subscription success timestamp.
 */
export async function recordNotificationDelivery(input: {
  notificationId: string;
  subscriptionId: string;
  status: "SENT" | "FAILED";
  failureReason?: string | null;
}) {
  const now = new Date();
  const [row] = await getDb()
    .insert(notificationDeliveries)
    .values({
      notificationId: input.notificationId,
      subscriptionId: input.subscriptionId,
      status: input.status,
      attemptCount: 1,
      sentAt: input.status === "SENT" ? now : null,
      failedAt: input.status === "FAILED" ? now : null,
      failureReason: input.failureReason ?? null,
    })
    .returning();
  if (input.status === "SENT") {
    await getDb()
      .update(pushSubscriptions)
      .set({ lastSuccessAt: now })
      .where(eq(pushSubscriptions.id, input.subscriptionId));
  }
  return row;
}

/**
 * Purpose: Remove a dead browser push subscription.
 * Inputs: Subscription ID.
 * Output: Deleted count.
 * Side effects: Deletes push_subscriptions.
 */
export async function deletePushSubscriptionById(subscriptionId: string): Promise<number> {
  const rows = await getDb()
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.id, subscriptionId))
    .returning({ id: pushSubscriptions.id });
  return rows.length;
}

/**
 * Purpose: Find users eligible for daily notification processing.
 * Inputs: None.
 * Output: Profiles with enabled notification settings.
 * Side effects: Reads profiles.
 */
export async function listNotificationEligibleProfiles() {
  return getDb()
    .select({
      id: profiles.id,
      timeZone: profiles.timeZone,
      dailyReminderTime: profiles.dailyReminderTime,
      notificationsEnabled: profiles.notificationsEnabled,
      dailyReminderEnabled: profiles.dailyReminderEnabled,
    })
    .from(profiles)
    .where(and(eq(profiles.notificationsEnabled, true), eq(profiles.dailyReminderEnabled, true)));
}

/**
 * Purpose: Count incomplete tasks due for a user on a local date.
 * Inputs: User ID and ISO yyyy-MM-dd date.
 * Output: Incomplete task count.
 * Side effects: Reads tasks.
 */
export async function countDueTasksForDate(userId: string, date: string): Promise<number> {
  const rows = await getDb()
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.assigneeId, userId),
        eq(tasks.scheduledDate, date),
        ne(tasks.status, "DONE"),
        isNull(tasks.archivedAt),
      ),
    );
  return rows.filter((row) => row.id).length;
}

/**
 * Purpose: Convert database notifications into API DTOs.
 * Inputs: Notification row.
 * Output: Notification DTO.
 * Side effects: None.
 */
function toNotificationDto(row: typeof notifications.$inferSelect): NotificationDto {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
