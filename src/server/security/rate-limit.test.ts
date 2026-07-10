import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const constructedLimiters = vi.hoisted(
  () => [] as { limiter: { limit: number; window: string }; prefix: string }[],
);
const limitCalls = vi.hoisted(() => [] as string[]);

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow(limit: number, window: string) {
      return { limit, window };
    }

    constructor(options: { limiter: { limit: number; window: string }; prefix: string }) {
      constructedLimiters.push(options);
    }

    limit(identity: string) {
      limitCalls.push(identity);
      return Promise.resolve({ success: true });
    }
  }

  return { Ratelimit };
});

vi.mock("@upstash/redis", () => ({
  Redis: class Redis {},
}));

describe("assertRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    constructedLimiters.length = 0;
    limitCalls.length = 0;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps separate Upstash limiter policies per route key, limit, and window", async () => {
    const { assertRateLimit } = await import("./rate-limit");

    await assertRateLimit("auth-signin", "ip", 8, 60);
    await assertRateLimit("github-webhook", "ip", 300, 60);
    await assertRateLimit("auth-signin", "ip", 8, 60);

    expect(constructedLimiters.map((item) => item.limiter)).toEqual([
      { limit: 8, window: "60 s" },
      { limit: 300, window: "60 s" },
    ]);
    expect(limitCalls).toEqual(["auth-signin:ip", "github-webhook:ip", "auth-signin:ip"]);
  });
});
