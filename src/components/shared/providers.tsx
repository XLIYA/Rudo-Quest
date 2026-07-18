"use client";

import { ThemeProvider } from "next-themes";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AppToast } from "@/components/ui/app-toast";
import { queryKeys } from "@/lib/api/query-keys";
import { registerSerwist } from "@/lib/pwa/register";
import {
  clearUserQueryCache,
  getActiveCachedUserId,
  persistUserQueryCache,
} from "@/lib/pwa/query-persistence";

type MeProfile = { id: string };

const Agentation = dynamic(
  () => import("agentation").then((module) => module.Agentation),
  { ssr: false },
);

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

    if (!shouldBootstrapPrivateCache) {
      // Public routes must never retain a previous session's cached reads.
      // Clear synchronously so stale private data cannot flash before any
      // async identity check resolves.
      queryClient.clear();
      return;
    }
    const previousUserId = getActiveCachedUserId();

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
     * Purpose: Adopt the identity already verified by the normal profile query.
     * Inputs: None.
     * Output: Void.
     * Side effects: Clears a previous account's persisted reads and schedules a
     * user-scoped cache write.
     * Business rule: Online startup never hydrates IndexedDB data into the query
     * client. Mutating the cache while a streamed route is hydrating can make the
     * client render data against server loading markup.
     */
    const adoptVerifiedProfile = () => {
      const profile = queryClient.getQueryData<MeProfile>(queryKeys.me);
      if (!profile?.id || disposed) return;
      if (activeUserId === profile.id) {
        persist();
        return;
      }
      const inMemoryUserId = activeUserId;
      activeUserId = profile.id;
      void previousUserId.then(async (cachedUserId) => {
        const staleUserId = inMemoryUserId ?? cachedUserId;
        if (staleUserId && staleUserId !== profile.id) {
          await clearUserQueryCache(staleUserId);
        }
        if (!disposed) persist();
      });
    };

    const unsubscribeCache = queryClient.getQueryCache().subscribe(adoptVerifiedProfile);
    adoptVerifiedProfile();
    return () => {
      disposed = true;
      if (persistTimer) window.clearTimeout(persistTimer);
      unsubscribeCache();
    };
  }, [queryClient, shouldBootstrapPrivateCache]);

  useEffect(() => {
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
     * Side effects: Displays a toast and invalidates queries. The cache subscriber
     * persists successful refreshed reads.
     */
    const online = () => {
      AppToast("Back online.", "success");
      void queryClient.invalidateQueries();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
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
      nonce={nonce}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="top-center" />
        {process.env.NODE_ENV === "development" ? <Agentation /> : null}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
