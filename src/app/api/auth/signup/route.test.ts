import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  signUp: vi.fn(),
}));

vi.mock("@/lib/auth/supabase", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        signUp: authMocks.signUp,
      },
    }),
  ),
}));

vi.mock("@/server/security/rate-limit", () => ({
  assertRateLimit: vi.fn(() => Promise.resolve()),
}));

function signupRequest(): NextRequest {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "new@example.com",
      password: "password123",
      displayName: "New User",
    }),
  }) as NextRequest;
}

describe("signup route", () => {
  beforeEach(() => {
    authMocks.signUp.mockReset();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rudo-quest.vercel.app");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns created when Supabase creates a user", async () => {
    authMocks.signUp.mockResolvedValue({
      data: { user: { id: "00000000-0000-4000-8000-000000000001" } },
      error: null,
    });
    const { POST } = await import("./route");

    const response = await POST(signupRequest());

    expect(response.status).toBe(201);
    expect(authMocks.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
      options: {
        data: { name: "New User" },
        emailRedirectTo: "https://rudo-quest.vercel.app/auth/callback",
      },
    });
    await expect(response.json()).resolves.toEqual({ data: { ok: true } });
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
});
