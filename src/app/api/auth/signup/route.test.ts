import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signOut: vi.fn(),
  ensureProfile: vi.fn(),
}));

vi.mock("@/lib/auth/supabase", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        signUp: authMocks.signUp,
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

function signupRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({
      email: "new@example.com",
      password: "password123",
      displayName: "New User",
      timeZone: "UTC",
    }),
  });
}

describe("signup route", () => {
  beforeEach(() => {
    authMocks.signUp.mockReset();
    authMocks.signOut.mockReset();
    authMocks.ensureProfile.mockReset();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rudo-quest.vercel.app");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns created when Supabase creates a user", async () => {
    authMocks.signUp.mockResolvedValue({
      data: {
        user: { id: "00000000-0000-4000-8000-000000000001" },
        session: null,
      },
      error: null,
    });
    const { POST } = await import("./route");

    const response = await POST(signupRequest());

    expect(response.status).toBe(201);
    expect(authMocks.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
      options: {
        data: { name: "New User", time_zone: "UTC" },
        emailRedirectTo: "https://rudo-quest.vercel.app/auth/callback",
      },
    });
    await expect(response.json()).resolves.toEqual({
      data: { ok: true, requiresEmailVerification: true },
    });
  });

  it("bootstraps an autoconfirmed local user without requiring email verification", async () => {
    authMocks.signUp.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "new@example.com",
        },
        session: { access_token: "local-session" },
      },
      error: null,
    });
    authMocks.ensureProfile.mockResolvedValue({ id: "profile" });
    const { POST } = await import("./route");

    const response = await POST(signupRequest());

    expect(authMocks.ensureProfile).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000001",
      email: "new@example.com",
      displayName: "New User",
      timeZone: "UTC",
    });
    await expect(response.json()).resolves.toEqual({
      data: { ok: true, requiresEmailVerification: false },
    });
  });

  it("does not report success when Supabase rejects signup", async () => {
    authMocks.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: "email already registered" },
    });
    const { POST } = await import("./route");

    const response = await POST(signupRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "BAD_REQUEST",
        message: "Sign up could not be completed.",
      },
    });
  });

  it("returns a retryable 503 when local Supabase is unavailable", async () => {
    authMocks.signUp.mockRejectedValue(new TypeError("fetch failed"));
    const { POST } = await import("./route");

    const response = await POST(signupRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "INTERNAL_ERROR",
        message: "Authentication service is temporarily unavailable. Please try again.",
      },
    });
  });

  it("clears the local session when profile setup is unavailable", async () => {
    authMocks.signUp.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "new@example.com",
        },
        session: { access_token: "local-session" },
      },
      error: null,
    });
    authMocks.ensureProfile.mockRejectedValue(new Error('relation "profiles" missing'));
    const { POST } = await import("./route");

    const response = await POST(signupRequest());

    expect(response.status).toBe(503);
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
