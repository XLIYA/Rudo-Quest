import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { updateProfileSchema } from "@/lib/validation/profile";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { updateMyProfile } from "@/server/services/profile-service";

/**
 * Purpose: Update current user's display name and handle.
 * Inputs: Validated profile body.
 * Output: Updated profile.
 * Side effects: Writes profile identity fields.
 */
export async function PATCH(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const body = updateProfileSchema.parse(await readJson(request));
    return apiSuccess(await updateMyProfile(user.id, body), { requestId });
  });
}
