import { createSupabaseAdminClient } from "@/lib/auth/supabase";
import {
  deleteExpiredProfileAssetUpload,
  listExpiredProfileAssetUploads,
} from "@/server/repositories/profile-upload-repository";

/** Remove expired, uncommitted objects issued through signed upload URLs. */
export async function cleanupExpiredProfileAssetUploads(limit = 100) {
  const uploads = await listExpiredProfileAssetUploads(limit);
  if (!uploads.length) return { removed: 0 };
  const storage = createSupabaseAdminClient().storage.from("profile-assets");
  let removed = 0;
  for (const upload of uploads) {
    const { error } = await storage.remove([upload.path]);
    if (error) continue;
    await deleteExpiredProfileAssetUpload(upload.id);
    removed += 1;
  }
  return { removed };
}
