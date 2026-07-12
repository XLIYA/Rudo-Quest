import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess } from "@/lib/api/response";
import { getServerEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { readJson, withApiHandler } from "@/server/api/handler";
import { assertRateLimit, requestRateLimitIdentity } from "@/server/security/rate-limit";

const resetRequestSchema = z.object({ email: z.email() });

/**
 * Purpose: Start password recovery without revealing whether an email is registered.
 * Inputs: Email address from the public login form.
 * Output: Generic success response.
 * Side effects: May ask Supabase Auth to send a recovery email.
 * Failure behavior: Provider-level account lookup errors are hidden from the caller.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const body = resetRequestSchema.parse(await readJson(request));
    await assertRateLimit(
      "auth-password-reset",
      requestRateLimitIdentity(request.headers),
      5,
      900,
    );
    const env = getServerEnv();
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(body.email, {
      redirectTo: env.NEXT_PUBLIC_APP_URL
        ? new URL("/reset-password", env.NEXT_PUBLIC_APP_URL).toString()
        : undefined,
    });
    return apiSuccess({ ok: true }, { requestId });
  });
}
