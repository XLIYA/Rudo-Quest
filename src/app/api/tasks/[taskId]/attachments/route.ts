import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { createTaskLinkAttachmentSchema } from "@/lib/validation/tasks";
import { readJson, withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  createTaskLinkAttachment,
  getTaskAttachments,
} from "@/server/services/task-attachment-service";

type Context = { params: Promise<{ taskId: string }> };

export async function GET(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    return apiSuccess(await getTaskAttachments(user.id, uuidSchema.parse(taskId)), {
      requestId,
    });
  });
}

export async function POST(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("task-attachment-link", user.id, 60, 60);
    const { taskId } = await context.params;
    const body = createTaskLinkAttachmentSchema.parse(await readJson(request));
    return apiSuccess(
      await createTaskLinkAttachment(user.id, uuidSchema.parse(taskId), body),
      { status: 201, requestId },
    );
  });
}
