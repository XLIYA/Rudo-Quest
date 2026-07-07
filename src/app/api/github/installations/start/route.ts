import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { startGitHubInstallation } from "@/server/services/github-service";

/**
 * Purpose: Start GitHub App installation.
 * Inputs: Auth cookies.
 * Output: GitHub installation URL.
 * Side effects: None.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    return apiSuccess(await startGitHubInstallation(user.id), { requestId });
  });
}
