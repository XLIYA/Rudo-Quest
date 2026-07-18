import crypto from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { getServerEnv, hasGitHubEnv } from "@/lib/env/server";
import { writeStructuredLog } from "@/server/observability/structured-log";

export type GitHubRepository = {
  id: number;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string | null;
};

export type GitHubInstallationInfo = {
  githubInstallationId: number;
  githubAccountLogin: string;
  githubAccountType: string;
};

export type GitHubInstallationState = {
  v: 1;
  userId: string;
  nonce: string;
  projectId?: string;
  exp: number;
};

const installationStateTtlSeconds = 10 * 60;
const githubRequestTimeoutMs = 15_000;
const githubOAuthErrorCodes = [
  "incorrect_client_credentials",
  "redirect_uri_mismatch",
  "bad_verification_code",
  "unverified_user_email",
] as const;

type GitHubOAuthErrorCode = (typeof githubOAuthErrorCodes)[number];

type GitHubOAuthTokenResponse = {
  access_token?: unknown;
  error?: unknown;
};

/**
 * Purpose: Restrict an untrusted GitHub OAuth error value to the documented safe codes.
 * Inputs: Unknown token-response error value.
 * Output: Known OAuth error code or "unknown".
 * Side effects: None.
 */
function normalizeGitHubOAuthError(value: unknown): GitHubOAuthErrorCode | "unknown" {
  return typeof value === "string" &&
    githubOAuthErrorCodes.includes(value as GitHubOAuthErrorCode)
    ? (value as GitHubOAuthErrorCode)
    : "unknown";
}

/**
 * Purpose: Send a bounded-duration request to GitHub.
 * Inputs: GitHub URL and standard fetch options.
 * Output: The upstream response without exposing credentials to the browser.
 * Side effects: Performs an outbound network request.
 * Failure behavior: Converts network and timeout failures into a safe gateway error.
 */
async function githubFetch(
  input: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(githubRequestTimeoutMs),
    });
  } catch {
    throw new AppError("INTERNAL_ERROR", 502, "GitHub is temporarily unavailable.");
  }
}

/**
 * Purpose: Resolve the secret used to authenticate installation state.
 * Inputs: None.
 * Output: Configured GitHub App client secret.
 * Side effects: Reads validated server environment state.
 * Failure behavior: Throws a typed 503 when GitHub is not configured.
 */
function getStateSecret(): string {
  const secret = getServerEnv().GITHUB_APP_CLIENT_SECRET;
  if (!secret) {
    throw new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      "GitHub App is not configured.",
    );
  }
  return secret;
}

/**
 * Purpose: Sign an encoded installation-state payload.
 * Inputs: URL-safe serialized state.
 * Output: Base64url HMAC signature.
 * Side effects: Reads the GitHub state secret.
 */
function signStatePayload(payload: string): string {
  return crypto
    .createHmac("sha256", getStateSecret())
    .update(payload)
    .digest("base64url");
}

/**
 * Purpose: Compare two signatures without leaking matching-prefix timing.
 * Inputs: Candidate and expected signature strings.
 * Output: True only when equal in length and contents.
 * Side effects: None.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.byteLength !== right.byteLength) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Purpose: Create a signed short-lived GitHub installation state token.
 * Inputs: Authenticated Rudo Quest user ID.
 * Output: URL-safe state string that binds the callback to the current user.
 * Side effects: None.
 * Failure behavior: Throws integration error when GitHub App credentials are missing.
 */
export function createGitHubInstallationState(
  userId: string,
  projectId?: string,
): string {
  const payload: GitHubInstallationState = {
    v: 1,
    userId,
    nonce: crypto.randomUUID(),
    ...(projectId ? { projectId } : {}),
    exp: Math.floor(Date.now() / 1000) + installationStateTtlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signStatePayload(encoded)}`;
}

/**
 * Purpose: Validate a GitHub installation state token returned to the callback.
 * Inputs: State token and current authenticated user ID.
 * Output: Decoded state when valid.
 * Side effects: None.
 * Failure behavior: Throws FORBIDDEN for missing, expired, tampered, or cross-user state.
 */
export function verifyGitHubInstallationState(
  state: string | undefined,
  userId: string,
): GitHubInstallationState {
  if (!state) {
    throw new AppError("FORBIDDEN", 403, "GitHub installation state is invalid.");
  }
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra) {
    throw new AppError("FORBIDDEN", 403, "GitHub installation state is invalid.");
  }
  if (!timingSafeStringEqual(signature, signStatePayload(payload))) {
    throw new AppError("FORBIDDEN", 403, "GitHub installation state is invalid.");
  }
  let parsed: GitHubInstallationState;
  try {
    parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as GitHubInstallationState;
  } catch {
    throw new AppError("FORBIDDEN", 403, "GitHub installation state is invalid.");
  }
  if (
    parsed.v !== 1 ||
    parsed.userId !== userId ||
    !parsed.nonce ||
    parsed.exp < Math.floor(Date.now() / 1000)
  ) {
    throw new AppError("FORBIDDEN", 403, "GitHub installation state is invalid.");
  }
  return parsed;
}

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
    throw new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      "GitHub App is not configured.",
    );
  }
  const appSlug = env.GITHUB_APP_SLUG;
  if (!appSlug) {
    throw new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      "GitHub App is not configured.",
    );
  }
  const url = new URL(
    `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`,
  );
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Purpose: Start the GitHub App user authorization leg used to prove installation ownership.
 * Inputs: One-time signed state token.
 * Output: GitHub OAuth authorization URL.
 * Side effects: None.
 * Failure behavior: Throws integration error when the app callback configuration is missing.
 */
export function getGitHubAuthorizationUrl(state: string): string {
  const env = getServerEnv();
  if (!hasGitHubEnv(env)) {
    throw new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      "GitHub App is not configured.",
    );
  }
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_APP_CLIENT_ID ?? "");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "read:user");
  return url.toString();
}

/**
 * Purpose: Encrypt a short-lived GitHub user token while the installation flow is in progress.
 * Inputs: GitHub user access token.
 * Output: Authenticated AES-GCM payload safe for server-side database storage.
 * Side effects: None.
 * Failure behavior: Throws integration error when the app secret is unavailable.
 */
export function encryptGitHubUserToken(token: string): string {
  const key = crypto.createHash("sha256").update(getStateSecret()).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

/**
 * Purpose: Decrypt a pending GitHub user token for installation ownership verification.
 * Inputs: Server-side encrypted token payload.
 * Output: Original GitHub user access token.
 * Side effects: None.
 * Failure behavior: Throws FORBIDDEN when the payload is malformed or tampered.
 */
export function decryptGitHubUserToken(value: string): string {
  try {
    const [ivValue, tagValue, ciphertextValue] = value.split(".");
    if (!ivValue || !tagValue || !ciphertextValue) throw new Error("invalid token");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      crypto.createHash("sha256").update(getStateSecret()).digest(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AppError("FORBIDDEN", 403, "GitHub authorization state is invalid.");
  }
}

/**
 * Purpose: Exchange a GitHub OAuth authorization code for a user access token.
 * Inputs: One-time GitHub authorization code.
 * Output: Short-lived flow token held only on the server.
 * Side effects: Calls GitHub's OAuth token endpoint.
 * Failure behavior: Throws a sanitized upstream error without exposing the token response.
 */
export async function exchangeGitHubUserCode(code: string): Promise<string> {
  const env = getServerEnv();
  if (!env.GITHUB_APP_CLIENT_ID || !env.GITHUB_APP_CLIENT_SECRET) {
    throw new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      "GitHub App is not configured.",
    );
  }
  const response = await githubFetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_APP_CLIENT_ID,
      client_secret: env.GITHUB_APP_CLIENT_SECRET,
      code,
    }),
    cache: "no-store",
  });
  let payload: GitHubOAuthTokenResponse = {};
  try {
    payload = (await response.json()) as GitHubOAuthTokenResponse;
  } catch {
    // A malformed upstream response is handled as a safe gateway failure below.
  }
  if (response.ok && typeof payload.access_token === "string" && payload.access_token) {
    return payload.access_token;
  }

  const upstreamError = normalizeGitHubOAuthError(payload.error);
  writeStructuredLog("github_oauth_exchange_failed", {
    upstreamError,
    upstreamStatus: response.status,
  });

  if (upstreamError === "incorrect_client_credentials") {
    throw new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      "GitHub App client credentials are invalid.",
    );
  }
  if (upstreamError === "redirect_uri_mismatch") {
    throw new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      "GitHub App callback URL is misconfigured.",
    );
  }
  if (upstreamError === "bad_verification_code") {
    throw new AppError(
      "FORBIDDEN",
      403,
      "GitHub authorization expired. Start the connection again.",
    );
  }
  if (upstreamError === "unverified_user_email") {
    throw new AppError(
      "FORBIDDEN",
      403,
      "Verify your primary GitHub email before connecting.",
    );
  }
  if (!response.ok) {
    throw new AppError(
      "INTERNAL_ERROR",
      502,
      "GitHub authorization is temporarily unavailable.",
    );
  }
  throw new AppError("FORBIDDEN", 403, "GitHub authorization could not be completed.");
}

/**
 * Purpose: List GitHub App installations visible to the authorized GitHub user.
 * Inputs: GitHub user access token.
 * Output: Numeric installation IDs.
 * Side effects: Calls GitHub's user installations endpoint.
 * Failure behavior: Throws a sanitized upstream error.
 */
export async function listUserInstallationIds(userToken: string): Promise<number[]> {
  const response = await githubFetch(
    "https://api.github.com/user/installations?per_page=100",
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${userToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new AppError("FORBIDDEN", 403, "GitHub installation authorization failed.");
  const payload = (await response.json()) as { installations?: { id?: number }[] };
  return (payload.installations ?? [])
    .map((installation) => installation.id)
    .filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id));
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
    throw new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      "GitHub App is not configured.",
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
    "base64url",
  );
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
export async function createInstallationToken(
  githubInstallationId: number,
): Promise<string> {
  const response = await githubFetch(
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
    throw new AppError(
      "INTERNAL_ERROR",
      502,
      "GitHub installation token request failed.",
    );
  }
  const payload = (await response.json()) as { token?: string };
  if (!payload.token)
    throw new AppError("INTERNAL_ERROR", 502, "GitHub token response was invalid.");
  return payload.token;
}

/**
 * Purpose: Fetch verified GitHub App installation metadata from GitHub.
 * Inputs: Numeric GitHub installation ID returned by the callback.
 * Output: Installation account metadata suitable for persistence.
 * Side effects: Calls GitHub's REST API with an app JWT.
 */
export async function getGitHubInstallationInfo(
  githubInstallationId: number,
): Promise<GitHubInstallationInfo> {
  const response = await githubFetch(
    `https://api.github.com/app/installations/${githubInstallationId}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${createGitHubAppJwt()}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new AppError("INTERNAL_ERROR", 502, "GitHub installation lookup failed.");
  }
  const payload = (await response.json()) as {
    id?: number;
    account?: {
      login?: string;
      type?: string;
    } | null;
  };
  if (!payload.id || !payload.account?.login || !payload.account.type) {
    throw new AppError(
      "INTERNAL_ERROR",
      502,
      "GitHub installation response was invalid.",
    );
  }
  return {
    githubInstallationId: payload.id,
    githubAccountLogin: payload.account.login,
    githubAccountType: payload.account.type,
  };
}

/**
 * Purpose: Verify a GitHub webhook HMAC signature.
 * Inputs: Raw request body and signature header.
 * Output: True when the signature matches.
 * Side effects: None.
 */
export function verifyGitHubWebhookSignature(
  body: string,
  signature: string | null,
): boolean {
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
export async function listInstallationRepositories(
  githubInstallationId: number,
): Promise<GitHubRepository[]> {
  if (!hasGitHubEnv()) {
    throw new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      "GitHub App is not configured.",
    );
  }
  if (!Number.isSafeInteger(githubInstallationId)) {
    throw new AppError("BAD_REQUEST", 400, "Installation ID is invalid.");
  }
  const token = await createInstallationToken(githubInstallationId);
  const repositories: GitHubRepository[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const url = new URL("https://api.github.com/installation/repositories");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const response = await githubFetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!response.ok)
      throw new AppError("INTERNAL_ERROR", 502, "GitHub repository listing failed.");
    const payload = (await response.json()) as {
      repositories?: {
        id: number;
        full_name: string;
        html_url: string;
        default_branch?: string | null;
      }[];
    };
    const pageRepositories = payload.repositories ?? [];
    repositories.push(
      ...pageRepositories.map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch ?? null,
      })),
    );
    if (pageRepositories.length < 100) break;
  }
  return repositories;
}

/**
 * Purpose: Resolve one repository from an installation-owned repository list.
 * Inputs: Numeric installation ID and repository ID.
 * Output: Repository metadata when the installation can access it.
 * Side effects: Calls GitHub's repository listing endpoint.
 */
export async function findInstallationRepository(
  githubInstallationId: number,
  repositoryId: number,
): Promise<GitHubRepository | null> {
  const repositories = await listInstallationRepositories(githubInstallationId);
  return repositories.find((repository) => repository.id === repositoryId) ?? null;
}
