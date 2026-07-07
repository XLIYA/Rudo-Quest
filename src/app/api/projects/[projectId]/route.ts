import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { updateProjectSchema } from "@/lib/validation/projects";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { archiveProject, getProject, updateProject } from "@/server/services/project-service";

type Context = { params: Promise<{ projectId: string }> };

/**
 * Purpose: Return one visible project.
 * Inputs: Project ID route parameter.
 * Output: Project summary.
 * Side effects: Reads project membership.
 */
export async function GET(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { projectId } = await context.params;
    return apiSuccess(await getProject(user.id, uuidSchema.parse(projectId)), { requestId });
  });
}

/**
 * Purpose: Update project metadata as owner/admin.
 * Inputs: Project ID route parameter and validated body.
 * Output: Updated project row.
 * Side effects: Writes project and activity.
 */
export async function PATCH(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { projectId } = await context.params;
    const body = updateProjectSchema.parse(await readJson(request));
    return apiSuccess(await updateProject(user.id, uuidSchema.parse(projectId), body), { requestId });
  });
}

/**
 * Purpose: Archive a project as owner.
 * Inputs: Project ID route parameter.
 * Output: Archived project row.
 * Side effects: Sets archived_at and writes activity.
 */
export async function DELETE(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { projectId } = await context.params;
    return apiSuccess(await archiveProject(user.id, uuidSchema.parse(projectId)), { requestId });
  });
}
