import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { profileAssetUploads, profiles } from "@/db/schema";
import { getDb } from "@/lib/db/client";
import type { BannerPresetKey } from "@/types/domain";

/**
 * Purpose: Record a short-lived signed profile-asset upload authorization.
 * Inputs: User, private storage path, asset kind, and expiration.
 * Output: Persisted upload record.
 * Side effects: Inserts a database row.
 */
export async function createProfileAssetUpload(input: {
  userId: string;
  path: string;
  kind: "avatar" | "banner";
  expiresAt: Date;
}) {
  const [created] = await getDb().insert(profileAssetUploads).values(input).returning();
  return created;
}

/**
 * Purpose: Verify that an uploaded path still has an uncommitted authorization.
 * Inputs: User, path, and asset kind.
 * Output: True only for a matching non-expired pending upload.
 * Side effects: Reads the database.
 */
export async function hasPendingProfileAssetUpload(input: {
  userId: string;
  path: string;
  kind: "avatar" | "banner";
}): Promise<boolean> {
  const rows = await getDb()
    .select({ id: profileAssetUploads.id })
    .from(profileAssetUploads)
    .where(
      and(
        eq(profileAssetUploads.userId, input.userId),
        eq(profileAssetUploads.path, input.path),
        eq(profileAssetUploads.kind, input.kind),
        isNull(profileAssetUploads.committedAt),
        gt(profileAssetUploads.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Purpose: Atomically attach a validated upload to a profile and consume its authorization.
 * Inputs: Upload identity and profile asset fields to update.
 * Output: Updated profile or null when the authorization/profile no longer exists.
 * Side effects: Locks and updates upload/profile rows in one transaction.
 */
export async function commitProfileAssetUpload(
  input: {
    userId: string;
    path: string;
    kind: "avatar" | "banner";
  },
  values: {
    avatarPath?: string | null;
    bannerPath?: string | null;
    bannerPresetKey?: BannerPresetKey | null;
  },
) {
  return getDb().transaction(async (tx) => {
    const [upload] = await tx
      .select({ id: profileAssetUploads.id })
      .from(profileAssetUploads)
      .where(
        and(
          eq(profileAssetUploads.userId, input.userId),
          eq(profileAssetUploads.path, input.path),
          eq(profileAssetUploads.kind, input.kind),
          isNull(profileAssetUploads.committedAt),
          gt(profileAssetUploads.expiresAt, new Date()),
        ),
      )
      .for("update")
      .limit(1);
    if (!upload) return null;
    const [updated] = await tx
      .update(profiles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(profiles.id, input.userId))
      .returning();
    if (!updated) return null;
    await tx
      .update(profileAssetUploads)
      .set({ committedAt: new Date() })
      .where(eq(profileAssetUploads.id, upload.id));
    return updated;
  });
}

/**
 * Purpose: Find abandoned signed uploads eligible for storage cleanup.
 * Inputs: Maximum batch size.
 * Output: Expired upload IDs and object paths.
 * Side effects: Reads the database.
 */
export async function listExpiredProfileAssetUploads(limit = 100) {
  return getDb()
    .select({ id: profileAssetUploads.id, path: profileAssetUploads.path })
    .from(profileAssetUploads)
    .where(
      and(
        isNull(profileAssetUploads.committedAt),
        lte(profileAssetUploads.expiresAt, new Date()),
      ),
    )
    .orderBy(profileAssetUploads.expiresAt)
    .limit(limit);
}

/**
 * Purpose: Remove an expired upload authorization after its object is cleaned up.
 * Inputs: Upload row ID.
 * Output: Void.
 * Side effects: Deletes one still-uncommitted database row.
 */
export async function deleteExpiredProfileAssetUpload(id: string): Promise<void> {
  await getDb()
    .delete(profileAssetUploads)
    .where(and(eq(profileAssetUploads.id, id), isNull(profileAssetUploads.committedAt)));
}
