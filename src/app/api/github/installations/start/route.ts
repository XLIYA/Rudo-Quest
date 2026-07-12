import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { startGitHubInstallation } from "@/server/services/github-service";
import { readJson } from "@/server/api/handler";
import { z } from "zod";
import { assertRateLimit } from "@/server/security/rate-limit";

const startSchema = z.object({ projectId: z.uuid().optional() });

/**
 * Purpose: Start GitHub App installation.
 * Inputs: Auth cookies.
 * Output: GitHub installation URL.
 * Side effects: None.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("github-installation-start", user.id, 10, 3600);
    const body = startSchema.parse(await readJson(request));
    return apiSuccess(await startGitHubInstallation(user.id, body.projectId), {
      requestId,
    });
  });
}
