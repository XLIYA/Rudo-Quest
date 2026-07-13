import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess } from "@/lib/api/response";
import { searchQuerySchema, uuidSchema } from "@/lib/validation/common";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertRateLimit } from "@/server/security/rate-limit";
import { searchUserSuggestions } from "@/server/services/profile-service";

const suggestQuerySchema = z.object({
  q: searchQuerySchema,
  excludeProjectId: uuidSchema.optional(),
  memberProjectId: uuidSchema.optional(),
});

/**
 * Purpose: Suggest users for collaboration flows without exposing private profile data.
 * Inputs: Search query and optional project exclusion.
 * Output: Up to eight profile summaries.
 * Side effects: Reads profiles.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("user-suggest", user.id, 60, 60);
    const query = suggestQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return apiSuccess(await searchUserSuggestions({ ...query, userId: user.id }), {
      requestId,
    });
  });
}
