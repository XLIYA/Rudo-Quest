import crypto from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { getServerEnv, hasGitHubEnv } from "@/lib/env/server";

export type GitHubRepository = {
  id: number;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string | null;
};

/**
 * Purpose: Create the GitHub App installation URL.
 * Inputs: Optional state token.
 * Output: GitHub installation URL.
 * Side effects: None.
 * Failure behavior: Throws integration error when GitHub App is missing.
 */
export function getGitHubInstallUrl(state: string): string {
  const env = getServerEnv();
  if (!hasGitHubEnv(env)) {
    throw new AppError("INTEGRATION_NOT_CONFIGURED", 503, "GitHub App is not configured.");
  }
  const url = new URL("https://github.com/apps/rudo-quest/installations/new");
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Purpose: Generate a short-lived GitHub App JWT for installation-token exchange.
 * Inputs: GitHub App ID and PEM private key from server environment.
 * Output: Signed JWT string.
 * Side effects: None.
 * Failure behavior: Throws integration error when GitHub App credentials are missing.
 */
export function createGitHubAppJwt(): string {
  const env = getServerEnv();
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new AppError("INTEGRATION_NOT_CONFIGURED", 503, "GitHub App is not configured.");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID }),
  ).toString("base64url");
  const key = env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(key, "base64url");
  return `${header}.${payload}.${signature}`;
}

/**
 * Purpose: Exchange the app JWT for a short-lived installation access token.
 * Inputs: Numeric GitHub installation ID.
 * Output: Installation access token.
 * Side effects: Calls GitHub's REST API.
 * Failure behavior: Throws integration or upstream failure without exposing secrets.
 */
export async function createInstallationToken(githubInstallationId: number): Promise<string> {
  const response = await fetch(
    `https://api.github.com/app/installations/${githubInstallationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${createGitHubAppJwt()}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new AppError("INTERNAL_ERROR", 502, "GitHub installation token request failed.");
  }
  const payload = (await response.json()) as { token?: string };
  if (!payload.token) throw new AppError("INTERNAL_ERROR", 502, "GitHub token response was invalid.");
  return payload.token;
}

/**
 * Purpose: Verify a GitHub webhook HMAC signature.
 * Inputs: Raw request body and signature header.
 * Output: True when the signature matches.
 * Side effects: None.
 */
export function verifyGitHubWebhookSignature(body: string, signature: string | null): boolean {
  const secret = getServerEnv().GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.byteLength !== expectedBuffer.byteLength) return false;
  return crypto.timingSafeEqual(provided, expectedBuffer);
}

/**
 * Purpose: Return repositories available to a GitHub installation.
 * Inputs: Installation database ID.
 * Output: Repository metadata list.
 * Side effects: Would call GitHub when credentials are present.
 * Failure behavior: Returns integration-not-configured rather than exposing tokens.
 */
export async function listInstallationRepositories(_installationId: string): Promise<GitHubRepository[]> {
  if (!hasGitHubEnv()) {
    throw new AppError("INTEGRATION_NOT_CONFIGURED", 503, "GitHub App is not configured.");
  }
  const installationNumber = Number(_installationId);
  if (!Number.isSafeInteger(installationNumber)) {
    throw new AppError("BAD_REQUEST", 400, "Installation ID is invalid.");
  }
  const token = await createInstallationToken(installationNumber);
  const response = await fetch("https://api.github.com/installation/repositories", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new AppError("INTERNAL_ERROR", 502, "GitHub repository listing failed.");
  const payload = (await response.json()) as {
    repositories?: {
      id: number;
      full_name: string;
      html_url: string;
      default_branch?: string | null;
    }[];
  };
  return (payload.repositories ?? []).map((repo) => ({
    id: repo.id,
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch ?? null,
  }));
}
