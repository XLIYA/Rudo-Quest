import webPush from "web-push";
import * as Sentry from "@sentry/nextjs";
import { AppError } from "@/lib/api/errors";
import { getServerEnv, hasPushEnv } from "@/lib/env/server";
import { pushSubscriptionSchema } from "@/lib/validation/common";
import type { NotificationDto, NotificationType } from "@/types/domain";
import type { DbExecutor } from "@/lib/db/client";
import { findProfileById } from "@/server/repositories/profile-repository";
import {
  deletePushSubscription,
  deletePushSubscriptionById,
  insertNotification,
  listNotifications,
  listNotificationDeliveryStatuses,
  listRetryableNotificationDeliveries,
  listPushSubscriptions,
  markAllNotificationsRead,
  markNotificationRead,
  recordNotificationDelivery,
  upsertPushSubscription,
} from "@/server/repositories/notification-repository";

/**
 * Purpose: Create an in-app notification.
 * Inputs: Recipient, notification type, title, optional body/href.
 * Output: Notification DTO.
 * Side effects: Writes notification row.
 */
export async function createNotification(
  input: {
    recipientId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    href?: string | null;
    dedupeKey?: string | null;
  },
  db?: DbExecutor,
): Promise<NotificationDto> {
  return insertNotification(input, db);
}

/**
 * Purpose: Read current user's notification center data.
 * Inputs: User ID.
 * Output: Notification DTO list.
 * Side effects: Reads notifications.
 */
export async function getNotifications(userId: string, cursor?: string) {
  return listNotifications(userId, cursor);
}

/**
 * Purpose: Optimistically mark one notification as read.
 * Inputs: User ID and notification ID.
 * Output: Updated notification DTO.
 * Side effects: Writes read_at.
 */
export async function readNotification(userId: string, notificationId: string) {
  const updated = await markNotificationRead(userId, notificationId);
  if (!updated) throw new AppError("NOT_FOUND", 404, "Notification not found.");
  return updated;
}

/**
 * Purpose: Mark all current-user notifications read.
 * Inputs: User ID.
 * Output: Updated count.
 * Side effects: Writes read_at on unread notifications.
 */
export async function readAllNotifications(userId: string) {
  return { count: await markAllNotificationsRead(userId) };
}

/**
 * Purpose: Store a push subscription after explicit user opt-in.
 * Inputs: User ID, subscription payload, and user-agent.
 * Output: Stored subscription ID.
 * Side effects: Writes push_subscriptions.
 */
export async function subscribeToPush(
  userId: string,
  payload: unknown,
  userAgent: string | null,
) {
  if (!hasPushEnv())
    throw new AppError("INTEGRATION_NOT_CONFIGURED", 503, "Push is not configured.");
  const parsed = pushSubscriptionSchema.parse(payload);
  const subscription = await upsertPushSubscription({
    userId,
    endpoint: parsed.endpoint,
    p256dh: parsed.keys.p256dh,
    auth: parsed.keys.auth,
    userAgent,
  });
  return { id: subscription?.id ?? null };
}

/**
 * Purpose: Remove a push subscription for the current browser/device.
 * Inputs: User ID and subscription endpoint.
 * Output: Deleted count.
 * Side effects: Deletes push_subscriptions.
 */
export async function unsubscribeFromPush(userId: string, payload: unknown) {
  const parsed = pushSubscriptionSchema.pick({ endpoint: true }).parse(payload);
  return { count: await deletePushSubscription(userId, parsed.endpoint) };
}

/**
 * Purpose: Send a safe browser push notification to all current user subscriptions.
 * Inputs: Notification DTO.
 * Output: Count of successful sends.
 * Side effects: Sends network requests to push services, logs delivery, deletes dead endpoints.
 */
export async function sendPushForNotification(
  notification: NotificationDto,
  userId: string,
  selectedSubscriptions?: Awaited<ReturnType<typeof listPushSubscriptions>>,
) {
  const env = getServerEnv();
  if (!hasPushEnv(env)) return { sent: 0 };
  const profile = await findProfileById(userId);
  if (!profile?.notificationsEnabled) return { sent: 0 };
  webPush.setVapidDetails(
    env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    env.VAPID_PRIVATE_KEY ?? "",
  );
  let sent = 0;
  const subscriptions = selectedSubscriptions ?? (await listPushSubscriptions(userId));
  const deliveryStatuses = await listNotificationDeliveryStatuses(notification.id);
  for (const subscription of subscriptions) {
    const delivery = deliveryStatuses.get(subscription.id);
    if (delivery?.status === "SENT") continue;
    if (
      delivery?.status === "FAILED" &&
      (delivery.attemptCount >= 3 ||
        (delivery.nextRetryAt && delivery.nextRetryAt > new Date()))
    )
      continue;
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          title: notification.title,
          body: notification.body,
          href: notification.href ?? "/profile#notifications",
        }),
      );
      sent += 1;
      await recordNotificationDelivery({
        notificationId: notification.id,
        subscriptionId: subscription.id,
        status: "SENT",
      });
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
      await recordNotificationDelivery({
        notificationId: notification.id,
        subscriptionId: subscription.id,
        status: "FAILED",
        failureReason: statusCode ? `HTTP ${statusCode}` : "Push delivery failed",
      });
      if (statusCode === 404 || statusCode === 410) {
        await deletePushSubscriptionById(subscription.id);
      }
    }
  }
  return { sent };
}

/**
 * Purpose: Deliver browser push after its durable in-app notification has committed.
 * Inputs: Safe notification DTO and recipient ID.
 * Output: Promise that always resolves after delivery or failure capture.
 * Side effects: Sends push, writes delivery rows, and reports infrastructure failures.
 * Failure behavior: Never rolls back the already-committed application mutation.
 */
export async function deliverPushBestEffort(
  notification: NotificationDto,
  userId: string,
): Promise<void> {
  try {
    await sendPushForNotification(notification, userId);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: "push-delivery", notificationType: notification.type },
      extra: { notificationId: notification.id, recipientId: userId },
    });
  }
}

/**
 * Purpose: Retry failed push deliveries whose exponential backoff has elapsed.
 * Inputs: Current clock and optional bounded batch size.
 * Output: Number of retry attempts started and successful sends.
 * Side effects: Sends push requests and updates delivery logs; removes dead subscriptions.
 */
export async function retryPushDeliveries(now = new Date(), limit = 100) {
  const deliveries = await listRetryableNotificationDeliveries(now, limit);
  let sent = 0;
  for (const delivery of deliveries) {
    const result = await sendPushForNotification(
      delivery.notification,
      delivery.recipientId,
      [delivery.subscription],
    );
    sent += result.sent;
  }
  return { attempted: deliveries.length, sent };
}
