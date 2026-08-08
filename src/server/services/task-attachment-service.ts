import { AppError } from "@/lib/api/errors";
import { createSupabaseAdminClient } from "@/lib/auth/supabase";
import {
  createTaskLinkAttachmentSchema,
  taskAttachmentUploadMetadataSchema,
} from "@/lib/validation/tasks";
import {
  commitTaskAttachmentUpload,
  createTaskAttachmentUpload,
  deleteTaskAttachmentRow,
  findPendingTaskAttachmentUpload,
  findTaskAttachmentRow,
  insertTaskLinkAttachment,
  listTaskAttachmentRows,
} from "@/server/repositories/task-attachment-repository";
import {
  assertTaskAttachmentBytes,
  removeTaskAttachmentObject,
  taskAttachmentBucket,
} from "@/server/task-attachments";
import { getTask, getVisibleTask } from "./task-service";

async function requireAttachmentEditor(userId: string, taskId: string) {
  const task = await getTask(userId, taskId);
  if (!task.permissions.canEditDetails) {
    throw new AppError("FORBIDDEN", 403, "Cannot manage attachments for this task.");
  }
  return task;
}

/** Return attachments for any active or archived task visible to the viewer. */
export async function getTaskAttachments(userId: string, taskId: string) {
  await getVisibleTask(userId, taskId);
  return listTaskAttachmentRows(taskId);
}

/** Add a validated external http(s) reference to an editable task. */
export async function createTaskLinkAttachment(
  userId: string,
  taskId: string,
  input: unknown,
) {
  await requireAttachmentEditor(userId, taskId);
  const parsed = createTaskLinkAttachmentSchema.parse(input);
  return insertTaskLinkAttachment({ taskId, userId, ...parsed });
}

/** Issue a short-lived private upload URL bound to one task, user, and metadata tuple. */
export async function createTaskFileUpload(
  userId: string,
  taskId: string,
  metadata: unknown,
): Promise<{ uploadId: string; path: string; signedUrl: string; token: string }> {
  await requireAttachmentEditor(userId, taskId);
  const parsed = taskAttachmentUploadMetadataSchema.parse(metadata);
  const extension = parsed.fileName.toLowerCase().split(".").at(-1);
  if (!extension) throw new AppError("BAD_REQUEST", 400, "File extension is required.");
  const storagePath = `${taskId}/${userId}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(taskAttachmentBucket)
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      502,
      "Attachment storage is temporarily unavailable.",
      undefined,
      { cause: error ?? new Error("Storage returned no signed upload URL.") },
    );
  }
  const upload = await createTaskAttachmentUpload({
    taskId,
    userId,
    storagePath,
    fileName: parsed.fileName,
    mimeType: parsed.contentType,
    sizeBytes: parsed.size,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  });
  return {
    uploadId: upload.id,
    path: storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
  };
}

/** Verify uploaded bytes and atomically consume the pending authorization into a file row. */
export async function commitTaskFileAttachment(
  userId: string,
  taskId: string,
  uploadId: string,
) {
  await requireAttachmentEditor(userId, taskId);
  const upload = await findPendingTaskAttachmentUpload({ uploadId, taskId, userId });
  if (!upload) throw new AppError("BAD_REQUEST", 400, "Upload is invalid or expired.");
  await assertTaskAttachmentBytes({
    storagePath: upload.storagePath,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
  });
  const attachment = await commitTaskAttachmentUpload({ uploadId, taskId, userId });
  if (!attachment) {
    throw new AppError("CONFLICT", 409, "Upload was already committed or expired.");
  }
  return attachment;
}

/** Delete an attachment after resolving and authorizing its immutable parent task. */
export async function deleteTaskAttachment(
  userId: string,
  taskId: string,
  attachmentId: string,
): Promise<void> {
  const attachment = await findTaskAttachmentRow(attachmentId);
  if (!attachment || attachment.taskId !== taskId) {
    throw new AppError("NOT_FOUND", 404, "Attachment not found.");
  }
  await requireAttachmentEditor(userId, taskId);
  const storagePath = await deleteTaskAttachmentRow(attachmentId, taskId);
  if (storagePath) await removeTaskAttachmentObject(storagePath);
}
