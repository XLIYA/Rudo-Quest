"use client";

import { useEffect, useState } from "react";

/**
 * Purpose: Track browser online state for disabling mutations offline.
 * Inputs: Browser navigator state.
 * Output: Boolean online flag.
 * Side effects: Subscribes to online/offline events.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
