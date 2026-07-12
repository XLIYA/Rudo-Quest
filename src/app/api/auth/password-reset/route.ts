import type { NextRequest } from "next/server";
import { AppError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { apiSuccess } from "@/lib/api/response";
import { getServerEnv } from "@/lib/env/server";
import { withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertRateLimit } from "@/server/security/rate-limit";

/**
 * Purpose: Send a password-reset email to the currently authenticated account.
 * Inputs: Authenticated session cookies.
 * Output: Generic success envelope.
 * Side effects: Calls Supabase Auth and sends a reset email.
 * Failure behavior: Returns a safe integration error without exposing provider details.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("auth-password-reset-authenticated", user.id, 3, 3600);
    const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
    if (!appUrl)
      throw new AppError(
        "INTEGRATION_NOT_CONFIGURED",
        503,
        "Application URL is not configured.",
      );
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: new URL("/reset-password", appUrl).toString(),
    });
    if (error)
      throw new AppError("INTERNAL_ERROR", 502, "Password reset could not be started.");
    return apiSuccess({ ok: true }, { requestId });
  });
}
