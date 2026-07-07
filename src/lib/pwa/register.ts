"use client";

import { Serwist } from "@serwist/window";

/**
 * Purpose: Register Serwist and surface update availability to the UI.
 * Inputs: Optional update callback.
 * Output: Void.
 * Side effects: Registers service worker only in production.
 */
export function registerSerwist(options?: { onUpdate?: () => void }): void {
  if (
    process.env.NODE_ENV !== "production" ||
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  const serwist = new Serwist("/sw.js");

  serwist.addEventListener("waiting", () => {
    options?.onUpdate?.();
  });

  void serwist.register();
}