import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess } from "@/lib/api/response";
import { cursorSchema } from "@/lib/validation/common";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { listActivityForUser } from "@/server/repositories/activity-repository";

const activityQuerySchema = z.object({ cursor: cursorSchema });

/**
 * Purpose: Return cursor-paginated activity visible to the user.
 * Inputs: Optional cursor query.
 * Output: Activity event DTOs and optional next cursor.
 * Side effects: Reads activity rows.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const query = activityQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await listActivityForUser({ userId: user.id, cursor: query.cursor });
    return apiSuccess(result.items, { meta: { cursor: result.cursor }, requestId });
  });
}
