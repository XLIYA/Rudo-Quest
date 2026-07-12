import { AppError } from "@/lib/api/errors";
import { createSupabaseAdminClient } from "@/lib/auth/supabase";
import { getServerEnv, getSupabaseAdminKey } from "@/lib/env/server";
import { uploadMetadataSchema } from "@/lib/validation/common";
import type { BannerPresetKey, ProfileSummary } from "@/types/domain";
import {
  assertProfileAssetBytes,
  createProfileAssetUrlMap,
  profileAssetUrl,
} from "@/server/profile-assets";
import {
  findProfileById,
  isHandleAvailable,
  suggestUsers,
  updateProfileAssets,
  updateProfileIdentity,
  updateProfilePreferences,
  upsertProfile,
} from "@/server/repositories/profile-repository";

/**
 * Purpose: Derive a safe default handle from an email address.
 * Inputs: User email and auth ID.
 * Output: Lowercase handle candidate.
 * Side effects: None.
 */
export function deriveHandle(email: string, id: string): string {
  const local =
    email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-") ?? "rudo";
  const trimmed = local.replace(/-+/g, "-").slice(0, 20).replace(/^-|-$/g, "");
  return `${trimmed || "rudo"}-${id.slice(0, 6).toLowerCase()}`;
}

/**
 * Purpose: Create the application profile for a verified Supabase user.
 * Inputs: Auth user ID, email, and optional display name.
 * Output: Profile row.
 * Side effects: Inserts profile once; no-op when present.
 * Failure behavior: Propagates database validation errors as safe API failures upstream.
 */
export async function ensureProfileForAuthUser(input: {
  id: string;
  email: string;
  displayName?: unknown;
}) {
  const fallbackName = input.email.split("@")[0] || "Rudo Explorer";
  return upsertProfile({
    id: input.id,
    email: input.email,
    handle: deriveHandle(input.email, input.id),
    displayName: typeof input.displayName === "string" ? input.displayName : fallbackName,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
}

/**
 * Purpose: Read the current user's application profile.
 * Inputs: User ID.
 * Output: Profile row.
 * Side effects: Reads database.
 * Failure behavior: Throws NOT_FOUND when profile bootstrap failed.
 */
export async function getMyProfile(userId: string) {
  const profile = await findProfileById(userId);
  if (!profile) throw new AppError("NOT_FOUND", 404, "Profile not found.");
  return serializeProfile(profile);
}

/**
 * Purpose: Update current user's display name and handle.
 * Inputs: User ID and validated identity fields.
 * Output: Updated profile row.
 * Side effects: Writes profile identity fields.
 * Failure behavior: Throws CONFLICT for duplicate handles.
 */
export async function updateMyProfile(
  userId: string,
  values: { displayName?: string; handle?: string },
) {
  if (values.handle && !(await isHandleAvailable(values.handle, userId))) {
    throw new AppError("CONFLICT", 409, "Handle is already in use.", {
      handle: ["Handle is already in use."],
    });
  }
  const profile = await updateProfileIdentity(userId, values);
  if (!profile) throw new AppError("NOT_FOUND", 404, "Profile not found.");
  return serializeProfile(profile);
}

/**
 * Purpose: Update theme, timezone, and notification preferences.
 * Inputs: User ID and validated preference fields.
 * Output: Updated profile row.
 * Side effects: Writes profile preferences.
 */
export async function updateMyPreferences(
  userId: string,
  values: Parameters<typeof updateProfilePreferences>[1],
) {
  const profile = await updateProfilePreferences(userId, values);
  if (!profile) throw new AppError("NOT_FOUND", 404, "Profile not found.");
  return serializeProfile(profile);
}

/**
 * Purpose: Search public user suggestions for invitation flows.
 * Inputs: Search query and optional project exclusion.
 * Output: Profile summaries.
 * Side effects: Reads profiles.
 */
export async function searchUserSuggestions(input: {
  q: string;
  excludeProjectId?: string;
  memberProjectId?: string;
}): Promise<ProfileSummary[]> {
  return suggestUsers(input);
}

/**
 * Purpose: Create a signed Supabase Storage upload URL for avatar or banner assets.
 * Inputs: User ID, target kind, and validated image metadata.
 * Output: Storage path and signed URL.
 * Side effects: Creates a short-lived upload URL in Supabase Storage.
 * Failure behavior: Throws integration error when Supabase admin storage is unavailable.
 */
export async function createProfileUploadUrl(
  userId: string,
  kind: "avatar" | "banner",
  metadata: unknown,
): Promise<{ path: string; signedUrl: string; token: string }> {
  const parsed = uploadMetadataSchema.parse(metadata);
  const extension = parsed.contentType.split("/")[1];
  const path = `${userId}/${kind}-${crypto.randomUUID()}.${extension}`;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from("profile-assets")
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data) throw new AppError("INTERNAL_ERROR", 500, "Upload URL failed.");
  return { path, signedUrl: data.signedUrl, token: data.token };
}

/**
 * Purpose: Persist uploaded avatar/banner paths and remove old assets after replacement.
 * Inputs: User ID, asset kind, and new storage path.
 * Output: Updated profile row.
 * Side effects: Updates profile and best-effort deletes previous Supabase Storage object.
 */
export async function commitProfileAsset(
  userId: string,
  kind: "avatar" | "banner",
  path: string | null,
) {
  if (path) await assertProfileAssetBytes(userId, kind, path);
  const current = await findProfileById(userId);
  if (!current) throw new AppError("NOT_FOUND", 404, "Profile not found.");
  const oldPath = kind === "avatar" ? current.avatarPath : current.bannerPath;
  const updated = await updateProfileAssets(userId, {
    ...(kind === "avatar"
      ? { avatarPath: path }
      : { bannerPath: path, bannerPresetKey: null }),
  });
  if (!updated) throw new AppError("NOT_FOUND", 404, "Profile not found.");
  const env = getServerEnv();
  if (oldPath && oldPath !== path && getSupabaseAdminKey(env)) {
    await createSupabaseAdminClient().storage.from("profile-assets").remove([oldPath]);
  }
  return serializeProfile(updated);
}

/**
 * Purpose: Select a curated banner preset and retire any uploaded banner asset.
 * Inputs: Current user ID and allowlisted preset key.
 * Output: Updated profile with the preset selected.
 * Side effects: Clears the uploaded banner path and removes the old private object.
 * Failure behavior: Throws NOT_FOUND when the profile is missing.
 */
export async function setProfileBannerPreset(userId: string, presetKey: BannerPresetKey) {
  const current = await findProfileById(userId);
  if (!current) throw new AppError("NOT_FOUND", 404, "Profile not found.");
  const updated = await updateProfileAssets(userId, {
    bannerPath: null,
    bannerPresetKey: presetKey,
  });
  if (!updated) throw new AppError("NOT_FOUND", 404, "Profile not found.");
  if (current.bannerPath && getSupabaseAdminKey(getServerEnv())) {
    await createSupabaseAdminClient()
      .storage.from("profile-assets")
      .remove([current.bannerPath]);
  }
  return serializeProfile(updated);
}

async function serializeProfile(
  profile: NonNullable<Awaited<ReturnType<typeof findProfileById>>>,
) {
  const urls = await createProfileAssetUrlMap([profile.avatarPath, profile.bannerPath]);
  return {
    ...profile,
    avatarPath: profileAssetUrl(profile.avatarPath, urls),
    bannerPath: profileAssetUrl(profile.bannerPath, urls),
  };
}
