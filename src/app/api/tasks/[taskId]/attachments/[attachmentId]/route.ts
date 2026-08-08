import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertRateLimit } from "@/server/security/rate-limit";
import { deleteTaskAttachment } from "@/server/services/task-attachment-service";

type Context = { params: Promise<{ taskId: string; attachmentId: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("task-attachment-delete", user.id, 60, 60);
    const { taskId, attachmentId } = await context.params;
    await deleteTaskAttachment(
      user.id,
      uuidSchema.parse(taskId),
      uuidSchema.parse(attachmentId),
    );
    return apiSuccess({ deleted: true }, { requestId });
  });
}
