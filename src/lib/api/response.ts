import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiFailure, ApiSuccess } from "@/types/domain";
import { AppError, normalizeAppError } from "./errors";

const requestIdPattern = /^[A-Za-z0-9._:-]{1,120}$/;

/**
 * Purpose: Generate a request ID for API tracing.
 * Inputs: Optional incoming request ID.
 * Output: Stable request ID string for the response.
 * Side effects: None.
 */
export function requestIdFrom(incoming: string | null): string {
  return incoming && requestIdPattern.test(incoming) ? incoming : crypto.randomUUID();
}

/**
 * Purpose: Serialize successful API data in Rudo Quest's standard response envelope.
 * Inputs: Typed payload, status code, optional metadata, and request ID.
 * Output: NextResponse containing ApiSuccess.
 * Side effects: Adds request ID header.
 */
export function apiSuccess<T>(
  data: T,
  init?: {
    status?: number;
    meta?: ApiSuccess<T>["meta"];
    requestId?: string;
  },
): NextResponse<ApiSuccess<T>> {
  const response = NextResponse.json(init?.meta ? { data, meta: init.meta } : { data }, {
    status: init?.status ?? 200,
  });
  if (init?.requestId) response.headers.set("x-request-id", init.requestId);
  return response;
}

/**
 * Purpose: Serialize application failures without exposing private implementation details.
 * Inputs: Unknown thrown value and request ID.
 * Output: NextResponse containing ApiFailure.
 * Side effects: Adds request ID header.
 */
export function apiFailure(error: unknown, requestId: string): NextResponse<ApiFailure> {
  const appError =
    error instanceof ZodError
      ? new AppError("VALIDATION_ERROR", 400, "Validation failed.", zodFieldErrors(error))
      : normalizeAppError(error);
  const unexpected = !(error instanceof AppError) && !(error instanceof ZodError);
  if (unexpected || appError.status >= 500) {
    if (process.env.NODE_ENV !== "test") {
      void import("@sentry/nextjs")
        .then((Sentry) =>
          Sentry.captureException(error, {
            tags: { requestId, errorCode: appError.code },
            extra: { status: appError.status },
          }),
        )
        .catch(() => undefined);
    }
    if (process.env.NODE_ENV !== "production") {
      console.error(`[api:${requestId}] Unhandled API error`, error);
    }
  }
  const response = NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
        fieldErrors: appError.fieldErrors,
      },
      requestId,
    },
    { status: appError.status },
  );
  response.headers.set("x-request-id", requestId);
  return response;
}

/**
 * Purpose: Convert Zod issues into the API field-error map.
 * Inputs: ZodError from request validation.
 * Output: Field path to messages map.
 * Side effects: None.
 */
export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "form";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}
