import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";
import { AppError } from "@/lib/api/errors";

/**
 * Purpose: Sign out the current user.
 * Inputs: Supabase auth cookies.
 * Output: Success envelope.
 * Side effects: Clears Supabase auth cookies.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new AppError("INTERNAL_ERROR", 502, "Sign out failed.");
    return apiSuccess({ ok: true }, { requestId });
  });
}
