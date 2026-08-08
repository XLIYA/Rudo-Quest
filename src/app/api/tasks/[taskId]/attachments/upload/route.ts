import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import {
  commitTaskAttachmentUploadSchema,
  taskAttachmentUploadMetadataSchema,
} from "@/lib/validation/tasks";
import { readJson, withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  commitTaskFileAttachment,
  createTaskFileUpload,
} from "@/server/services/task-attachment-service";

type Context = { params: Promise<{ taskId: string }> };

export async function POST(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("task-attachment-upload", user.id, 30, 3600);
    const { taskId } = await context.params;
    const body = taskAttachmentUploadMetadataSchema.parse(await readJson(request));
    return apiSuccess(
      await createTaskFileUpload(user.id, uuidSchema.parse(taskId), body),
      {
        status: 201,
        requestId,
      },
    );
  });
}

export async function PATCH(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    const body = commitTaskAttachmentUploadSchema.parse(await readJson(request));
    return apiSuccess(
      await commitTaskFileAttachment(user.id, uuidSchema.parse(taskId), body.uploadId),
      { requestId },
    );
  });
}
