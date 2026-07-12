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
  ) {
    super(message);
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
  if (error instanceof Error && error.message.startsWith("INTEGRATION_NOT_CONFIGURED:")) {
    return new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      `${error.message.split(":")[1]} is not configured.`,
    );
  }
  return new AppError("INTERNAL_ERROR", 500, "Something went wrong.");
}
