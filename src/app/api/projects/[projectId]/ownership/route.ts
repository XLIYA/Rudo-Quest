import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { transferOwnershipSchema } from "@/lib/validation/projects";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { transferOwnership } from "@/server/services/project-service";

type Context = { params: Promise<{ projectId: string }> };

/**
 * Purpose: Transfer project ownership after an explicit confirmation payload.
 * Inputs: Project ID and target member ID.
 * Output: New owner membership.
 * Side effects: Changes membership roles and writes activity.
 * Failure behavior: Returns a typed authorization or not-found failure.
 */
export async function POST(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const params = await context.params;
    const body = transferOwnershipSchema.parse(await readJson(request));
    return apiSuccess(
      await transferOwnership(
        user.id,
        uuidSchema.parse(params.projectId),
        body.targetUserId,
      ),
      { requestId },
    );
  });
}
