import type { NextRequest } from "next/server";
import { AppError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env/server";

const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Purpose: Normalize a URL to its origin for CSRF comparison.
 * Inputs: Optional URL string.
 * Output: Origin or null when missing or malformed.
 * Side effects: None.
 */
function toOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Purpose: Enforce same-origin browser mutations to reduce CSRF risk.
 * Inputs: NextRequest for a route handler.
 * Output: Void when the origin is accepted.
 * Side effects: None.
 * Business rule: An Origin that matches the request Host is always same-site:
 * browsers only emit a Host-consistent Origin on legitimate navigations, and
 * deployment platforms (Vercel previews, apex/www aliases) route arbitrary
 * hosts that NEXT_PUBLIC_APP_URL cannot enumerate. Cross-origin attackers
 * cannot forge a matching Host pair.
 * Failure behavior: Throws FORBIDDEN for cross-origin state-changing requests.
 */
export function assertSameOrigin(
  request: NextRequest,
  options: { allowMissingOrigin?: boolean } = {},
): void {
  if (!stateChangingMethods.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) {
    if (options.allowMissingOrigin) return;
    throw new AppError("FORBIDDEN", 403, "Request origin is required.");
  }
  const originUrl = toOrigin(origin);
  const host = request.headers.get("host");
  const hostOrigin = toOrigin(
    host ? `${request.nextUrl.protocol}//${host}` : request.nextUrl.origin,
  );
  // Same Host+Origin pair is trusted regardless of the configured app URL.
  if (originUrl && originUrl === hostOrigin) return;
  const expected = toOrigin(getServerEnv().NEXT_PUBLIC_APP_URL);
  if (originUrl && originUrl === expected) return;
  throw new AppError("FORBIDDEN", 403, "Request origin is not allowed.");
}
