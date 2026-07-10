import { describe, expect, it } from "vitest";
import { normalizeApiClientError, type ApiClientError } from "./client";

describe("normalizeApiClientError", () => {
  it("returns already-normalized API client errors unchanged", () => {
    const error: ApiClientError = {
      code: "VALIDATION_ERROR",
      message: "Validation failed.",
      requestId: "request-1",
      status: 400,
      fieldErrors: { title: ["Required"] },
    };

    expect(normalizeApiClientError(error)).toBe(error);
  });
});
