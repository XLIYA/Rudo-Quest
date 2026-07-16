import type { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { apiSuccess } from "@/lib/api/response";
import { getServerEnv } from "@/lib/env/server";
import { readJson, withApiHandler } from "@/server/api/handler";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertRateLimit } from "@/server/security/rate-limit";

const passwordUpdateSchema = z.object({
  password: z.string().min(8).max(128),
});

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
      redirectTo: new URL("/auth/callback?next=%2Freset-password", appUrl).toString(),
    });
    if (error)
      throw new AppError("INTERNAL_ERROR", 502, "Password reset could not be started.");
    return apiSuccess({ ok: true }, { requestId });
  });
}

/**
 * Purpose: Complete an authenticated Supabase recovery session with a new password.
 * Inputs: Validated replacement password and recovery-session cookies.
 * Output: Generic success envelope.
 * Side effects: Updates the Supabase Auth password and clears the recovery session.
 * Failure behavior: Returns a generic authorization error for expired recovery sessions.
 */
export async function PATCH(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const user = await requireCurrentUser();
    await assertRateLimit("auth-password-update", user.id, 5, 3600);
    const body = passwordUpdateSchema.parse(await readJson(request));
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const amr = claimsData?.claims.amr as { method?: string }[] | undefined;
    const isRecoverySession = amr?.some((entry) => entry.method === "recovery") ?? false;
    if (claimsError || !isRecoverySession) {
      throw new AppError(
        "UNAUTHORIZED",
        401,
        "The password reset link is invalid or expired.",
      );
    }
    const { error } = await supabase.auth.updateUser({ password: body.password });
    if (error) {
      throw new AppError(
        "UNAUTHORIZED",
        401,
        "The password reset link is invalid or expired.",
      );
    }
    await supabase.auth.signOut({ scope: "local" });
    return apiSuccess({ ok: true }, { requestId });
  });
}
