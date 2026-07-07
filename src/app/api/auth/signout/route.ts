import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/server/api/handler";

/**
 * Purpose: Sign out the current user.
 * Inputs: Supabase auth cookies.
 * Output: Success envelope.
 * Side effects: Clears Supabase auth cookies.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(request, async (requestId) => {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return apiSuccess({ ok: true }, { requestId });
  });
}
