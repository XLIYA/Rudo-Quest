import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    {
      matcher: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/api"),
      handler: new NetworkFirst({ cacheName: "rudo-pages" }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json() as
    | { title?: string; body?: string; href?: string }
    | undefined;
  event.waitUntil(
    self.registration.showNotification(payload?.title ?? "Rudo Quest", {
      body: payload?.body ?? "Open Rudo Quest for details.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { href: payload?.href ?? "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = typeof event.notification.data?.href === "string" ? event.notification.data.href : "/notifications";
  event.waitUntil(self.clients.openWindow(href));
});

serwist.addEventListeners();
