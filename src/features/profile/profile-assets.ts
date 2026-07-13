"use client";

import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { apiMutation } from "@/lib/api/client";
import type { ProfileDto } from "@/types/domain";

const sourceImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxSourceImageBytes = 12_000_000;
const maxSourcePixels = 60_000_000;

/**
 * Purpose: Center-crop a selected image to the requested banner/avatar aspect ratio.
 * Inputs: Browser image file and target width/height ratio.
 * Output: Cropped WebP file ready for signed storage upload.
 * Side effects: Decodes the image and renders a temporary canvas.
 * Failure behavior: Rejects when the browser cannot decode or encode the image.
 */
export async function cropProfileImage(file: File, aspectRatio: number): Promise<File> {
  if (!sourceImageTypes.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size <= 0 || file.size > maxSourceImageBytes) {
    throw new Error("Choose an image smaller than 12 MB.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    if (
      bitmap.width < 128 ||
      bitmap.height < 128 ||
      bitmap.width * bitmap.height > maxSourcePixels
    ) {
      throw new Error("Choose an image at least 128px wide and within safe dimensions.");
    }
    const sourceRatio = bitmap.width / bitmap.height;
    const sourceWidth =
      sourceRatio > aspectRatio ? Math.round(bitmap.height * aspectRatio) : bitmap.width;
    const sourceHeight =
      sourceRatio > aspectRatio ? bitmap.height : Math.round(bitmap.width / aspectRatio);
    const sourceX = Math.round((bitmap.width - sourceWidth) / 2);
    const sourceY = Math.round((bitmap.height - sourceHeight) / 2);
    const maxWidth = aspectRatio >= 1.5 ? 2048 : 1024;
    const width = Math.min(maxWidth, sourceWidth);
    const height = Math.round(width / aspectRatio);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image crop is unavailable in this browser.");
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Image encoding failed."))),
        "image/webp",
        0.9,
      );
    });
    return new File([blob], "rudo-profile.webp", { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}

/**
 * Purpose: Upload a cropped profile asset through a server-issued Supabase signed URL.
 * Inputs: Asset kind and cropped browser file.
 * Output: Updated profile DTO returned by the commit endpoint.
 * Side effects: Creates a signed URL, uploads bytes, validates them server-side, and stores only the path.
 * Failure behavior: Throws a typed API or storage error; no profile path is committed on upload failure.
 */
export async function uploadProfileAsset(kind: "avatar" | "banner", file: File) {
  const bitmap = await createImageBitmap(file);
  const metadata = {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    width: bitmap.width,
    height: bitmap.height,
  };
  bitmap.close();
  const upload = await apiMutation<{ path: string; token: string }>(
    "post",
    `/api/me/${kind}/upload-url`,
    metadata,
  );
  const supabase = createSupabaseBrowserClient();
  const result = await supabase.storage
    .from("profile-assets")
    .uploadToSignedUrl(upload.path, upload.token, file, {
      contentType: file.type,
      upsert: false,
    });
  if (result.error) throw new Error("Profile image upload failed.");
  return apiMutation<ProfileDto>("patch", `/api/me/${kind}`, { path: upload.path });
}
