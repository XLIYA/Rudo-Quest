import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess } from "@/lib/api/response";
import { uuidSchema } from "@/lib/validation/common";
import { withApiHandler, readJson } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { connectRepository, getProjectRepository, listGitHubRepositories } from "@/server/services/github-service";

type Context = { params: Promise<{ projectId: string }> };

const connectSchema = z.object({
  githubInstallationId: uuidSchema,
  repositoryId: z.number().int().positive(),
});

/**
 * Purpose: Return linked repository or list installation repositories when installationId is provided.
 * Inputs: Project ID and optional installationId query.
 * Output: Repository connection or GitHub repository list.
 * Side effects: May call GitHub API.
 */
export async function GET(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { projectId } = await context.params;
    const parsedProjectId = uuidSchema.parse(projectId);
    const installationId = request.nextUrl.searchParams.get("installationId");
    const data = installationId
      ? await listGitHubRepositories(user.id, parsedProjectId, uuidSchema.parse(installationId))
      : await getProjectRepository(user.id, parsedProjectId);
    return apiSuccess(data, { requestId });
  });
}

/**
 * Purpose: Link one repository to a project.
 * Inputs: Repository metadata body.
 * Output: Stored project repository connection.
 * Side effects: Writes connection and activity.
 */
export async function POST(request: NextRequest, context: Context) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const { projectId } = await context.params;
    const body = connectSchema.parse(await readJson(request));
    return apiSuccess(await connectRepository(user.id, uuidSchema.parse(projectId), body), {
      status: 201,
      requestId,
    });
  });
}
