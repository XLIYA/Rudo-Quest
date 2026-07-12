import Link from "next/link";

/**
 * Purpose: Render a native not-found screen.
 * Inputs: None.
 * Output: 404 view with navigation back to dashboard.
 * Side effects: None.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-text-primary">
      <section className="max-w-sm rounded-lg border border-border bg-surface p-6 text-center">
        <h1 className="font-display text-4xl">Lost trail</h1>
        <p className="mt-3 text-sm text-text-secondary">
          This Rudo Quest route does not exist.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-white"
          href="/dashboard"
        >
          Dashboard
        </Link>
      </section>
    </main>
  );
}
