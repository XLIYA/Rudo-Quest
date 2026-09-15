import { afterEach, describe, expect, it, vi } from "vitest";

describe("server environment helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the current Supabase publishable key name", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    const { getServerEnv, getSupabasePublicKey, hasSupabaseEnv } =
      await import("./server");
    const env = getServerEnv();

    expect(getSupabasePublicKey(env)).toBe("sb_publishable_example");
    expect(hasSupabaseEnv(env)).toBe(true);
  });

  it("prefers the current Supabase secret key name over the legacy service role name", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_example");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role");
    const { getServerEnv, getSupabaseAdminKey } = await import("./server");

    expect(getSupabaseAdminKey(getServerEnv())).toBe("sb_secret_example");
  });

  it("requires Cron and Redis alongside core production infrastructure", async () => {
    const { assertProductionEnv } = await import("./server");
    expect(() =>
      assertProductionEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://rudo.example",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
        SUPABASE_SECRET_KEY: "secret",
        DATABASE_URL: "postgresql://example",
      }),
    ).toThrow(/CRON_SECRET.*UPSTASH_REDIS/);
  });

  it("requires GITHUB_TOKEN_ENCRYPTION_KEY when the GitHub App is configured in production", async () => {
    const { assertProductionEnv } = await import("./server");
    const base = {
      NODE_ENV: "production" as const,
      NEXT_PUBLIC_APP_URL: "https://rudo.example",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
      SUPABASE_SECRET_KEY: "secret",
      DATABASE_URL: "postgresql://example",
      CRON_SECRET: "cron",
      UPSTASH_REDIS_REST_URL: "https://redis.example",
      UPSTASH_REDIS_REST_TOKEN: "redis-token",
      GITHUB_APP_ID: "12345",
    };

    expect(() => assertProductionEnv(base)).toThrow(/GITHUB_TOKEN_ENCRYPTION_KEY/);
    expect(() =>
      assertProductionEnv({ ...base, GITHUB_TOKEN_ENCRYPTION_KEY: "token-key" }),
    ).not.toThrow();
  });
});
