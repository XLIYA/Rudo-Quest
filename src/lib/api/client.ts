"use client";

import type { ApiFailure, ApiSuccess } from "@/types/domain";

export type ApiClientError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId: string;
  status: number;
};

const requestTimeoutMs = 20_000;

/**
 * Purpose: Detect errors already normalized by the shared API client.
 * Inputs: Unknown caught value.
 * Output: Type predicate for ApiClientError.
 * Side effects: None.
 */
function isApiClientError(error: unknown): error is ApiClientError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "requestId" in error &&
    "status" in error
  );
}

/**
 * Purpose: Normalize any browser request failure into the single typed API error shape.
 * Inputs: Unknown caught error.
 * Output: ApiClientError for UI and mutation rollback handling.
 * Side effects: None.
 */
export function normalizeApiClientError(error: unknown): ApiClientError {
  if (isApiClientError(error)) return error;
  if (error instanceof Error) {
    return {
      code: error instanceof TypeError ? "NETWORK_ERROR" : "CLIENT_ERROR",
      message:
        error instanceof TypeError
          ? "Network request failed."
          : error.message || "Unexpected client error.",
      requestId: crypto.randomUUID(),
      status: 0,
    };
  }
  return {
    code: "UNKNOWN_ERROR",
    message: "Unexpected client error.",
    requestId: crypto.randomUUID(),
    status: 0,
  };
}

/**
 * Purpose: Send one same-origin request with credentials, request IDs, cancellation, and timeout handling.
 * Inputs: Method, URL, optional JSON body, and optional external AbortSignal.
 * Output: Typed API success payload data.
 * Side effects: Performs a browser fetch.
 * Failure behavior: Throws a normalized ApiClientError for HTTP, network, timeout, and malformed responses.
 */
async function apiRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, requestTimeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        "x-request-id": requestId,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (timedOut) {
      throw {
        code: "REQUEST_TIMEOUT",
        message: "The request took too long. Try again.",
        requestId,
        status: 0,
      } satisfies ApiClientError;
    }
    if (signal?.aborted) {
      throw {
        code: "REQUEST_ABORTED",
        message: "The request was cancelled.",
        requestId,
        status: 0,
      } satisfies ApiClientError;
    }
    const normalized = normalizeApiClientError(error);
    throw { ...normalized, requestId } satisfies ApiClientError;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }

  const payload = (await response.json().catch(() => null)) as
    ApiSuccess<T> | ApiFailure | null;
  const responseRequestId =
    (payload && "requestId" in payload ? payload.requestId : undefined) ??
    response.headers.get("x-request-id") ??
    requestId;

  if (!response.ok) {
    const failure = payload && "error" in payload ? payload : null;
    const normalized: ApiClientError = {
      code: failure?.error.code ?? "HTTP_ERROR",
      message: failure?.error.message ?? "The request could not be completed.",
      requestId: responseRequestId,
      status: response.status,
    };
    if (failure?.error.fieldErrors) {
      normalized.fieldErrors = failure.error.fieldErrors;
    }
    throw normalized;
  }

  if (!payload || !("data" in payload)) {
    throw {
      code: "INVALID_RESPONSE",
      message: "The server returned an invalid response.",
      requestId: responseRequestId,
      status: response.status,
    } satisfies ApiClientError;
  }
  return payload.data;
}

/**
 * Purpose: Fetch a typed API success payload with the shared browser client.
 * Inputs: URL and optional AbortSignal.
 * Output: Data payload.
 * Side effects: Performs same-origin HTTP GET.
 */
export function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>("GET", url, undefined, signal);
}

/**
 * Purpose: Send a typed API mutation with the shared browser client.
 * Inputs: HTTP method, URL, optional body, and AbortSignal.
 * Output: Data payload.
 * Side effects: Performs same-origin HTTP mutation.
 */
export function apiMutation<T>(
  method: "post" | "patch" | "delete",
  url: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (typeof window !== "undefined" && !navigator.onLine) {
    throw {
      code: "OFFLINE",
      message: "This action is unavailable while offline.",
      requestId: crypto.randomUUID(),
      status: 0,
    } satisfies ApiClientError;
  }
  return apiRequest<T>(
    method.toUpperCase() as "POST" | "PATCH" | "DELETE",
    url,
    body,
    signal,
  );
}
