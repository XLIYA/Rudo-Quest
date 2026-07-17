import Link from "next/link";

/**
 * Purpose: Render the offline fallback route.
 * Inputs: None.
 * Output: Offline guidance.
 * Side effects: None.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 text-text-primary">
      <section className="max-w-sm rounded-lg border border-border bg-surface p-6 text-center">
        <h1 className="font-display text-4xl font-bold tracking-[-0.03em]">Offline</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Rudo Quest can show recently synchronized weekly and dashboard data. Mutations
          stay disabled until reconnection.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-white"
        >
          Dashboard
        </Link>
      </section>
    </main>
  );
}
