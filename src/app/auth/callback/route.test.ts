import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
  ensureProfile: vi.fn(),
}));

vi.mock("@/lib/auth/supabase", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        exchangeCodeForSession: authMocks.exchangeCodeForSession,
        signOut: authMocks.signOut,
      },
    }),
  ),
}));

vi.mock("@/server/services/profile-service", () => ({
  ensureProfileForAuthUser: authMocks.ensureProfile,
}));

const confirmedUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "explorer@example.com",
  user_metadata: { name: "Rudo Explorer", time_zone: "Australia/Sydney" },
};

function successfulExchange() {
  return { data: { user: confirmedUser, session: {} }, error: null };
}

function callbackRequest(search = ""): NextRequest {
  return new NextRequest(`https://rudo-quest.vercel.app/auth/callback${search}`);
}

describe("Supabase auth callback", () => {
  beforeEach(() => {
    authMocks.exchangeCodeForSession.mockReset();
    authMocks.signOut.mockReset();
    authMocks.ensureProfile.mockReset();
    authMocks.ensureProfile.mockResolvedValue({ id: confirmedUser.id });
  });

  it("exchanges a PKCE code and redirects to the dashboard", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue(successfulExchange());
    const { GET } = await import("./route");

    const response = await GET(callbackRequest("?code=one-time-code"));

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("one-time-code");
    expect(authMocks.ensureProfile).toHaveBeenCalledWith({
      id: confirmedUser.id,
      email: confirmedUser.email,
      displayName: confirmedUser.user_metadata.name,
      timeZone: confirmedUser.user_metadata.time_zone,
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://rudo-quest.vercel.app/dashboard",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("routes a valid recovery exchange to the password form", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue(successfulExchange());
    const { GET } = await import("./route");

    const response = await GET(
      callbackRequest("?code=recovery-code&next=%2Freset-password"),
    );

    expect(response.headers.get("location")).toBe(
      "https://rudo-quest.vercel.app/reset-password",
    );
  });

  it("does not accept arbitrary callback redirect targets", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue(successfulExchange());
    const { GET } = await import("./route");

    const response = await GET(
      callbackRequest("?code=one-time-code&next=https%3A%2F%2Fevil.example"),
    );

    expect(response.headers.get("location")).toBe(
      "https://rudo-quest.vercel.app/dashboard",
    );
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
      data: { user: null, session: null },
      error: { message: "invalid request" },
    });
    const { GET } = await import("./route");

    const response = await GET(callbackRequest("?code=invalid-code"));

    expect(response.headers.get("location")).toBe(
      "https://rudo-quest.vercel.app/login?error=confirmation_failed",
    );
  });

  it("clears a confirmed session when profile bootstrap fails", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue(successfulExchange());
    authMocks.ensureProfile.mockRejectedValue(new Error("database unavailable"));
    authMocks.signOut.mockResolvedValue({ error: null });
    const { GET } = await import("./route");

    const response = await GET(callbackRequest("?code=one-time-code"));

    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toBe(
      "https://rudo-quest.vercel.app/login?error=confirmation_failed",
    );
  });
});
