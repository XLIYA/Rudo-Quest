"use client";

import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AppToast } from "@/components/ui/app-toast";
import { apiGet, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
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
 * Inputs: React children and the request-scoped Content Security Policy nonce.
 * Output: Application provider tree.
 * Side effects: Registers service worker and browser online/offline listeners.
 */
export function Providers({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const pathname = usePathname();
  const shouldBootstrapPrivateCache = [
    "/dashboard",
    "/weekly",
    "/projects",
    "/profile",
    "/notifications",
    "/settings",
    "/reset-password",
  ].some((path) => pathname.startsWith(path));
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

    if (!shouldBootstrapPrivateCache) {
      // Public routes must never retain a previous session's cached reads.
      // Clear synchronously so stale private data cannot flash before any
      // async identity check resolves.
      queryClient.clear();
    }

    /**
     * Purpose: Debounce persistence of the active user's approved read queries.
     * Inputs: None.
     * Output: Void.
     * Side effects: Schedules a user-scoped IndexedDB write.
     */
    const persist = () => {
      const userId = activeUserId;
      if (!userId) return;
      if (persistTimer) window.clearTimeout(persistTimer);
      persistTimer = window.setTimeout(() => {
        void persistUserQueryCache(queryClient, userId);
      }, 250);
    };

    /**
     * Purpose: Verify the server session before restoring private offline data.
     * Inputs: None.
     * Output: Promise resolving after cache bootstrap.
     * Side effects: Reads the profile API and user-scoped IndexedDB cache.
     * Failure behavior: Clears stale data after an unauthorized or changed account.
     */
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
      // Persisted application data is private. Restore it only after the server
      // has verified the current session; a remembered browser user ID is not
      // authentication and must never unlock a cold offline session.
      activeUserId = profile?.id ?? null;
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

    if (shouldBootstrapPrivateCache) void bootstrap();
    registerSerwist({
      onUpdate: (activateUpdate) =>
        AppToast("A new Rudo Quest version is available.", "info", {
          action: { label: "Update", onClick: activateUpdate },
        }),
    });
    /**
     * Purpose: Announce loss of connectivity and the mutation lock.
     * Inputs: Browser offline event.
     * Output: Void.
     * Side effects: Displays an accessible toast.
     */
    const offline = () =>
      AppToast("Offline. Mutations are disabled until reconnect.", "warning");
    /**
     * Purpose: Refresh server state after connectivity returns.
     * Inputs: Browser online event.
     * Output: Void.
     * Side effects: Displays a toast, invalidates queries, and persists refreshed reads.
     */
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
  }, [queryClient, shouldBootstrapPrivateCache]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="top-center" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
