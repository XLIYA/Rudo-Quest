import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { completeGitHubInstallation } from "@/server/services/github-service";

const callbackSchema = z
  .object({
    installation_id: z.coerce.number().int().positive().optional(),
    code: z.string().min(1).max(512).optional(),
    error: z.string().max(120).optional(),
    setup_action: z.string().optional(),
    state: z.string().min(1).max(2048),
  })
  .refine((value) => Boolean(value.code || value.installation_id), {
    message: "GitHub callback is missing an authorization code or installation ID.",
  });

/**
 * Purpose: Accept GitHub App installation callback parameters.
 * Inputs: GitHub callback query.
 * Output: Installation callback metadata.
 * Side effects: Verifies the current user and persists installation metadata after GitHub ownership checks.
 */
export async function GET(request: NextRequest) {
  return withApiHandler(request, async (_requestId) => {
    const user = await requireCurrentUser();
    const query = callbackSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    if (query.error) {
      throw new AppError("FORBIDDEN", 403, "GitHub authorization was declined.");
    }
    const result = await completeGitHubInstallation(
      user.id,
      query.installation_id ?? 0,
      query.state,
      query.code,
    );
    if (result.redirectToInstall) {
      return NextResponse.redirect(result.redirectToInstall);
    }
    const target = new URL(
      result.projectId ? `/projects/${result.projectId}/settings` : "/projects",
      request.url,
    );
    target.searchParams.set("github", "connected");
    return NextResponse.redirect(target);
  });
}
