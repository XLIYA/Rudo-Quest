"use client";

import { apiMutation } from "@/lib/api/client";

export type PushBrowserState = {
  supported: boolean;
  configured: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
};

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return buffer;
}

function hasPushRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getReadyRegistration(timeoutMs = 4000) {
  const timeout = new Promise<null>((resolve) =>
    window.setTimeout(() => resolve(null), timeoutMs),
  );
  const ready = await Promise.race([navigator.serviceWorker.ready, timeout]);
  return ready ?? (await navigator.serviceWorker.getRegistration()) ?? null;
}

/**
 * Purpose: Read this browser/device push capability and subscription state.
 * Inputs: None.
 * Output: Support, configuration, permission, and subscription flags.
 * Side effects: Reads service worker registration.
 */
export async function getPushBrowserState(): Promise<PushBrowserState> {
  if (!hasPushRuntime()) {
    return {
      supported: false,
      configured: Boolean(vapidPublicKey),
      permission: "unsupported",
      subscribed: false,
    };
  }

  const registration = await getReadyRegistration();
  const subscription = await registration?.pushManager.getSubscription();

  return {
    supported: true,
    configured: Boolean(vapidPublicKey),
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
}

/**
 * Purpose: Request permission and store this browser/device subscription.
 * Inputs: None.
 * Output: Updated push browser state.
 * Side effects: Requests notification permission, subscribes PushManager, writes API row.
 */
export async function subscribeCurrentBrowserToPush(): Promise<PushBrowserState> {
  if (!hasPushRuntime()) {
    throw new Error("Push notifications are not supported by this browser.");
  }
  if (!vapidPublicKey) {
    throw new Error("Push notifications are not configured for this deployment.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await getReadyRegistration();
  if (!registration) {
    throw new Error("The service worker is not ready yet.");
  }
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
    }));

  await apiMutation<{ id: string | null }>(
    "post",
    "/api/push/subscribe",
    subscription.toJSON(),
  );

  return getPushBrowserState();
}

/**
 * Purpose: Remove this browser/device push subscription.
 * Inputs: None.
 * Output: Updated push browser state.
 * Side effects: Deletes API row and unsubscribes PushManager where present.
 */
export async function unsubscribeCurrentBrowserFromPush(): Promise<PushBrowserState> {
  if (!hasPushRuntime()) {
    return getPushBrowserState();
  }

  const registration = await getReadyRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await apiMutation<{ count: number }>("delete", "/api/push/subscribe", {
      endpoint: subscription.endpoint,
    });
    await subscription.unsubscribe();
  }

  return getPushBrowserState();
}
