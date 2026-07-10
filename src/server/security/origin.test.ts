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
});
