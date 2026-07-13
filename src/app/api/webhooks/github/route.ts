import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess } from "@/lib/api/response";
import { readText, withApiHandler } from "@/server/api/handler";
import { assertRateLimit, requestRateLimitIdentity } from "@/server/security/rate-limit";
import { handleGitHubWebhook } from "@/server/services/github-service";

const webhookHeadersSchema = z.object({
  event: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_]+$/),
  deliveryId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9-]+$/),
});

/**
 * Purpose: Verify and accept GitHub App webhooks.
 * Inputs: Raw GitHub webhook body and signature header.
 * Output: Accepted flag.
 * Side effects: Logs only verified event and delivery identifiers, never payload data.
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
      const headers = webhookHeadersSchema.parse({
        event: request.headers.get("x-github-event"),
        deliveryId: request.headers.get("x-github-delivery"),
      });
      return apiSuccess(
        await handleGitHubWebhook(
          body,
          request.headers.get("x-hub-signature-256"),
          headers.event,
          headers.deliveryId,
        ),
        {
          requestId,
        },
      );
    },
    { allowMissingOrigin: true },
  );
}
