import { AppError } from "@/lib/api/errors";
import { createSupabaseAdminClient } from "@/lib/auth/supabase";
import { getServerEnv, getSupabaseAdminKey } from "@/lib/env/server";

const bucketName = "profile-assets";
const signedUrlTtlSeconds = 60 * 60;
const assetExtensions = new Set(["jpeg", "png", "webp"]);

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Purpose: Validate that a profile asset path belongs to a user and asset kind.
 * Inputs: User ID, asset kind, and Supabase Storage object path.
 * Output: Parsed folder and filename.
 * Side effects: None.
 * Failure behavior: Throws BAD_REQUEST for malformed or cross-user paths.
 */
export function parseProfileAssetPath(
  userId: string,
  kind: "avatar" | "banner",
  path: string,
): { folder: string; fileName: string } {
  const [folder, fileName, extra] = path.split("/");
  if (folder !== userId || !fileName || extra) {
    throw new AppError("BAD_REQUEST", 400, "Asset path is invalid.");
  }
  const prefix = `${kind}-`;
  if (!fileName.startsWith(prefix)) {
    throw new AppError("BAD_REQUEST", 400, "Asset path is invalid.");
  }
  const extension = fileName.split(".").at(-1);
  const id = fileName.slice(
    prefix.length,
    extension ? -(extension.length + 1) : undefined,
  );
  if (!extension || !assetExtensions.has(extension) || !isUuid(id)) {
    throw new AppError("BAD_REQUEST", 400, "Asset path is invalid.");
  }
  return { folder, fileName };
}

/**
 * Purpose: Confirm that a committed profile asset was actually uploaded.
 * Inputs: User ID, kind, and storage path.
 * Output: Void when the object exists.
 * Side effects: Reads Supabase Storage metadata.
 * Failure behavior: Throws BAD_REQUEST when the object is missing.
 */
export async function assertProfileAssetExists(
  userId: string,
  kind: "avatar" | "banner",
  path: string,
): Promise<void> {
  const { folder, fileName } = parseProfileAssetPath(userId, kind, path);
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(bucketName)
    .list(folder, { limit: 1, search: fileName });
  if (error || !data?.some((item) => item.name === fileName)) {
    throw new AppError("BAD_REQUEST", 400, "Uploaded asset was not found.");
  }
}

/**
 * Purpose: Create signed browser URLs for private profile asset paths.
 * Inputs: Storage paths from profile rows.
 * Output: Map from storage path to short-lived signed URL.
 * Side effects: Calls Supabase Storage when service credentials are configured.
 */
export async function createProfileAssetUrlMap(
  paths: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  const uniquePaths = Array.from(
    new Set(Array.from(paths).filter((path): path is string => Boolean(path))),
  );
  if (uniquePaths.length === 0 || !getSupabaseAdminKey(getServerEnv())) {
    return new Map();
  }
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(bucketName)
    .createSignedUrls(uniquePaths, signedUrlTtlSeconds);
  if (error || !data) return new Map();
  const urls = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export function profileAssetUrl(
  path: string | null | undefined,
  urls: Map<string, string>,
): string | null {
  return path ? (urls.get(path) ?? null) : null;
}
