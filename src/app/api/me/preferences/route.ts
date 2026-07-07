import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { updatePreferencesSchema } from "@/lib/validation/profile";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { updateMyPreferences } from "@/server/services/profile-service";

/**
 * Purpose: Update current user's theme, timezone, and notification preferences.
 * Inputs: Validated preference body.
 * Output: Updated profile.
 * Side effects: Writes profile preference fields.
 */
export async function PATCH(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const body = updatePreferencesSchema.parse(await readJson(request));
    return apiSuccess(await updateMyPreferences(user.id, body), { requestId });
  });
}
