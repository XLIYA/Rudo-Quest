import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { disconnectRepository } from "@/server/services/github-service";

type Context = { params: Promise<{ projectId: string; repositoryId: string }> };

/**
 * Purpose: Disconnect a repository from a project.
 * Inputs: Project ID and repository ID route params.
 * Output: Removed connection row.
 * Side effects: Deletes connection and writes activity.
 */
export async function DELETE(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const params = await context.params;
    const repositoryId = z.coerce.number().int().positive().parse(params.repositoryId);
    return apiSuccess(
      await disconnectRepository(
        user.id,
        uuidSchema.parse(params.projectId),
        repositoryId,
      ),
      {
        requestId,
      },
    );
  });
}
