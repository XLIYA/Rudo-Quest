import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { taskRewardActionSchema } from "@/lib/validation/task-rewards";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { actOnTaskReward } from "@/server/services/task-reward-service";
import { assertRateLimit } from "@/server/security/rate-limit";

/** Purpose: Validate a versioned reward action. Inputs: Route IDs and action. Output: API envelope. Side effects: Approves or cancels a reward. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; rewardId: string }> },
) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("reward-action", user.id, 60, 60);
    const { projectId, rewardId } = await context.params;
    const body = taskRewardActionSchema.parse(await readJson(request));
    return apiSuccess(
      await actOnTaskReward(
        user.id,
        uuidSchema.parse(projectId),
        uuidSchema.parse(rewardId),
        body.version,
        body.action,
      ),
      { requestId },
    );
  });
}
