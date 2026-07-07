import type { NextRequest, NextResponse } from "next/server";
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
): Promise<NextResponse> {
  const requestId = requestIdFrom(request.headers.get("x-request-id"));
  try {
    assertSameOrigin(request);
    const response = await handler(requestId);
    response.headers.set("x-request-id", requestId);
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
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const { AppError } = await import("@/lib/api/errors");
    throw new AppError("BAD_REQUEST", 400, "Request body must be valid JSON.");
  }
}
