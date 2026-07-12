import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess } from "@/lib/api/response";
import { getServerEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { readJson, withApiHandler } from "@/server/api/handler";
import { assertRateLimit, requestRateLimitIdentity } from "@/server/security/rate-limit";

const resendSchema = z.object({ email: z.email() });

/**
 * Purpose: Resend a signup verification email without revealing account existence.
 * Inputs: Email address from the public recovery UI.
 * Output: Generic success response.
 * Side effects: May ask Supabase Auth to send a signup confirmation email.
 * Failure behavior: Provider-level email errors are intentionally hidden; invalid input and missing infrastructure remain typed failures.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const body = resendSchema.parse(await readJson(request));
    await assertRateLimit(
      "auth-resend-verification",
      requestRateLimitIdentity(request.headers),
      5,
      900,
    );
    const env = getServerEnv();
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resend({
      type: "signup",
      email: body.email,
      options: {
        emailRedirectTo: env.NEXT_PUBLIC_APP_URL
          ? new URL("/auth/callback", env.NEXT_PUBLIC_APP_URL).toString()
          : undefined,
      },
    });
    return apiSuccess({ ok: true }, { requestId });
  });
}
