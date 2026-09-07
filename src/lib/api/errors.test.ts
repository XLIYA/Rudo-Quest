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
