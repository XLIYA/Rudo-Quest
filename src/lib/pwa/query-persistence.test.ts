import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const storage = vi.hoisted(() => new Map<string, unknown>());

vi.mock("idb-keyval", () => ({
  del: vi.fn(async (key: string) => {
    storage.delete(key);
  }),
  get: vi.fn(async (key: string) => storage.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    storage.set(key, value);
  }),
}));

describe("user-scoped query persistence", () => {
  beforeEach(() => storage.clear());

  it("persists and restores selected successful reads per user", async () => {
    const { persistUserQueryCache, restoreUserQueryCache } =
      await import("./query-persistence");
    const source = new QueryClient();
    source.setQueryData(["tasks-week", "2026-07-06"], [{ id: "private-task" }]);
    source.setQueryData(["unpersisted-secret"], { token: "never" });
    await persistUserQueryCache(source, "user-one");

    const restored = new QueryClient();
    await expect(restoreUserQueryCache(restored, "user-one")).resolves.toEqual(
      expect.any(Number),
    );
    expect(restored.getQueryData(["tasks-week", "2026-07-06"])).toEqual([
      { id: "private-task" },
    ]);
    expect(restored.getQueryData(["unpersisted-secret"])).toBeUndefined();
    await expect(
      restoreUserQueryCache(new QueryClient(), "user-two"),
    ).resolves.toBeNull();
  });

  it("rejects expired cache entries", async () => {
    const { restoreUserQueryCache } = await import("./query-persistence");
    storage.set("rudo-query-cache-v3:user-one", {
      version: 3,
      userId: "user-one",
      savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      state: { queries: [], mutations: [] },
    });

    await expect(
      restoreUserQueryCache(new QueryClient(), "user-one"),
    ).resolves.toBeNull();
    expect(storage.has("rudo-query-cache-v3:user-one")).toBe(false);
  });
});
