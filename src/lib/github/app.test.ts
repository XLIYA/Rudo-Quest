import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createGitHubInstallationState,
  getGitHubAuthorizationUrl,
  verifyGitHubInstallationState,
  verifyGitHubWebhookSignature,
} from "./app";

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
