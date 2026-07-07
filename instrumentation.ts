import * as Sentry from "@sentry/nextjs";

/**
 * Purpose: Register Sentry runtime instrumentation for Node and Edge runtimes.
 * Inputs: NEXT_RUNTIME from Next.js.
 * Output: Promise resolving when the correct config is imported.
 * Side effects: Initializes Sentry SDK.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
