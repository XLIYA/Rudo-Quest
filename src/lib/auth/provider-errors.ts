import { AppError } from "@/lib/api/errors";

/**
 * Purpose: Identify Supabase Auth transport and upstream availability failures.
 * Inputs: A thrown value or Supabase Auth error result.
 * Output: True only for retryable network or upstream service failures.
 * Side effects: None.
 */
export function isAuthProviderUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
    status?: unknown;
  };
  const status = Number(candidate.status);
  if (status === 0 || (status >= 500 && status <= 599)) return true;
  const fingerprint = [candidate.name, candidate.code, candidate.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return /retryablefetch|fetch failed|econnrefused|enotfound|network error|timed? ?out/.test(
    fingerprint,
  );
}

/**
 * Purpose: Convert a Supabase availability failure into a safe retryable API response.
 * Inputs: Original provider error for server-side diagnostics.
 * Output: HTTP 503 AppError with the original failure attached as its cause.
 * Side effects: None.
 */
export function authProviderUnavailableError(cause: unknown): AppError {
  return new AppError(
    "INTERNAL_ERROR",
    503,
    "Authentication service is temporarily unavailable. Please try again.",
    undefined,
    { cause },
  );
}
