import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyGitHubWebhookSignature } from "./app";

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
