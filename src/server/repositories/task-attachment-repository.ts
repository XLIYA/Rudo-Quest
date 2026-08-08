import { and, desc, eq, gt, isNull, lte } from "drizzle-orm";
import { profiles, taskAttachments, taskAttachmentUploads } from "@/db/schema";
import { getDb } from "@/lib/db/client";
import { createProfileAssetUrlMap, profileAssetUrl } from "@/server/profile-assets";
import { createTaskAttachmentUrlMap } from "@/server/task-attachments";
import type { TaskAttachmentDto } from "@/types/domain";

type AttachmentRow = typeof taskAttachments.$inferSelect;

async function toDtos(
  rows: Array<
    AttachmentRow & {
      creatorHandle: string;
      creatorDisplayName: string;
      creatorAvatarPath: string | null;
    }
  >,
): Promise<TaskAttachmentDto[]> {
  const [avatarUrls, downloadUrls] = await Promise.all([
    createProfileAssetUrlMap(rows.map((row) => row.creatorAvatarPath)),
    createTaskAttachmentUrlMap(rows.map((row) => row.storagePath)),
  ]);
  return rows.map((row) => ({
    id: row.id,
    taskId: row.taskId,
    kind: row.kind as TaskAttachmentDto["kind"],
    label: row.label,
    url: row.url,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    downloadUrl: row.storagePath ? (downloadUrls.get(row.storagePath) ?? null) : null,
    createdBy: {
      id: row.createdBy,
      handle: row.creatorHandle,
      displayName: row.creatorDisplayName,
      avatarUrl: profileAssetUrl(row.creatorAvatarPath, avatarUrls),
    },
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listTaskAttachmentRows(
  taskId: string,
): Promise<TaskAttachmentDto[]> {
  const rows = await getDb()
    .select({
      id: taskAttachments.id,
      taskId: taskAttachments.taskId,
      createdBy: taskAttachments.createdBy,
      kind: taskAttachments.kind,
      label: taskAttachments.label,
      url: taskAttachments.url,
      storagePath: taskAttachments.storagePath,
      fileName: taskAttachments.fileName,
      mimeType: taskAttachments.mimeType,
      sizeBytes: taskAttachments.sizeBytes,
      createdAt: taskAttachments.createdAt,
      creatorHandle: profiles.handle,
      creatorDisplayName: profiles.displayName,
      creatorAvatarPath: profiles.avatarPath,
    })
    .from(taskAttachments)
    .innerJoin(profiles, eq(profiles.id, taskAttachments.createdBy))
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(desc(taskAttachments.createdAt), desc(taskAttachments.id));
  return toDtos(rows);
}

export async function insertTaskLinkAttachment(input: {
  taskId: string;
  userId: string;
  label: string;
  url: string;
}): Promise<TaskAttachmentDto> {
  const [row] = await getDb()
    .insert(taskAttachments)
    .values({
      taskId: input.taskId,
      createdBy: input.userId,
      kind: "LINK",
      label: input.label,
      url: input.url,
    })
    .returning();
  if (!row) throw new Error("Task attachment insert returned no row.");
  const exact = (await listTaskAttachmentRows(input.taskId)).find(
    (item) => item.id === row.id,
  );
  if (!exact) throw new Error("Task attachment could not be reloaded.");
  return exact;
}

export async function createTaskAttachmentUpload(input: {
  taskId: string;
  userId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: Date;
}) {
  const [row] = await getDb().insert(taskAttachmentUploads).values(input).returning();
  if (!row) throw new Error("Task attachment upload insert returned no row.");
  return row;
}

export async function findPendingTaskAttachmentUpload(input: {
  uploadId: string;
  taskId: string;
  userId: string;
}) {
  const [row] = await getDb()
    .select()
    .from(taskAttachmentUploads)
    .where(
      and(
        eq(taskAttachmentUploads.id, input.uploadId),
        eq(taskAttachmentUploads.taskId, input.taskId),
        eq(taskAttachmentUploads.userId, input.userId),
        isNull(taskAttachmentUploads.committedAt),
        gt(taskAttachmentUploads.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function commitTaskAttachmentUpload(input: {
  uploadId: string;
  taskId: string;
  userId: string;
}): Promise<TaskAttachmentDto | null> {
  const attachmentId = await getDb().transaction(async (tx) => {
    const [upload] = await tx
      .select()
      .from(taskAttachmentUploads)
      .where(
        and(
          eq(taskAttachmentUploads.id, input.uploadId),
          eq(taskAttachmentUploads.taskId, input.taskId),
          eq(taskAttachmentUploads.userId, input.userId),
          isNull(taskAttachmentUploads.committedAt),
          gt(taskAttachmentUploads.expiresAt, new Date()),
        ),
      )
      .for("update")
      .limit(1);
    if (!upload) return null;
    const [attachment] = await tx
      .insert(taskAttachments)
      .values({
        taskId: upload.taskId,
        createdBy: upload.userId,
        kind: "FILE",
        label: upload.fileName.slice(0, 140),
        storagePath: upload.storagePath,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
      })
      .returning({ id: taskAttachments.id });
    if (!attachment) return null;
    await tx
      .update(taskAttachmentUploads)
      .set({ committedAt: new Date() })
      .where(eq(taskAttachmentUploads.id, upload.id));
    return attachment.id;
  });
  if (!attachmentId) return null;
  return (
    (await listTaskAttachmentRows(input.taskId)).find(
      (item) => item.id === attachmentId,
    ) ?? null
  );
}

export async function findTaskAttachmentRow(id: string): Promise<AttachmentRow | null> {
  const [row] = await getDb()
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.id, id))
    .limit(1);
  return row ?? null;
}

export async function deleteTaskAttachmentRow(
  id: string,
  taskId: string,
): Promise<string | null> {
  const [row] = await getDb()
    .delete(taskAttachments)
    .where(and(eq(taskAttachments.id, id), eq(taskAttachments.taskId, taskId)))
    .returning({ storagePath: taskAttachments.storagePath });
  return row?.storagePath ?? null;
}

export async function listExpiredTaskAttachmentUploads(limit = 100) {
  return getDb()
    .select({
      id: taskAttachmentUploads.id,
      storagePath: taskAttachmentUploads.storagePath,
    })
    .from(taskAttachmentUploads)
    .where(
      and(
        isNull(taskAttachmentUploads.committedAt),
        lte(taskAttachmentUploads.expiresAt, new Date()),
      ),
    )
    .orderBy(taskAttachmentUploads.expiresAt)
    .limit(limit);
}

export async function deleteExpiredTaskAttachmentUpload(id: string): Promise<void> {
  await getDb()
    .delete(taskAttachmentUploads)
    .where(
      and(eq(taskAttachmentUploads.id, id), isNull(taskAttachmentUploads.committedAt)),
    );
}
