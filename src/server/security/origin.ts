import type { NextRequest } from "next/server";
import { AppError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env/server";

const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function toOrigin(value: string | undefined): string | null {
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
 * Failure behavior: Throws FORBIDDEN for cross-origin state-changing requests.
 */
export function assertSameOrigin(request: NextRequest): void {
  if (!stateChangingMethods.has(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const expected = getServerEnv().NEXT_PUBLIC_APP_URL;
  const host = request.headers.get("host");
  const fallback = host ? `${request.nextUrl.protocol}//${host}` : request.nextUrl.origin;
  const allowedOrigins = new Set(
    [toOrigin(expected), toOrigin(fallback)].filter((value): value is string => Boolean(value)),
  );
  if (!allowedOrigins.has(origin)) {
    throw new AppError("FORBIDDEN", 403, "Request origin is not allowed.");
  }
}
