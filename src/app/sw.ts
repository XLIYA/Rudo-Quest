import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin &&
        (url.pathname.startsWith("/_next/static/") ||
          /\.(?:svg|png|ico|webp|woff2)$/.test(url.pathname)),
      handler: new CacheFirst({
        cacheName: "rudo-static-assets",
        plugins: [
          new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },
    {
      matcher: ({ request, url }) =>
        request.mode === "navigate" &&
        ["/", "/login", "/signup", "/offline"].includes(url.pathname),
      handler: new NetworkFirst({ cacheName: "rudo-pages" }),
    },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
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
    { title?: string; body?: string; href?: string } | undefined;
  event.waitUntil(
    self.registration.showNotification(payload?.title ?? "Rudo Quest", {
      body: payload?.body ?? "Open Rudo Quest for details.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { href: payload?.href ?? "/profile#notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href =
    typeof event.notification.data?.href === "string"
      ? event.notification.data.href
      : "/profile#notifications";
  const candidateUrl = new URL(href, self.location.origin);
  const targetUrl =
    candidateUrl.origin === self.location.origin
      ? candidateUrl.href
      : new URL("/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const matchingClient = clients.find((client) => client.url === targetUrl);
        if (matchingClient) {
          await matchingClient.focus();
          return;
        }
        const appClient = clients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (appClient) {
          await appClient.navigate(targetUrl);
          await appClient.focus();
          return;
        }
        await self.clients.openWindow(targetUrl);
      }),
  );
});

serwist.addEventListeners();
