"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AppToast } from "@/components/ui/app-toast";
import { apiGet, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { AgentationToolbar } from "@/components/shared/agentation-toolbar";
import { registerSerwist } from "@/lib/pwa/register";
import {
  clearUserQueryCache,
  getActiveCachedUserId,
  persistUserQueryCache,
  restoreUserQueryCache,
} from "@/lib/pwa/query-persistence";

type MeProfile = { id: string };

/**
 * Purpose: Provide theme, server-state cache, offline toasts, and PWA update registration.
 * Inputs: React children.
 * Output: Application provider tree.
 * Side effects: Registers service worker and browser online/offline listeners.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              const status =
                typeof error === "object" && error && "status" in error
                  ? Number(error.status)
                  : 0;
              return status >= 500 && failureCount < 2;
            },
            networkMode: "offlineFirst",
          },
          mutations: { retry: false, networkMode: "online" },
        },
      }),
  );

  useEffect(() => {
    let disposed = false;
    let persistTimer: number | undefined;
    let activeUserId: string | null = null;
    let unsubscribeCache: (() => void) | null = null;

    const persist = () => {
      const userId = activeUserId;
      if (!userId) return;
      if (persistTimer) window.clearTimeout(persistTimer);
      persistTimer = window.setTimeout(() => {
        void persistUserQueryCache(queryClient, userId);
      }, 250);
    };

    const bootstrap = async () => {
      const previousUserId = await getActiveCachedUserId();
      let profile: MeProfile | null = null;
      if (navigator.onLine) {
        try {
          profile = await apiGet<MeProfile>("/api/me");
        } catch (error) {
          if (normalizeApiClientError(error).status === 401 && previousUserId) {
            await clearUserQueryCache(previousUserId);
            queryClient.clear();
          }
          profile = null;
        }
      }
      if (disposed) return;
      activeUserId = profile?.id ?? (navigator.onLine ? null : previousUserId);
      if (profile?.id && previousUserId && profile.id !== previousUserId) {
        await clearUserQueryCache(previousUserId);
        queryClient.clear();
      }
      if (!activeUserId) return;
      await restoreUserQueryCache(queryClient, activeUserId);
      if (profile) queryClient.setQueryData(queryKeys.me, profile);
      unsubscribeCache = queryClient.getQueryCache().subscribe(persist);
      if (disposed) unsubscribeCache();
      else persist();
    };

    void bootstrap();
    registerSerwist({
      onUpdate: () => AppToast("Rudo Quest updated. Reloading…", "info"),
    });
    const offline = () =>
      AppToast("Offline. Mutations are disabled until reconnect.", "warning");
    const online = () => {
      AppToast("Back online.", "success");
      void queryClient.invalidateQueries().then(() => persist());
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      disposed = true;
      if (persistTimer) window.clearTimeout(persistTimer);
      unsubscribeCache?.();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [queryClient]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="top-center" />
        <AgentationToolbar />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
