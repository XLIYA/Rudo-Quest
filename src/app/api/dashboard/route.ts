import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess } from "@/lib/api/response";
import { dateSchema } from "@/lib/validation/common";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getDashboard } from "@/server/services/dashboard-service";

const dashboardQuerySchema = z.object({ from: dateSchema, to: dateSchema });

/**
 * Purpose: Return server-side dashboard aggregates.
 * Inputs: from and to query date bounds.
 * Output: Today, progress, heatmap, and project snapshot widgets.
 * Side effects: Reads aggregate repositories.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const query = dashboardQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return apiSuccess(await getDashboard(user.id, query.from, query.to), { requestId });
  });
}
