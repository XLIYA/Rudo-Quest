"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online";

/**
 * Purpose: Render persistent offline status inside app pages.
 * Inputs: Browser online state.
 * Output: Offline banner when disconnected.
 * Side effects: None.
 */
export function OfflineStatusToast() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="fixed inset-x-4 top-4 z-50 flex items-center gap-2 rounded-md border border-warning bg-surface px-3 py-2 text-sm font-semibold text-warning shadow-[var(--shadow-raised)] md:left-auto md:w-fit">
      <WifiOff className="size-4" />
      Offline. Changes are disabled.
    </div>
  );
}
