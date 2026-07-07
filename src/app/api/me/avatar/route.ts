import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { commitProfileAsset } from "@/server/services/profile-service";

const assetSchema = z.object({ path: z.string().min(1).max(500) });

/**
 * Purpose: Commit or delete the current user's avatar path.
 * Inputs: Uploaded storage path for PATCH, auth cookies for DELETE.
 * Output: Updated profile.
 * Side effects: Writes avatar path and deletes replaced storage object.
 */
export async function PATCH(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const body = assetSchema.parse(await readJson(request));
    return apiSuccess(await commitProfileAsset(user.id, "avatar", body.path), { requestId });
  });
}

export async function DELETE(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    return apiSuccess(await commitProfileAsset(user.id, "avatar", null), { requestId });
  });
}
