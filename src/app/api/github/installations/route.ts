import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { listGitHubInstallations } from "@/server/services/github-service";

/**
 * Purpose: List GitHub App installations for the current user.
 * Inputs: None.
 * Output: Installation list.
 * Side effects: Reads database.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const installations = await listGitHubInstallations(user.id);
    return apiSuccess(installations, { requestId });
  });
}
