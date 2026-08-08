import * as Sentry from "@sentry/nextjs";
import { createSupabaseAdminClient } from "@/lib/auth/supabase";
import {
  deleteExpiredTaskAttachmentUpload,
  listExpiredTaskAttachmentUploads,
} from "@/server/repositories/task-attachment-repository";
import { taskAttachmentBucket } from "@/server/task-attachments";

/** Remove abandoned task upload objects while retaining failures for the next retry. */
export async function cleanupExpiredTaskAttachmentUploads(limit = 100) {
  const uploads = await listExpiredTaskAttachmentUploads(limit);
  if (!uploads.length) return { removed: 0, failed: 0 };
  const storage = createSupabaseAdminClient().storage.from(taskAttachmentBucket);
  let removed = 0;
  let failed = 0;
  for (const upload of uploads) {
    const { error } = await storage.remove([upload.storagePath]);
    if (error) {
      failed += 1;
      Sentry.captureException(error, {
        tags: { operation: "expired-task-attachment-cleanup" },
        extra: { uploadId: upload.id },
      });
      continue;
    }
    await deleteExpiredTaskAttachmentUpload(upload.id);
    removed += 1;
  }
  return { removed, failed };
}
