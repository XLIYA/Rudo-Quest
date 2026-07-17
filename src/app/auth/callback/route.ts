import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { ensureProfileForAuthUser } from "@/server/services/profile-service";

/**
 * Purpose: Create an auth redirect that cannot be stored by intermediaries.
 * Inputs: Absolute redirect URL.
 * Output: No-store redirect response.
 * Side effects: Sets response cache directives.
 */
function noStoreRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * Purpose: Build a clean same-origin auth callback destination.
 * Inputs: Callback request and allowlisted pathname.
 * Output: URL with callback query/hash data removed.
 * Side effects: None.
 */
function callbackTarget(request: NextRequest, pathname: string): URL {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  target.hash = "";
  return target;
}

/**
 * Purpose: Select the only allowed post-confirmation destination.
 * Inputs: Callback request query parameters.
 * Output: Dashboard or password-reset pathname.
 * Side effects: None.
 * Business rule: Arbitrary redirect targets are never accepted.
 */
function successPath(request: NextRequest): "/dashboard" | "/reset-password" {
  return request.nextUrl.searchParams.get("next") === "/reset-password"
    ? "/reset-password"
    : "/dashboard";
}

/**
 * Purpose: Complete the Supabase PKCE email-confirmation flow.
 * Inputs: Auth code or Supabase confirmation error query parameters.
 * Output: Redirect to the dashboard on success or login with a safe error code.
 * Side effects: Exchanges the one-time auth code and stores the session in cookies.
 * Failure behavior: Removes sensitive callback parameters before redirecting to login.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user?.email) {
      try {
        await ensureProfileForAuthUser({
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.user_metadata.name,
          timeZone: data.user.user_metadata.time_zone,
        });
        return noStoreRedirect(callbackTarget(request, successPath(request)));
      } catch {
        await supabase.auth.signOut({ scope: "local" });
      }
    }
  }

  const errorCode = request.nextUrl.searchParams.get("error_code");
  const target = callbackTarget(request, "/login");
  target.searchParams.set(
    "error",
    errorCode === "otp_expired" ? "confirmation_expired" : "confirmation_failed",
  );
  return noStoreRedirect(target);
}
