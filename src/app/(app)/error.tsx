"use client";

import { useEffect } from "react";
import { AppButton } from "@/components/ui/app-button";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import * as Sentry from "@sentry/nextjs";

/**
 * Purpose: Keep route-level failures inside the styled application shell.
 * Inputs: Error and retry callback from Next.js.
 * Output: Shell-wrapped error UI with a retry action.
 * Side effects: Sends exception to Sentry.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto grid max-w-5xl gap-5 p-5 md:p-8">
      <AppEmptyState
        title="This page hit a problem"
        description="Rudo Quest could not finish rendering this view. Your data is safe; try again."
        action={
          <AppButton variant="secondary" onClick={retry}>
            Try again
          </AppButton>
        }
      />
    </main>
  );
}
