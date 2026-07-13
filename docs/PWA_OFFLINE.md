# PWA and Offline Behavior

Rudo Quest uses Serwist. The manifest is `src/app/manifest.ts`; the service worker source is `src/app/sw.ts`.

The app shell and offline fallback route are precached. Authenticated API responses are not broadly cached in Service Worker Cache Storage. Selected TanStack Query read data is persisted in IndexedDB for recently synchronized weekly, dashboard, project, notification, and profile data.

The persisted key contains the authenticated profile ID, cache version, and
last-write timestamp. Entries expire after seven days. A successful `/api/me`
bootstrap is required before any persisted cache is restored. A remembered
browser user ID is never treated as authentication, including during a cold
offline launch. Logout deletes the user-scoped cache and active-user marker.

Offline V1 behavior:

An already-open authenticated app keeps its in-memory data when connectivity drops. Offline state shows a persistent warning, mutations are disabled in the UI, task/project/profile edits require reconnection, and the app refetches after reconnect. A cold offline navigation receives the neutral offline route rather than cached private HTML or data. Rudo Quest does not fake mutation success and does not implement a background mutation queue.
