import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { updateMemberRoleSchema } from "@/lib/validation/projects";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { changeMemberRole, removeProjectMember } from "@/server/services/project-service";

type Context = { params: Promise<{ projectId: string; userId: string }> };

/**
 * Purpose: Change a non-owner member role.
 * Inputs: Project ID, user ID, and target role.
 * Output: Updated membership.
 * Side effects: Writes membership role.
 */
export async function PATCH(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const actor = await requireCurrentUser();
    const params = await context.params;
    const body = updateMemberRoleSchema.parse(await readJson(request));
    return apiSuccess(
      await changeMemberRole(
        actor.id,
        uuidSchema.parse(params.projectId),
        uuidSchema.parse(params.userId),
        body.role,
      ),
      { requestId },
    );
  });
}

/**
 * Purpose: Remove a non-owner member.
 * Inputs: Project ID and target user ID.
 * Output: Removed membership.
 * Side effects: Deletes membership and writes activity.
 */
export async function DELETE(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const actor = await requireCurrentUser();
    const params = await context.params;
    return apiSuccess(
      await removeProjectMember(actor.id, uuidSchema.parse(params.projectId), uuidSchema.parse(params.userId)),
      { requestId },
    );
  });
}
