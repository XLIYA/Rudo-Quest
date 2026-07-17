"use client";

import { Serwist } from "@serwist/window";

/**
 * Purpose: Register Serwist and surface update availability to the UI.
 * Inputs: Optional update callback.
 * Output: Void.
 * Side effects: Registers service worker in production; removes stale workers in development.
 */
export function registerSerwist(options?: {
  onUpdate?: (activateUpdate: () => void) => void;
}): void {
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
  let updateActivationRequested = false;

  serwist.addEventListener("waiting", () => {
    /**
     * Purpose: Activate the waiting application version after the user accepts the update.
     * Inputs: None.
     * Output: Void.
     * Side effects: Sends the skip-waiting message to Serwist.
     */
    const activateUpdate = () => {
      updateActivationRequested = true;
      serwist.messageSkipWaiting();
    };
    if (options?.onUpdate) options.onUpdate(activateUpdate);
    else activateUpdate();
  });

  serwist.addEventListener("controlling", () => {
    // `clientsClaim` also emits this event on the first installation. Reload
    // only after an existing client explicitly activated a waiting update so
    // a first-time visitor never loses an in-progress navigation or form.
    if (updateActivationRequested) window.location.reload();
  });

  void serwist.register();
}
