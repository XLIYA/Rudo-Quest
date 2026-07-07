"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { del } from "idb-keyval";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { registerSerwist } from "@/lib/pwa/register";

const queryCacheKey = "rudo-query-cache-v2";
const legacyQueryCacheKey = "rudo-query-cache-v1";

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
          },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => {
    void del(legacyQueryCacheKey);
    void del(queryCacheKey);
    registerSerwist({
      onUpdate: () => toast.info("New Rudo Quest version available."),
    });
    const offline = () =>
      toast.warning("Offline. Mutations are disabled until reconnect.");
    const online = () => {
      toast.success("Back online.");
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
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="top-center" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
