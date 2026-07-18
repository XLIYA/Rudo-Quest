import { describe, expect, it } from "vitest";
import { normalizeAppError } from "./errors";

describe("normalizeAppError", () => {
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
});
