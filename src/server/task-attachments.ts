import sharp from "sharp";
import { AppError } from "@/lib/api/errors";
import { createSupabaseAdminClient } from "@/lib/auth/supabase";
import { getServerEnv, getSupabaseAdminKey } from "@/lib/env/server";

export const taskAttachmentBucket = "task-attachments";
const signedUrlTtlSeconds = 15 * 60;

function startsWith(buffer: Buffer, bytes: readonly number[], offset = 0): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function isZip(buffer: Buffer): boolean {
  return (
    startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])
  );
}

/**
 * Purpose: Validate attachment bytes independently of client-supplied file metadata.
 * Inputs: Uploaded bytes and the allowlisted expected MIME type.
 * Output: True only when the format signature/content matches the declared type.
 * Side effects: Parses raster metadata in memory.
 */
export async function isTaskAttachmentContentValid(
  buffer: Buffer,
  mimeType: string,
): Promise<boolean> {
  if (!buffer.length) return false;
  if (mimeType.startsWith("image/")) {
    try {
      const metadata = await sharp(buffer, { animated: true }).metadata();
      const expectedFormats: Record<string, string> = {
        "image/jpeg": "jpeg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/avif": "heif",
      };
      return metadata.format === expectedFormats[mimeType];
    } catch {
      return false;
    }
  }
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString() === "%PDF-";
  if (["text/plain", "text/csv", "text/markdown"].includes(mimeType)) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      return !text.includes("\0");
    } catch {
      return false;
    }
  }
  if (mimeType === "application/json") {
    try {
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
      return true;
    } catch {
      return false;
    }
  }
  if (
    [
      "application/zip",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ].includes(mimeType)
  ) {
    return isZip(buffer);
  }
  if (
    [
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
    ].includes(mimeType)
  ) {
    return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (["application/x-rar-compressed", "application/vnd.rar"].includes(mimeType)) {
    return startsWith(buffer, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]);
  }
  if (mimeType === "application/x-7z-compressed") {
    return startsWith(buffer, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
  }
  if (mimeType === "application/gzip") return startsWith(buffer, [0x1f, 0x8b]);
  if (mimeType === "application/x-tar") {
    return buffer.length > 262 && buffer.subarray(257, 262).toString() === "ustar";
  }
  return false;
}

/** Validate the exact uploaded object before it can become an attachment. */
export async function assertTaskAttachmentBytes(input: {
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<void> {
  const storage = createSupabaseAdminClient().storage.from(taskAttachmentBucket);
  const { data, error } = await storage.download(input.storagePath);
  if (error || !data) {
    throw new AppError("BAD_REQUEST", 400, "Uploaded attachment was not found.");
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  if (
    buffer.byteLength !== input.sizeBytes ||
    buffer.byteLength > 10 * 1024 * 1024 ||
    !(await isTaskAttachmentContentValid(buffer, input.mimeType))
  ) {
    await storage.remove([input.storagePath]).catch(() => undefined);
    throw new AppError("BAD_REQUEST", 400, "Uploaded file content is invalid.");
  }
}

/** Create short-lived download URLs without exposing permanent private paths. */
export async function createTaskAttachmentUrlMap(
  paths: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  const uniquePaths = Array.from(
    new Set(Array.from(paths).filter((path): path is string => Boolean(path))),
  );
  if (!uniquePaths.length || !getSupabaseAdminKey(getServerEnv())) return new Map();
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(taskAttachmentBucket)
    .createSignedUrls(uniquePaths, signedUrlTtlSeconds);
  if (error || !data) return new Map();
  return new Map(
    data
      .filter((item) => item.path && item.signedUrl)
      .map((item) => [item.path as string, item.signedUrl as string]),
  );
}

/** Best-effort cleanup for deleted or rejected private objects. */
export async function removeTaskAttachmentObject(path: string): Promise<void> {
  await createSupabaseAdminClient()
    .storage.from(taskAttachmentBucket)
    .remove([path])
    .then(() => undefined)
    .catch(() => undefined);
}
