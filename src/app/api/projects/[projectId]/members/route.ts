import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getProjectMembers } from "@/server/services/project-service";

type Context = { params: Promise<{ projectId: string }> };

/**
 * Purpose: List members of a visible project.
 * Inputs: Project ID route parameter.
 * Output: Member rows with profile summaries.
 * Side effects: Reads memberships.
 */
export async function GET(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { projectId } = await context.params;
    return apiSuccess(await getProjectMembers(user.id, uuidSchema.parse(projectId)), {
      requestId,
    });
  });
}
