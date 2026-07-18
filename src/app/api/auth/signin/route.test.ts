import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth/supabase", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        signInWithPassword: authMocks.signInWithPassword,
        signOut: authMocks.signOut,
      },
    }),
  ),
}));

vi.mock("@/server/services/profile-service", () => ({
  ensureProfileForAuthUser: authMocks.ensureProfile,
}));

vi.mock("@/server/security/rate-limit", () => ({
  assertRateLimit: vi.fn(() => Promise.resolve()),
  requestRateLimitIdentity: vi.fn(() => "test-client"),
}));

function signinRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/signin", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ email: "person@example.com", password: "password123" }),
  });
}

describe("signin route", () => {
  beforeEach(() => {
    authMocks.ensureProfile.mockReset();
    authMocks.signInWithPassword.mockReset();
    authMocks.signOut.mockReset();
  });

  it("signs in and ensures the application profile", async () => {
    authMocks.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "person@example.com",
          user_metadata: { name: "Person", time_zone: "UTC" },
        },
      },
      error: null,
    });
    authMocks.ensureProfile.mockResolvedValue({ id: "profile" });
    const { POST } = await import("./route");

    const response = await POST(signinRequest());

    expect(response.status).toBe(200);
    expect(authMocks.ensureProfile).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000001",
      email: "person@example.com",
      displayName: "Person",
      timeZone: "UTC",
    });
  });

  it("returns a retryable 503 when local Supabase is unavailable", async () => {
    authMocks.signInWithPassword.mockRejectedValue(new TypeError("fetch failed"));
    const { POST } = await import("./route");

    const response = await POST(signinRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INTERNAL_ERROR",
        message: "Authentication service is temporarily unavailable. Please try again.",
      },
    });
  });

  it("clears the local session when profile setup is unavailable", async () => {
    authMocks.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "person@example.com",
          user_metadata: {},
        },
      },
      error: null,
    });
    authMocks.ensureProfile.mockRejectedValue(new Error('relation "profiles" missing'));
    const { POST } = await import("./route");

    const response = await POST(signinRequest());

    expect(response.status).toBe(503);
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
