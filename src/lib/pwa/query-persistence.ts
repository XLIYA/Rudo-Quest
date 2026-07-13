"use client";

import { del, get, set } from "idb-keyval";
import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient,
} from "@tanstack/react-query";

const cacheVersion = 3;
const cacheTtlMs = 7 * 24 * 60 * 60 * 1000;
const activeUserKey = "rudo-active-user-v1";
const cachePrefix = "rudo-query-cache-v3";
const persistableQueryPrefixes = new Set([
  "me",
  "projects",
  "project",
  "project-members",
  "project-invitations",
  "tasks-week",
  "task",
  "dashboard",
  "notifications",
  "activity",
]);

type PersistedUserCache = {
  version: number;
  userId: string;
  savedAt: number;
  state: DehydratedState;
};

/**
 * Purpose: Namespace persisted query data by authenticated user and cache version.
 * Inputs: Server-confirmed user ID.
 * Output: IndexedDB key string.
 * Side effects: None.
 * Business rule: Cached private reads must never be shared between accounts.
 */
function cacheKey(userId: string): string {
  return `${cachePrefix}:${userId}`;
}

/**
 * Purpose: Restore only the authenticated user's successful read queries from IndexedDB.
 * Inputs: Query client and server-confirmed or previously active user ID.
 * Output: Last synchronization timestamp, or null when no valid cache exists.
 * Side effects: Hydrates TanStack Query and removes expired/corrupt cache entries.
 * Failure behavior: Treats IndexedDB failures as an empty cache so the app remains usable online.
 */
export async function restoreUserQueryCache(
  queryClient: QueryClient,
  userId: string,
): Promise<number | null> {
  try {
    const cached = await get<PersistedUserCache>(cacheKey(userId));
    if (
      !cached ||
      cached.version !== cacheVersion ||
      cached.userId !== userId ||
      Date.now() - cached.savedAt > cacheTtlMs
    ) {
      if (cached) await del(cacheKey(userId));
      return null;
    }
    hydrate(queryClient, cached.state);
    return cached.savedAt;
  } catch {
    return null;
  }
}

/**
 * Purpose: Persist selected successful TanStack Query reads for the active user.
 * Inputs: Query client and server-confirmed user ID.
 * Output: Promise resolving after the cache and active-user marker are written.
 * Side effects: Writes user-scoped IndexedDB data; never stores auth tokens.
 * Failure behavior: Silently leaves the in-memory cache intact when storage is unavailable.
 */
export async function persistUserQueryCache(
  queryClient: QueryClient,
  userId: string,
): Promise<void> {
  try {
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) =>
        query.state.status === "success" &&
        typeof query.queryKey[0] === "string" &&
        persistableQueryPrefixes.has(query.queryKey[0]),
    });
    await set(cacheKey(userId), {
      version: cacheVersion,
      userId,
      savedAt: Date.now(),
      state,
    } satisfies PersistedUserCache);
    await set(activeUserKey, userId);
  } catch {
    // IndexedDB is an enhancement; network-backed reads remain authoritative.
  }
}

/**
 * Purpose: Read the last user identity known to this browser for offline cache restore.
 * Inputs: None.
 * Output: User ID or null.
 * Side effects: Reads IndexedDB.
 * Failure behavior: Returns null when storage is unavailable or malformed.
 */
export async function getActiveCachedUserId(): Promise<string | null> {
  try {
    const value = await get<string>(activeUserKey);
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Purpose: Remove all persisted reads for a user and clear the active-user marker.
 * Inputs: User ID to remove.
 * Output: Promise resolving after cleanup.
 * Side effects: Deletes IndexedDB cache data on logout or account switch.
 * Failure behavior: Best-effort cleanup; the caller still completes logout.
 */
export async function clearUserQueryCache(userId: string): Promise<void> {
  try {
    await del(cacheKey(userId));
    const active = await getActiveCachedUserId();
    if (active === userId) await del(activeUserKey);
  } catch {
    // Cleanup must not prevent the server session from being signed out.
  }
}
