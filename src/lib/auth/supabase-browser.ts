"use client";

import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";

/**
 * Purpose: Create the browser-safe Supabase client without importing server-only cookie APIs.
 * Inputs: Public Supabase URL and publishable/anonymous key from the client environment.
 * Output: Supabase browser client.
 * Side effects: Reads public environment variables and manages browser auth storage.
 * Failure behavior: Throws an integration error when public Supabase settings are absent.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new AppError("INTEGRATION_NOT_CONFIGURED", 503, "Supabase is not configured.");
  return createBrowserClient(url, key);
}
