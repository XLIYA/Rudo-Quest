import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createNonce(): string {
  return btoa(crypto.randomUUID());
}

function contentSecurityPolicy(nonce: string): string {
  const developmentSources =
    process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"];
  return [
    "default-src 'self'",
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...developmentSources,
    ].join(" "),
    ["style-src", "'self'", `'nonce-${nonce}'`].join(" "),
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://avatars.githubusercontent.com",
    "font-src 'self'",
    [
      "connect-src",
      "'self'",
      ...(process.env.NODE_ENV === "production"
        ? []
        : ["http://localhost:4747", "ws://localhost:4747"]),
      "https://*.supabase.co",
      "https://*.ingest.sentry.io",
      "https://vitals.vercel-insights.com",
      "https://va.vercel-scripts.com",
    ].join(" "),
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function applySecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  );
  return response;
}

function redirectWithAuthState(
  url: URL,
  source: NextResponse,
  csp: string,
): NextResponse {
  const redirect = applySecurityHeaders(NextResponse.redirect(url), csp);
  for (const cookie of source.cookies.getAll()) redirect.cookies.set(cookie);
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}

/**
 * Purpose: Refresh Supabase SSR auth cookies and protect application routes.
 * Inputs: Next.js proxy request.
 * Output: NextResponse that continues or redirects unauthenticated users.
 * Side effects: Reads and writes Supabase auth cookies.
 * Failure behavior: Falls through when Supabase env is absent so build and static routes remain usable.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const csp = contentSecurityPolicy(nonce);
  let response = applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    csp,
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return response;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
        }
        response = applySecurityHeaders(
          NextResponse.next({ request: { headers: requestHeaders } }),
          csp,
        );
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
        for (const [name, value] of Object.entries(headersToSet)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedRoute = [
    "/dashboard",
    "/weekly",
    "/projects",
    "/profile",
    "/notifications",
    "/settings",
    "/reset-password",
  ].some((path) => request.nextUrl.pathname.startsWith(path));

  if (protectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return redirectWithAuthState(redirectUrl, response, csp);
  }

  if (user && ["/", "/login", "/signup"].includes(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return redirectWithAuthState(redirectUrl, response, csp);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
