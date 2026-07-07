import { AppError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { ensureProfileForAuthUser } from "@/server/services/profile-service";

export type CurrentUser = {
  id: string;
  email: string;
};

/**
 * Purpose: Resolve the verified authenticated Supabase user for server authorization.
 * Inputs: Supabase SSR cookies from the current request.
 * Output: Current user ID and email.
 * Side effects: May refresh Supabase auth cookies through the server client.
 * Failure behavior: Throws UNAUTHORIZED for missing or invalid sessions.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    throw new AppError("UNAUTHORIZED", 401, "Authentication required.");
  }
  await ensureProfileForAuthUser({
    id: data.user.id,
    email: data.user.email,
    displayName: data.user.user_metadata.name,
  });
  return { id: data.user.id, email: data.user.email };
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
