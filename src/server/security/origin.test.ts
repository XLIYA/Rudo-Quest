import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSameOrigin } from "./origin";

function postRequest(origin: string, host: string) {
  return new NextRequest(`https://${host}/api/auth/signup`, {
    method: "POST",
    headers: {
      host,
      origin,
    },
  });
}

describe("assertSameOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the request host when the configured app URL points at another Vercel alias", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rudo-quest-app.vercel.app");

    expect(() =>
      assertSameOrigin(
        postRequest("https://rudo-quest.vercel.app", "rudo-quest.vercel.app"),
      ),
    ).not.toThrow();
  });

  it("rejects cross-origin state-changing requests", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rudo-quest.vercel.app");

    expect(() =>
      assertSameOrigin(postRequest("https://evil.example", "rudo-quest.vercel.app")),
    ).toThrow("Request origin is not allowed.");
  });

  it("rejects state-changing requests with missing Origin header", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rudo-quest.vercel.app");

    const request = new NextRequest("https://rudo-quest.vercel.app/api/tasks", {
      method: "POST",
      headers: { host: "rudo-quest.vercel.app" },
    });

    expect(() => assertSameOrigin(request)).toThrow("Request origin is required.");
  });

  it("allows GET requests without Origin check", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rudo-quest.vercel.app");

    const getRequest = new NextRequest("https://rudo-quest.vercel.app/api/tasks", {
      method: "GET",
      headers: { host: "rudo-quest.vercel.app" },
    });

    expect(() => assertSameOrigin(getRequest)).not.toThrow();
  });

  it("allows PUT requests from the same origin", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rudo-quest.vercel.app");

    const putRequest = new NextRequest("https://rudo-quest.vercel.app/api/tasks/123", {
      method: "PUT",
      headers: {
        host: "rudo-quest.vercel.app",
        origin: "https://rudo-quest.vercel.app",
      },
    });

    expect(() => assertSameOrigin(putRequest)).not.toThrow();
  });

  it("allows PATCH requests from the same origin", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rudo-quest.vercel.app");

    const patchRequest = new NextRequest("https://rudo-quest.vercel.app/api/tasks/123", {
      method: "PATCH",
      headers: {
        host: "rudo-quest.vercel.app",
        origin: "https://rudo-quest.vercel.app",
      },
    });

    expect(() => assertSameOrigin(patchRequest)).not.toThrow();
  });

  it("allows DELETE requests from the same origin", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rudo-quest.vercel.app");

    const deleteRequest = new NextRequest("https://rudo-quest.vercel.app/api/tasks/123", {
      method: "DELETE",
      headers: {
        host: "rudo-quest.vercel.app",
        origin: "https://rudo-quest.vercel.app",
      },
    });

    expect(() => assertSameOrigin(deleteRequest)).not.toThrow();
  });
});
