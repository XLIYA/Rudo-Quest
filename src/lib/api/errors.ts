export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTEGRATION_NOT_CONFIGURED"
  | "OFFLINE"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  /**
   * Purpose: Represent a typed application failure that can be serialized safely.
   * Inputs: Stable code, HTTP status, public message, and optional field errors.
   * Output: Error instance consumed by route handlers.
   * Side effects: None.
   */
  constructor(
    code: AppErrorCode,
    status: number,
    message: string,
    fieldErrors?: Record<string, string[]>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Purpose: Convert unknown thrown values into a safe public AppError.
 * Inputs: Unknown error value.
 * Output: AppError with sanitized code and message.
 * Side effects: None.
 * Debug: Logs the error type and code for root-cause analysis when falling through to INTERNAL_ERROR.
 */
export function normalizeAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    return new AppError("CONFLICT", 409, "That resource is already in use.");
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23503"
  ) {
    return new AppError("CONFLICT", 409, "That reference is no longer valid.");
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23514"
  ) {
    return new AppError("BAD_REQUEST", 400, "That value is not accepted.");
  }
  if (error instanceof Error && error.message.startsWith("INTEGRATION_NOT_CONFIGURED:")) {
    return new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      `${error.message.split(":")[1]} is not configured.`,
    );
  }
  // DEBUG: Log the raw error before defaulting to INTERNAL_ERROR (development only)
  if (process.env.NODE_ENV === "development") {
    console.error(
      "[normalizeAppError] UNHANDLED ERROR - type:",
      error instanceof Error ? error.constructor.name : typeof error,
      "- message:",
      error instanceof Error ? error.message : String(error),
      "- code:",
      (error as { code?: string }).code,
    );
  }
  return new AppError("INTERNAL_ERROR", 500, "Something went wrong.");
}
