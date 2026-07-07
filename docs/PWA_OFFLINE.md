# PWA and Offline Behavior

Rudo Quest uses Serwist. The manifest is `src/app/manifest.ts`; the service worker source is `src/app/sw.ts`.

The app shell and offline fallback route are precached. Authenticated API responses are not broadly cached in Service Worker Cache Storage. Selected TanStack Query read data is persisted in IndexedDB for recently synchronized weekly, dashboard, project, notification, and profile data.

Offline V1 behavior:

Offline state shows a persistent warning, mutations are disabled in the UI, task/project/profile edits require reconnection, and the app refetches data after reconnect. Rudo Quest does not fake offline mutation success and does not implement a background mutation queue.
