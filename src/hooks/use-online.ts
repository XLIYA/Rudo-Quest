"use client";

import { useEffect, useState } from "react";

/**
 * Purpose: Track browser online state for disabling mutations offline.
 * Inputs: Browser navigator state.
 * Output: Boolean online flag.
 * Side effects: Subscribes to online/offline events.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    /**
     * Purpose: Synchronize React state with the browser network indicator.
     * Inputs: Browser online/offline event.
     * Output: Void.
     * Side effects: Updates hook state.
     */
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
