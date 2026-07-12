# PWA and Offline Behavior

Rudo Quest uses Serwist. The manifest is `src/app/manifest.ts`; the service worker source is `src/app/sw.ts`.

The app shell and offline fallback route are precached. Authenticated API responses are not broadly cached in Service Worker Cache Storage. Selected TanStack Query read data is persisted in IndexedDB for recently synchronized weekly, dashboard, project, notification, and profile data.

The persisted key contains the authenticated profile ID, cache version, and
last-write timestamp. Entries expire after seven days. A successful `/api/me`
bootstrap is required before an online cache is restored; a previous cache is
used only while the browser is offline. Logout deletes the user-scoped cache
and active-user marker, preventing one account's reads from appearing for the
next account on the same device.

Offline V1 behavior:

Offline state shows a persistent warning, mutations are disabled in the UI, task/project/profile edits require reconnection, and the app refetches data after reconnect. Rudo Quest does not fake offline mutation success and does not implement a background mutation queue.
