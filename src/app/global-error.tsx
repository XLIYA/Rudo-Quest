"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Purpose: Render a global failure surface and report App Router crashes.
 * Inputs: Error and reset callback from Next.js.
 * Output: Full-document error UI.
 * Side effects: Sends exception to Sentry.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-background p-6 text-text-primary">
          <section className="max-w-sm rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-raised)]">
            <h1 className="font-display text-xl font-semibold">
              Rudo Quest hit a problem
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              The application failed to render this view.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 min-h-11 rounded-md bg-brand px-4 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
