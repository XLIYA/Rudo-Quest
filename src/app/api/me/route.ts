import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getMyProfile } from "@/server/services/profile-service";

/**
 * Purpose: Return authenticated user profile data.
 * Inputs: Supabase auth cookies.
 * Output: Current profile.
 * Side effects: Bootstraps profile through requireCurrentUser when needed.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    return apiSuccess(await getMyProfile(user.id), { requestId });
  });
}
