import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { readText, withApiHandler } from "@/server/api/handler";
import { assertRateLimit, requestRateLimitIdentity } from "@/server/security/rate-limit";
import { handleGitHubWebhook } from "@/server/services/github-service";

/**
 * Purpose: Verify and accept GitHub App webhooks.
 * Inputs: Raw GitHub webhook body and signature header.
 * Output: Accepted flag.
 * Side effects: Logs no issue data in V1.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(
    request,
    async (requestId) => {
      await assertRateLimit(
        "github-webhook",
        requestRateLimitIdentity(request.headers),
        300,
        60,
      );
      const body = await readText(request);
      return apiSuccess(
        await handleGitHubWebhook(body, request.headers.get("x-hub-signature-256")),
        {
          requestId,
        },
      );
    },
    { allowMissingOrigin: true },
  );
}
