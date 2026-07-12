import type { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { apiSuccess } from "@/lib/api/response";
import { getServerEnv } from "@/lib/env/server";
import { withApiHandler, readJson } from "@/server/api/handler";
import { assertRateLimit, requestRateLimitIdentity } from "@/server/security/rate-limit";

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(60),
});

/**
 * Purpose: Register a user with Supabase email/password auth.
 * Inputs: Email, password, and display name in JSON body.
 * Output: Generic success envelope.
 * Side effects: Creates a Supabase auth user and sends verification email.
 * Failure behavior: Returns generic auth failure without email enumeration.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    await assertRateLimit(
      "auth-signup",
      requestRateLimitIdentity(request.headers),
      5,
      60,
    );
    const body = signupSchema.parse(await readJson(request));
    const supabase = await createSupabaseServerClient();
    const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
    const emailRedirectTo = appUrl
      ? new URL("/auth/callback", appUrl).toString()
      : undefined;
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: { name: body.displayName },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });
    if (error || !data.user) {
      throw new AppError("BAD_REQUEST", 400, "Sign up could not be completed.");
    }
    return apiSuccess({ ok: true }, { status: 201, requestId });
  });
}
