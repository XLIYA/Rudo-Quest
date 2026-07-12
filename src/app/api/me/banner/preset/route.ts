import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { bannerPresetSchema } from "@/lib/validation/profile";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { setProfileBannerPreset } from "@/server/services/profile-service";

/**
 * Purpose: Persist a curated banner preset for the current profile.
 * Inputs: Allowlisted preset key.
 * Output: Updated profile.
 * Side effects: Clears and deletes any uploaded banner asset.
 * Failure behavior: Returns typed validation or storage errors.
 */
export async function PATCH(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const body = bannerPresetSchema.parse(await readJson(request));
    return apiSuccess(await setProfileBannerPreset(user.id, body.presetKey), {
      requestId,
    });
  });
}
