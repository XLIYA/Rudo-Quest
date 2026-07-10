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
});
