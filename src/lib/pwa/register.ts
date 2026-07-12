"use client";

import { Serwist } from "@serwist/window";

/**
 * Purpose: Register Serwist and surface update availability to the UI.
 * Inputs: Optional update callback.
 * Output: Void.
 * Side effects: Registers service worker in production; removes stale workers in development.
 */
export function registerSerwist(options?: { onUpdate?: () => void }): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
    if ("caches" in window) {
      void caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    }
    return;
  }

  const serwist = new Serwist("/sw.js");

  serwist.addEventListener("waiting", () => {
    options?.onUpdate?.();
    serwist.messageSkipWaiting();
  });

  serwist.addEventListener("controlling", () => {
    window.location.reload();
  });

  void serwist.register();
}
