import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/auth/supabase", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        exchangeCodeForSession: authMocks.exchangeCodeForSession,
      },
    }),
  ),
}));

function callbackRequest(search = ""): NextRequest {
  return new NextRequest(`https://rudo-quest.vercel.app/auth/callback${search}`);
}

describe("Supabase auth callback", () => {
  beforeEach(() => {
    authMocks.exchangeCodeForSession.mockReset();
  });

  it("exchanges a PKCE code and redirects to the dashboard", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("./route");

    const response = await GET(callbackRequest("?code=one-time-code"));

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("one-time-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://rudo-quest.vercel.app/dashboard",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("maps an expired confirmation to a clean login error", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      callbackRequest(
        "?error=access_denied&error_code=otp_expired&error_description=private-detail",
      ),
    );

    expect(authMocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://rudo-quest.vercel.app/login?error=confirmation_expired",
    );
  });

  it("handles a rejected code without exposing callback details", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid request" },
    });
    const { GET } = await import("./route");

    const response = await GET(callbackRequest("?code=invalid-code"));

    expect(response.headers.get("location")).toBe(
      "https://rudo-quest.vercel.app/login?error=confirmation_failed",
    );
  });
});
