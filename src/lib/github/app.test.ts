import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGitHubInstallationState,
  exchangeGitHubUserCode,
  getGitHubAuthorizationUrl,
  verifyGitHubInstallationState,
  verifyGitHubWebhookSignature,
} from "./app";

const structuredLog = vi.hoisted(() => ({
  writeStructuredLog: vi.fn(),
}));

vi.mock("@/server/observability/structured-log", () => structuredLog);

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GitHub webhook verification", () => {
  it("accepts valid sha256 signatures", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "secret");
    const body = JSON.stringify({ action: "created" });
    const signature = `sha256=${crypto.createHmac("sha256", "secret").update(body).digest("hex")}`;
    expect(verifyGitHubWebhookSignature(body, signature)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("rejects invalid signatures", () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "secret");
    expect(verifyGitHubWebhookSignature("{}", "sha256=bad")).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("GitHub user authorization URL", () => {
  it("uses the callback registered in GitHub instead of sending a mismatched URI", () => {
    vi.stubEnv("GITHUB_APP_ID", "123");
    vi.stubEnv("GITHUB_APP_SLUG", "rudo-quest-test");
    vi.stubEnv("GITHUB_APP_CLIENT_ID", "Iv1.test");
    vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "client-secret");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "private-key");
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "webhook-secret");

    const url = new URL(getGitHubAuthorizationUrl("signed-state"));

    expect(url.searchParams.get("client_id")).toBe("Iv1.test");
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.searchParams.has("redirect_uri")).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("GitHub user code exchange", () => {
  function configureClientCredentials() {
    vi.stubEnv("GITHUB_APP_CLIENT_ID", "Iv1.test");
    vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "client-secret");
  }

  it("returns the user token after a successful exchange", async () => {
    configureClientCredentials();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "ghu_test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(exchangeGitHubUserCode("one-time-code")).resolves.toBe("ghu_test");
    expect(structuredLog.writeStructuredLog).not.toHaveBeenCalled();
  });

  it("reports invalid client credentials as deployment configuration", async () => {
    configureClientCredentials();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "incorrect_client_credentials" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(exchangeGitHubUserCode("one-time-code")).rejects.toMatchObject({
      code: "INTEGRATION_NOT_CONFIGURED",
      status: 503,
      message: "GitHub App client credentials are invalid.",
    });
    expect(structuredLog.writeStructuredLog).toHaveBeenCalledWith(
      "github_oauth_exchange_failed",
      { upstreamError: "incorrect_client_credentials", upstreamStatus: 200 },
    );
  });

  it("asks the user to restart when GitHub rejects an expired code", async () => {
    configureClientCredentials();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "bad_verification_code" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(exchangeGitHubUserCode("expired-code")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message: "GitHub authorization expired. Start the connection again.",
    });
  });
});

describe("GitHub installation state", () => {
  it("round-trips signed state for the same user", () => {
    vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "client-secret");
    const userId = "00000000-0000-4000-8000-000000000001";

    const state = createGitHubInstallationState(userId);

    expect(verifyGitHubInstallationState(state, userId)).toMatchObject({ userId, v: 1 });
    vi.unstubAllEnvs();
  });

  it("rejects tampered or cross-user state", () => {
    vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "client-secret");
    const userId = "00000000-0000-4000-8000-000000000001";
    const state = createGitHubInstallationState(userId);

    expect(() => verifyGitHubInstallationState(`${state}x`, userId)).toThrow();
    expect(() =>
      verifyGitHubInstallationState(state, "00000000-0000-4000-8000-000000000002"),
    ).toThrow();
    vi.unstubAllEnvs();
  });
});
