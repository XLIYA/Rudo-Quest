import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { createInvitationSchema } from "@/lib/validation/projects";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  getProjectInvitations,
  inviteProjectMember,
} from "@/server/services/project-service";

type Context = { params: Promise<{ projectId: string }> };

/**
 * Purpose: List project invitations for owner/admin.
 * Inputs: Project ID route parameter.
 * Output: Invitation rows.
 * Side effects: Reads invitations.
 */
export async function GET(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { projectId } = await context.params;
    return apiSuccess(await getProjectInvitations(user.id, uuidSchema.parse(projectId)), {
      requestId,
    });
  });
}

/**
 * Purpose: Invite a collaborator to a project.
 * Inputs: Invited user ID and role body.
 * Output: Created invitation.
 * Side effects: Writes invitation, notification, activity.
 */
export async function POST(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("project-invite", user.id, 30, 3600);
    const { projectId } = await context.params;
    const body = createInvitationSchema.parse(await readJson(request));
    return apiSuccess(
      await inviteProjectMember(user.id, uuidSchema.parse(projectId), body),
      {
        status: 201,
        requestId,
      },
    );
  });
}
