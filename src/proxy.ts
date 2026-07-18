import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Purpose: Create a per-request nonce for framework and application scripts.
 * Inputs: None.
 * Output: Base64 nonce string.
 * Side effects: Uses the runtime cryptographic random source.
 */
function createNonce(): string {
  return btoa(crypto.randomUUID());
}

/**
 * Purpose: Build the environment-aware Content Security Policy.
 * Inputs: Per-request script and style nonce.
 * Output: CSP header value.
 * Side effects: Reads the runtime environment mode.
 */
function contentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV !== "production";
  // Some version-pinned UI dependencies create style elements without a
  // nonce. Permit only the exact payloads emitted by the installed versions.
  const dynamicStyleHashes = [
    "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
    "'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY='",
    "'sha256-441zG27rExd4/il+NvIqyL8zFx5XmyNQtE381kSkUJk='",
    "'sha256-nzTgYzXYDNe6BAHiiI7NNlfK8n/auuOAhh2t92YvuXo='",
  ];
  return [
    "default-src 'self'",
    (isDevelopment
      ? ["script-src", "'self'", "'unsafe-inline'", "'unsafe-eval'"]
      : ["script-src", "'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
    ).join(" "),
    [
      "style-src",
      "'self'",
      ...(isDevelopment
        ? ["'unsafe-inline'"]
        : [`'nonce-${nonce}'`, ...dynamicStyleHashes]),
    ].join(" "),
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://avatars.githubusercontent.com",
    "font-src 'self'",
    [
      "connect-src",
      "'self'",
      ...(isDevelopment
        ? ["http://localhost:4747", "ws://localhost:*", "ws://127.0.0.1:*"]
        : []),
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

/**
 * Purpose: Attach the shared browser security policy to a response.
 * Inputs: Mutable Next.js response and generated CSP.
 * Output: The same response with hardened headers.
 * Side effects: Mutates response headers.
 */
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

/**
 * Purpose: Redirect while preserving cookies and cache directives created during auth refresh.
 * Inputs: Destination URL, source auth response, and CSP.
 * Output: Hardened redirect response.
 * Side effects: Copies cookies and selected headers to the redirect.
 */
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
  // Next.js reads the request CSP to apply the per-request nonce to framework code.
  requestHeaders.set("Content-Security-Policy", csp);
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

  const { data, error } = await supabase.auth.getClaims();
  const authenticated = !error && typeof data?.claims?.sub === "string";

  const protectedRoute = [
    "/dashboard",
    "/weekly",
    "/projects",
    "/profile",
    "/notifications",
    "/settings",
    "/reset-password",
  ].some((path) => request.nextUrl.pathname.startsWith(path));

  if (protectedRoute && !authenticated) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return redirectWithAuthState(redirectUrl, response, csp);
  }

  if (
    authenticated &&
    ["/", "/login", "/signup", "/verify-email"].includes(request.nextUrl.pathname)
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return redirectWithAuthState(redirectUrl, response, csp);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icons/|fonts/|banners/|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|webmanifest)$).*)",
  ],
};
