import { describe, expect, it } from "vitest";
import { parseProfileAssetPath } from "./profile-assets";

const userId = "00000000-0000-4000-8000-000000000001";

describe("parseProfileAssetPath", () => {
  it("accepts generated asset paths for the current user and kind", () => {
    expect(
      parseProfileAssetPath(
        userId,
        "avatar",
        `${userId}/avatar-00000000-0000-4000-8000-000000000002.webp`,
      ),
    ).toEqual({
      folder: userId,
      fileName: "avatar-00000000-0000-4000-8000-000000000002.webp",
    });
  });

  it("rejects cross-user, wrong-kind, and unsupported-extension paths", () => {
    expect(() =>
      parseProfileAssetPath(
        userId,
        "avatar",
        "00000000-0000-4000-8000-000000000099/avatar-00000000-0000-4000-8000-000000000002.webp",
      ),
    ).toThrow();
    expect(() =>
      parseProfileAssetPath(
        userId,
        "avatar",
        `${userId}/banner-00000000-0000-4000-8000-000000000002.webp`,
      ),
    ).toThrow();
    expect(() =>
      parseProfileAssetPath(
        userId,
        "avatar",
        `${userId}/avatar-00000000-0000-4000-8000-000000000002.svg`,
      ),
    ).toThrow();
  });
});
