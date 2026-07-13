import type { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/api/errors";
import { apiFailure, requestIdFrom } from "@/lib/api/response";
import { assertSameOrigin } from "@/server/security/origin";

/**
 * Purpose: Wrap route-handler logic with request IDs, origin validation, and safe error serialization.
 * Inputs: NextRequest and a typed handler function.
 * Output: NextResponse produced by the handler or by standardized failure handling.
 * Side effects: Adds request tracing headers.
 * Failure behavior: Converts thrown values into ApiFailure.
 */
export async function withApiHandler(
  request: NextRequest,
  handler: (requestId: string) => Promise<NextResponse>,
  options: { allowMissingOrigin?: boolean } = {},
): Promise<NextResponse> {
  const requestId = requestIdFrom(request.headers.get("x-request-id"));
  try {
    assertSameOrigin(request, options);
    const response = await handler(requestId);
    response.headers.set("x-request-id", requestId);
    response.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    response.headers.set("Expires", "0");
    response.headers.set("Pragma", "no-cache");
    return response;
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

/**
 * Purpose: Read and parse a JSON request body while treating empty bodies as an empty object.
 * Inputs: Fetch Request object.
 * Output: Unknown JSON value suitable for Zod parsing.
 * Side effects: Consumes the request body stream.
 * Failure behavior: Throws BAD_REQUEST when JSON parsing fails.
 */
export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const text = await readBoundedText(request, maxBytes);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("BAD_REQUEST", 400, "Request body must be valid JSON.");
  }
}

/**
 * Purpose: Read a bounded UTF-8 text body for signed webhook verification.
 * Inputs: Fetch Request and maximum accepted bytes.
 * Output: Raw body text.
 * Side effects: Consumes the request body stream.
 * Failure behavior: Throws BAD_REQUEST when the body exceeds the limit.
 */
export async function readText(request: Request, maxBytes = 1_000_000): Promise<string> {
  return readBoundedText(request, maxBytes);
}

/**
 * Purpose: Consume a request body while enforcing a byte limit during streaming.
 * Inputs: Fetch Request and maximum allowed bytes.
 * Output: Decoded UTF-8 body text.
 * Side effects: Consumes and releases the body stream reader.
 * Failure behavior: Cancels the stream and throws a typed 413 when oversized.
 */
async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AppError("BAD_REQUEST", 413, "Request body is too large.");
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new AppError("BAD_REQUEST", 413, "Request body is too large.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
