import { AppError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase";

export type CurrentUser = {
  id: string;
  email: string;
};

/**
 * Purpose: Resolve the locally verified Supabase claims used for server authorization.
 * Inputs: Supabase SSR cookies from the current request.
 * Output: Current user ID and email.
 * Side effects: May refresh Supabase auth cookies through the server client when required.
 * Failure behavior: Throws UNAUTHORIZED for missing or invalid sessions.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const id = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (error || !id || !email) {
    throw new AppError("UNAUTHORIZED", 401, "Authentication required.");
  }
  return { id, email };
}

/**
 * Purpose: Resolve the authenticated user when present without requiring one.
 * Inputs: Supabase SSR cookies from the current request.
 * Output: Current user or null.
 * Side effects: May refresh Supabase auth cookies through the server client.
 */
export async function getOptionalCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await requireCurrentUser();
  } catch {
    return null;
  }
}
