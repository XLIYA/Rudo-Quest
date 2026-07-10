import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { completeGitHubInstallation } from "@/server/services/github-service";

const callbackSchema = z.object({
  installation_id: z.coerce.number().int().positive(),
  setup_action: z.string().optional(),
  state: z.string().optional(),
});

/**
 * Purpose: Accept GitHub App installation callback parameters.
 * Inputs: GitHub callback query.
 * Output: Installation callback metadata.
 * Side effects: Authentication is verified; installation metadata is persisted when GitHub sends webhook events.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    const query = callbackSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const installation = await completeGitHubInstallation(
      user.id,
      query.installation_id,
      query.state,
    );
    return apiSuccess(
      {
        installation,
        setupAction: query.setup_action ?? null,
      },
      { requestId },
    );
  });
}
