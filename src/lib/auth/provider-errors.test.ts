import { describe, expect, it } from "vitest";
import {
  authProviderUnavailableError,
  isAuthProviderUnavailable,
} from "./provider-errors";

describe("Supabase Auth provider errors", () => {
  it("recognizes network and upstream failures", () => {
    expect(
      isAuthProviderUnavailable({
        name: "AuthRetryableFetchError",
        message: "fetch failed",
        status: 0,
      }),
    ).toBe(true);
    expect(isAuthProviderUnavailable({ message: "upstream failed", status: 503 })).toBe(
      true,
    );
  });

  it("does not mistake credential errors for an outage", () => {
    expect(
      isAuthProviderUnavailable({ message: "Invalid login credentials", status: 400 }),
    ).toBe(false);
  });

  it("keeps the provider failure as the safe 503 error cause", () => {
    const cause = new TypeError("fetch failed");
    const error = authProviderUnavailableError(cause);

    expect(error).toMatchObject({ code: "INTERNAL_ERROR", status: 503 });
    expect(error.cause).toBe(cause);
  });
});
