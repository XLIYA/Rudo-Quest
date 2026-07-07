"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { Persister } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { registerSerwist } from "@/lib/pwa/register";

/**
 * Purpose: Create a minimal IndexedDB TanStack Query persister.
 * Inputs: Storage key.
 * Output: Persister compatible with TanStack Query persistence.
 * Side effects: Reads/writes IndexedDB.
 */
function createIndexedDbPersister(key: string): Persister {
  return {
    persistClient: async (client) => set(key, client),
    restoreClient: async () => get(key),
    removeClient: async () => del(key),
  };
}

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
              const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
              return status >= 500 && failureCount < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );
  const persister = useMemo(() => createIndexedDbPersister("rudo-query-cache-v1"), []);

  useEffect(() => {
    registerSerwist({
      onUpdate: () => toast.info("New Rudo Quest version available."),
    });
    const offline = () => toast.warning("Offline. Mutations are disabled until reconnect.");
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
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) =>
              ["tasks-week", "dashboard", "projects", "project", "notifications", "me"].includes(
                String(query.queryKey[0]),
              ),
          },
        }}
      >
        {children}
        <Toaster richColors position="top-center" />
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
