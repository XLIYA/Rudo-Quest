import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { request, type APIRequestContext, type FullConfig } from "@playwright/test";

type RouteRef = { method: string; pathname: string };

const appRoot = path.join(process.cwd(), "src", "app");
const dynamicSegment = "00000000-0000-0000-0000-000000000000";
const catchAllSegment = "warmup";
const requestTimeoutMs = 120_000;
const methodPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

/**
 * Purpose: Translate a route folder name into a URL path segment.
 * Inputs: Folder name such as `[projectId]`, `[...slug]`, or `(app)`.
 * Output: The segment used to request that route during warm-up.
 * Side effects: None.
 * Business rule: Dynamic folders need a concrete value, and route groups are
 * invisible in the URL.
 */
function toUrlSegment(name: string): string {
  if (name.startsWith("(") && name.endsWith(")")) return "";
  if (name.startsWith("[")) {
    return name.includes("...") ? catchAllSegment : dynamicSegment;
  }
  return name;
}

/**
 * Purpose: Collect route entry points from the App Router tree on disk.
 * Inputs: Directory to scan, the URL prefix so far, and the entry file to match.
 * Output: URL pathnames for every matching entry file.
 * Side effects: Reads the App Router directory.
 */
function collectPageRoutes(
  directory: string,
  prefix: string,
  entryFile: "route.ts" | "page.tsx",
): string[] {
  const pathnames: string[] = [];
  for (const entry of readdirSync(directory)) {
    const entryPath = path.join(directory, entry);
    if (statSync(entryPath).isDirectory()) {
      pathnames.push(
        ...collectPageRoutes(
          entryPath,
          `${prefix}/${toUrlSegment(entry)}`.replace(/\/$/, ""),
          entryFile,
        ),
      );
      continue;
    }
    if (entry === entryFile) pathnames.push(prefix);
  }
  return pathnames;
}

/**
 * Purpose: Collect every API route together with the HTTP methods it exports.
 * Inputs: Directory to scan and the URL prefix accumulated so far.
 * Output: Flat list of `{ method, pathname }` pairs discovered on disk.
 * Side effects: Reads route files from the filesystem.
 */
function collectApiRoutes(directory: string, prefix: string): RouteRef[] {
  const routes: RouteRef[] = [];
  for (const entry of readdirSync(directory)) {
    const entryPath = path.join(directory, entry);
    if (statSync(entryPath).isDirectory()) {
      routes.push(
        ...collectApiRoutes(
          entryPath,
          `${prefix}/${toUrlSegment(entry)}`.replace(/\/$/, ""),
        ),
      );
      continue;
    }
    if (entry !== "route.ts") continue;
    const source = readFileSync(entryPath, "utf8");
    const methods = new Set(
      Array.from(source.matchAll(methodPattern), (match) => match[1]!),
    );
    for (const method of methods) {
      routes.push({ method, pathname: prefix });
    }
  }
  return routes;
}

/**
 * Purpose: Report whether a directory can be read before warming routes.
 * Inputs: Absolute directory path.
 * Output: True when the directory exists.
 * Side effects: None.
 */
function canReadDirectory(directory: string): boolean {
  try {
    readdirSync(directory);
    return true;
  } catch {
    return false;
  }
}

/**
 * Purpose: Send one unauthenticated request per API route and method.
 * Inputs: Base URL of the running web server.
 * Output: Promise resolved once every API route has been requested.
 * Side effects: Compiles the API surface in the development server.
 */
async function warmApiRoutes(baseURL: string): Promise<void> {
  const apiRoot = path.join(appRoot, "api");
  for (const route of collectApiRoutes(apiRoot, "/api")) {
    try {
      await fetch(new URL(route.pathname, baseURL), {
        method: route.method,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch {
      // A rejected warm-up request still compiled the route on the server.
    }
  }
}

/**
 * Purpose: Compile the authenticated page tree before any test navigates to it.
 * Inputs: Base URL and the seeded development credentials.
 * Output: Promise resolved once every page route has been requested.
 * Side effects: Signs in once and compiles the page surface.
 * Failure behavior: Returns immediately when no seeded credentials are present.
 */
async function warmPageRoutes(
  context: APIRequestContext,
  baseURL: string,
  email: string,
  password: string,
): Promise<void> {
  try {
    const response = await context.post("/api/auth/signin", {
      data: { email, password },
      headers: { origin: new URL(baseURL).origin },
      timeout: requestTimeoutMs,
    });
    process.stdout.write(`Warm-up sign-in status: ${response.status()}\n`);
    if (!response.ok()) return;
  } catch {
    return;
  }
  for (const pathname of collectPageRoutes(appRoot, "", "page.tsx")) {
    try {
      const response = await context.get(new URL(pathname, baseURL).pathname, {
        timeout: requestTimeoutMs,
      });
      process.stdout.write(`Warm-up page ${pathname} -> ${response.status()}\n`);
    } catch {
      // A rejected warm-up request still compiled the page on the server.
    }
  }
}

/**
 * Purpose: Warm the dev server so tests never compile a route mid-assertion.
 * Inputs: Playwright full config (supplies the resolved base URL).
 * Output: Promise resolved once the API and page surfaces are compiled.
 * Side effects: Sends requests to the already running web server.
 * Failure behavior: Never rejects; an unwarmed route only costs a rebuild mid-test.
 * Business rule: `next dev --webpack` emits a Fast Refresh update for every
 * route it compiles on demand, and the browser answers that update with a hard
 * reload that cancels in-flight fetches and discards client-side navigation.
 * Compiling the whole surface up front keeps E2E mutations from being aborted.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (typeof baseURL !== "string" || !baseURL) return;
  if (!canReadDirectory(appRoot)) return;

  const startedAt = Date.now();
  await warmApiRoutes(baseURL);
  process.stdout.write(`Warmed API routes in ${Date.now() - startedAt}ms\n`);

  const email = process.env.E2E_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
  const password = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;

  const context = await request.newContext({ baseURL });
  try {
    await warmPageRoutes(context, baseURL, email, password);
    process.stdout.write(`Warmed page routes in ${Date.now() - startedAt}ms\n`);
  } finally {
    await context.dispose();
  }
}
