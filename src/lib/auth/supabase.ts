import { cookies } from "next/headers";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import {
  getServerEnv,
  getSupabaseAdminKey,
  getSupabasePublicKey,
} from "@/lib/env/server";

/**
 * Purpose: Create a Supabase browser client for client-side auth calls.
 * Inputs: Public Supabase environment variables.
 * Output: Supabase browser client.
 * Side effects: Reads public environment variables.
 * Failure behavior: Throws integration error if Supabase is missing.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const env = getServerEnv();
  const publishableKey = getSupabasePublicKey(env);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !publishableKey) {
    throw new AppError("INTEGRATION_NOT_CONFIGURED", 503, "Supabase is not configured.");
  }
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, publishableKey);
}

/**
 * Purpose: Create a cookie-aware Supabase client for Server Components and Route Handlers.
 * Inputs: Request cookie store managed by Next.js.
 * Output: Supabase server client that can refresh auth cookies.
 * Side effects: May set refreshed auth cookies.
 * Failure behavior: Throws integration error if Supabase is missing.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const env = getServerEnv();
  const publishableKey = getSupabasePublicKey(env);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !publishableKey) {
    throw new AppError("INTEGRATION_NOT_CONFIGURED", 503, "Supabase is not configured.");
  }
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          // Server Components cannot set cookies; Route Handlers and proxy refresh them.
        }
      },
    },
  });
}

/**
 * Purpose: Create a Supabase admin client for storage and profile bootstrap operations.
 * Inputs: Server-only Supabase URL and service role key.
 * Output: Supabase client scoped to server-only use.
 * Side effects: None.
 * Failure behavior: Throws integration error if service credentials are missing.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const env = getServerEnv();
  const adminKey = getSupabaseAdminKey(env);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !adminKey) {
    throw new AppError(
      "INTEGRATION_NOT_CONFIGURED",
      503,
      "Supabase admin is not configured.",
    );
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, adminKey, {
    auth: { persistSession: false },
  });
}
