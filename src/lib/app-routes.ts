/**
 * Prefixes of routes that require an authenticated session. The proxy uses
 * this list to redirect logged-out traffic, and the client provider uses it
 * to decide when the private offline cache may bootstrap, so both lists can
 * never drift apart. Add new protected segments here only.
 */
export const protectedAppRoutes = [
  "/dashboard",
  "/weekly",
  "/projects",
  "/profile",
  "/notifications",
  "/settings",
  "/task-history",
  "/reset-password",
] as const;

/**
 * Purpose: Decide whether a pathname is session-protected.
 * Inputs: Request or browser pathname.
 * Output: True when the path is covered by protectedAppRoutes.
 * Side effects: None.
 */
export function isProtectedAppRoute(pathname: string): boolean {
  return protectedAppRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
