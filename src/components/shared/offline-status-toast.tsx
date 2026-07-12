"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import { useEffect, useState } from "react";
import {
  getActiveCachedUserId,
  restoreUserQueryCache,
} from "@/lib/pwa/query-persistence";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Purpose: Render persistent offline status inside app pages.
 * Inputs: Browser online state.
 * Output: Offline banner when disconnected.
 * Side effects: None.
 */
export function OfflineStatusToast() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  useEffect(() => {
    if (online) return;
    let active = true;
    void getActiveCachedUserId().then(async (userId) => {
      if (!userId) return;
      const timestamp = await restoreUserQueryCache(queryClient, userId);
      if (active) setLastSyncedAt(timestamp);
    });
    return () => {
      active = false;
    };
  }, [online, queryClient]);
  if (online) return null;
  return (
    <div className="fixed inset-x-4 top-4 z-50 flex items-center gap-2 rounded-md border border-warning bg-surface px-3 py-2 text-sm font-semibold text-warning shadow-[var(--shadow-raised)] md:left-auto md:w-fit">
      <WifiOff className="size-4" />
      <span>
        Offline. Changes are disabled.
        {lastSyncedAt ? (
          <span className="ml-1 font-mono text-xs font-normal">
            Last synced {new Date(lastSyncedAt).toLocaleString()}
          </span>
        ) : null}
      </span>
    </div>
  );
}
