import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdminClient } from "@/lib/auth/supabase";
import {
  deleteExpiredProfileAssetUpload,
  listExpiredProfileAssetUploads,
} from "@/server/repositories/profile-upload-repository";

/**
 * Purpose: Remove expired objects created through signed profile upload URLs.
 * Inputs: Maximum cleanup batch size.
 * Output: Counts of removed objects and failed removal attempts.
 * Side effects: Deletes private Supabase Storage objects and their authorization rows.
 * Failure behavior: Captures individual storage failures and leaves their rows for retry.
 */
export async function cleanupExpiredProfileAssetUploads(limit = 100) {
  const uploads = await listExpiredProfileAssetUploads(limit);
  if (!uploads.length) return { removed: 0, failed: 0 };
  const storage = createSupabaseAdminClient().storage.from("profile-assets");
  let removed = 0;
  let failed = 0;
  for (const upload of uploads) {
    const { error } = await storage.remove([upload.path]);
    if (error) {
      failed += 1;
      Sentry.captureException(error, {
        tags: { operation: "expired-profile-upload-cleanup" },
        extra: { uploadId: upload.id },
      });
      continue;
    }
    await deleteExpiredProfileAssetUpload(upload.id);
    removed += 1;
  }
  return { removed, failed };
}
