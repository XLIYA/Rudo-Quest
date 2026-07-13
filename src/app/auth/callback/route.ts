import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase";

function noStoreRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function callbackTarget(request: NextRequest, pathname: string): URL {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  target.hash = "";
  return target;
}

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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return noStoreRedirect(callbackTarget(request, successPath(request)));
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
