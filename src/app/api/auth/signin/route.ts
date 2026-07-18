import type { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import {
  authProviderUnavailableError,
  isAuthProviderUnavailable,
} from "@/lib/auth/provider-errors";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler, readJson } from "@/server/api/handler";
import { assertRateLimit, requestRateLimitIdentity } from "@/server/security/rate-limit";
import { ensureProfileForAuthUser } from "@/server/services/profile-service";

const signinSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

/**
 * Purpose: Sign in with Supabase email/password auth.
 * Inputs: Email and password in JSON body.
 * Output: Generic success envelope.
 * Side effects: Sets Supabase SSR auth cookies and bootstraps profile.
 * Failure behavior: Uses a generic error to avoid revealing whether an email exists.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    await assertRateLimit(
      "auth-signin",
      requestRateLimitIdentity(request.headers),
      8,
      60,
    );
    const body = signinSchema.parse(await readJson(request));
    const supabase = await createSupabaseServerClient();
    let authResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
    try {
      authResult = await supabase.auth.signInWithPassword(body);
    } catch (error) {
      if (isAuthProviderUnavailable(error)) throw authProviderUnavailableError(error);
      throw error;
    }
    const { data, error } = authResult;
    if (isAuthProviderUnavailable(error)) throw authProviderUnavailableError(error);
    if (error || !data.user?.email) {
      throw new AppError("UNAUTHORIZED", 401, "Invalid email or password.");
    }
    try {
      await ensureProfileForAuthUser({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.user_metadata.name,
        timeZone: data.user.user_metadata.time_zone,
      });
    } catch (error) {
      await supabase.auth.signOut({ scope: "local" });
      throw new AppError(
        "INTERNAL_ERROR",
        503,
        "Account setup is temporarily unavailable. Please try again.",
        undefined,
        { cause: error },
      );
    }
    return apiSuccess({ ok: true }, { requestId });
  });
}
