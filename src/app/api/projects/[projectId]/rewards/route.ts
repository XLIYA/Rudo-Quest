import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { createTaskRewardSchema } from "@/lib/validation/task-rewards";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { createTaskReward, getTaskRewards } from "@/server/services/task-reward-service";
import { assertRateLimit } from "@/server/security/rate-limit";

type Context = { params: Promise<{ projectId: string }> };

/** Purpose: List visible project rewards. Inputs: Project route. Output: API envelope. Side effects: Reads authenticated reward data. */
export async function GET(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { projectId } = await context.params;
    return apiSuccess(await getTaskRewards(user.id, uuidSchema.parse(projectId)), {
      requestId,
    });
  });
}

/** Purpose: Validate and create a grouped reward. Inputs: Project and JSON contract. Output: Created ID envelope. Side effects: Invokes atomic service mutation. */
export async function POST(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("reward-create", user.id, 30, 60);
    const { projectId } = await context.params;
    const body = createTaskRewardSchema.parse(await readJson(request));
    return apiSuccess(
      await createTaskReward(user.id, uuidSchema.parse(projectId), body),
      { status: 201, requestId },
    );
  });
}
