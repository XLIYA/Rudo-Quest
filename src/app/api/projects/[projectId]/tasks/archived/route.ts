import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { z } from "zod";
import { uuidSchema } from "@/lib/validation/common";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getProjectArchivedTasks } from "@/server/services/task-history-service";

type Context = { params: Promise<{ projectId: string }> };

const archivedTaskFiltersSchema = z.object({
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: uuidSchema.optional(),
  completedFrom: z.string().datetime().optional(),
  completedTo: z.string().datetime().optional(),
  archivedFrom: z.string().datetime().optional(),
  archivedTo: z.string().datetime().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "PENDING_REVIEW", "DONE"]).optional(),
});

const querySchema = z.object({
  search: z.string().trim().max(200).optional(),
  filters: archivedTaskFiltersSchema.optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Purpose: Return archived tasks for a project with search and filter support.
 * Inputs: Project ID, search term, filters, and pagination cursor.
 * Output: Cursor-paginated archived task DTOs.
 * Side effects: Reads task and membership data.
 */
export async function GET(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { projectId } = await context.params;
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    return apiSuccess(
      await getProjectArchivedTasks(user.id, uuidSchema.parse(projectId), query),
      { requestId },
    );
  });
}
