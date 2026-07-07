import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { createProjectSchema, projectListQuerySchema } from "@/lib/validation/projects";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertRateLimit } from "@/server/security/rate-limit";
import { createProject, listProjectsForUser } from "@/server/services/project-service";

/**
 * Purpose: List projects visible to the authenticated user.
 * Inputs: Optional search, role, and archive filters.
 * Output: Project summaries.
 * Side effects: Reads project aggregates.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const query = projectListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return apiSuccess(await listProjectsForUser(user.id, query), { requestId });
  });
}

/**
 * Purpose: Create a project with optional invitations.
 * Inputs: Validated project creation body.
 * Output: Created project summary.
 * Side effects: Writes project, membership, invitations, notifications, activity.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("project-create", user.id, 20, 3600);
    const body = createProjectSchema.parse(await readJson(request));
    const invitations = body.invitations.map((invite) => ({ userId: invite.userId, role: invite.role }));
    return apiSuccess(await createProject(user.id, { ...body, ownerId: user.id, invitations }), {
      status: 201,
      requestId,
    });
  });
}
