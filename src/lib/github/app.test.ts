import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createGitHubInstallationState,
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
