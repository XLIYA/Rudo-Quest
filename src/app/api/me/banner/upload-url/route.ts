import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { createProfileUploadUrl } from "@/server/services/profile-service";
import { assertRateLimit } from "@/server/security/rate-limit";

/**
 * Purpose: Create a signed upload URL for banner image upload.
 * Inputs: Image metadata JSON.
 * Output: Supabase signed upload URL and token.
 * Side effects: Creates short-lived storage upload permission.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("banner-upload", user.id, 10, 3600);
    return apiSuccess(await createProfileUploadUrl(user.id, "banner", await readJson(request)), { requestId });
  });
}
