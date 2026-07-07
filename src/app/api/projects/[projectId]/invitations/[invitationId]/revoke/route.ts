import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { changeInvitationStatus } from "@/server/services/project-service";

type Context = { params: Promise<{ projectId: string; invitationId: string }> };

/**
 * Purpose: Revoke a pending invitation as owner/admin.
 * Inputs: Project ID and invitation ID.
 * Output: Revoked invitation.
 * Side effects: Updates invitation status.
 */
export async function POST(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const params = await context.params;
    return apiSuccess(
      await changeInvitationStatus(
        user.id,
        uuidSchema.parse(params.projectId),
        uuidSchema.parse(params.invitationId),
        "REVOKED",
      ),
      { requestId },
    );
  });
}
