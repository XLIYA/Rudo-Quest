import { describe, expect, it } from "vitest";
import { getSafePostLoginPath } from "./auth-form";

describe("getSafePostLoginPath", () => {
  it("allows internal app paths with search and hash", () => {
    expect(getSafePostLoginPath("/projects/123?tab=tasks#today")).toBe(
      "/projects/123?tab=tasks#today",
    );
  });

  it("rejects external and non-path redirects", () => {
    expect(getSafePostLoginPath("https://evil.example")).toBe("/dashboard");
    expect(getSafePostLoginPath("//evil.example/path")).toBe("/dashboard");
    expect(getSafePostLoginPath("javascript:alert(1)")).toBe("/dashboard");
    expect(getSafePostLoginPath(null)).toBe("/dashboard");
  });
});
