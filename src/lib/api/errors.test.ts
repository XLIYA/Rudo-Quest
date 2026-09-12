import { describe, expect, it, vi } from "vitest";
import { normalizeAppError } from "./errors";

describe("normalizeAppError", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes PostgreSQL check violations without exposing database details", () => {
    const error = {
      code: "23514",
      constraint: "projects_color_key",
      detail: "Failing row contains private values.",
    };

    expect(normalizeAppError(error)).toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      message: "That value is not accepted.",
    });
  });

  it("maps a Drizzle-wrapped PostgreSQL check violation to BAD_REQUEST", () => {
    // DrizzleQueryError wraps the original pg error on `.cause`; the code
    // lives one level deep, so top-level matching alone would yield a 500.
    const wrapped = new Error('Failed query: update "tasks" set "status" = $1');
    (wrapped as Error & { cause?: unknown }).cause = {
      code: "23514",
      constraint: "tasks_status",
      detail: "Failing row contains private values.",
    };

    expect(normalizeAppError(wrapped)).toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      message: "That value is not accepted.",
    });
  });

  it("maps a Drizzle-wrapped unique violation to CONFLICT", () => {
    const wrapped = new Error('Failed query: insert into "profiles" ...');
    (wrapped as Error & { cause?: unknown }).cause = {
      code: "23505",
      constraint: "profiles_email_unique",
    };

    expect(normalizeAppError(wrapped)).toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });

  it("still returns INTERNAL_ERROR when a wrapped error has no PostgreSQL code", () => {
    const wrapped = new Error("Failed query: select 1");
    (wrapped as Error & { cause?: unknown }).cause = new Error("connection refused");

    expect(normalizeAppError(wrapped)).toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
    });
  });

  it("does not call console.error in production mode", () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    normalizeAppError(new Error("Some unexpected error"));

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("calls console.error in development mode for unhandled errors", () => {
    vi.stubEnv("NODE_ENV", "development");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    normalizeAppError(new Error("Some unexpected error"));

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("returns INTERNAL_ERROR for unknown error types", () => {
    const result = normalizeAppError({ unknown: "error" });

    expect(result).toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Something went wrong.",
    });
  });
});
