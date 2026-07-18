import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  commitProfileAssetUpload: vi.fn(),
  createProfileAssetUpload: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  from: vi.fn(),
  writeStructuredLog: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

vi.mock("@/lib/auth/supabase", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/server/observability/structured-log", () => ({
  writeStructuredLog: mocks.writeStructuredLog,
}));

vi.mock("@/server/profile-assets", () => ({
  assertProfileAssetBytes: vi.fn(),
  createProfileAssetUrlMap: vi.fn(),
  profileAssetUrl: vi.fn(),
}));

vi.mock("@/server/repositories/profile-repository", () => ({
  findProfileById: vi.fn(),
  isHandleAvailable: vi.fn(),
  suggestUsers: vi.fn(),
  updateProfileAssets: vi.fn(),
  updateProfileIdentity: vi.fn(),
  updateProfilePreferences: vi.fn(),
  upsertProfile: vi.fn(),
}));

vi.mock("@/server/repositories/profile-upload-repository", () => ({
  commitProfileAssetUpload: mocks.commitProfileAssetUpload,
  createProfileAssetUpload: mocks.createProfileAssetUpload,
  hasPendingProfileAssetUpload: vi.fn(),
}));

vi.mock("@/server/repositories/project-repository", () => ({
  findProjectRole: vi.fn(),
}));

import { createProfileUploadUrl } from "./profile-service";

const userId = "00000000-0000-4000-8000-000000000001";
const metadata = {
  fileName: "avatar.webp",
  contentType: "image/webp",
  size: 120_000,
  width: 512,
  height: 512,
};

describe("createProfileUploadUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ createSignedUploadUrl: mocks.createSignedUploadUrl });
    mocks.createSupabaseAdminClient.mockReturnValue({
      storage: { from: mocks.from },
    });
  });

  it("creates a private signed upload and records its lifecycle", async () => {
    mocks.createSignedUploadUrl.mockResolvedValue({
      data: {
        path: `${userId}/avatar-test.webp`,
        signedUrl: "https://storage.example/upload?token=signed",
        token: "signed",
      },
      error: null,
    });

    const result = await createProfileUploadUrl(userId, "avatar", metadata);

    expect(mocks.from).toHaveBeenCalledWith("profile-assets");
    expect(mocks.createSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${userId}/avatar-[0-9a-f-]+\\.webp$`, "i")),
      { upsert: false },
    );
    expect(mocks.createProfileAssetUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        kind: "avatar",
        path: expect.stringMatching(/\/avatar-[0-9a-f-]+\.webp$/i),
        expiresAt: expect.any(Date),
      }),
    );
    expect(result.token).toBe("signed");
  });

  it("reports safe storage diagnostics and returns a typed gateway failure", async () => {
    const storageError = Object.assign(new Error("Bucket not found"), {
      name: "StorageApiError",
      status: 400,
      statusCode: "NoSuchBucket",
    });
    mocks.createSignedUploadUrl.mockResolvedValue({ data: null, error: storageError });

    await expect(
      createProfileUploadUrl(userId, "avatar", metadata),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 502,
      message: "Profile image storage is temporarily unavailable.",
      cause: storageError,
    });
    expect(mocks.writeStructuredLog).toHaveBeenCalledWith("profile_upload_url_failed", {
      kind: "avatar",
      storageErrorName: "StorageApiError",
      storageStatus: "400",
      storageStatusCode: "NoSuchBucket",
    });
    expect(mocks.captureException).toHaveBeenCalledWith(storageError, {
      tags: { operation: "profile-upload-url", assetKind: "avatar" },
    });
    expect(mocks.createProfileAssetUpload).not.toHaveBeenCalled();
  });
});
