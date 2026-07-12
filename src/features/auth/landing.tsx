import Image from "next/image";
import Link from "next/link";
import RudoMark from "@/assets/brand/rudo-mark.svg";

/**
 * Purpose: Render the compact public entry page for unauthenticated users.
 * Inputs: None.
 * Output: Landing view with auth navigation.
 * Side effects: None.
 */
export function Landing() {
  return (
    <main className="min-h-screen bg-background text-text-primary">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10">
        <div className="flex items-center gap-3">
          <Image src={RudoMark} alt="" width={48} height={48} priority />
          <span className="font-display text-3xl">Rudo Quest</span>
        </div>
        <div className="mt-14 max-w-2xl">
          <h1 className="text-4xl font-semibold leading-tight sm:text-6xl">
            Weekly work, visible in seconds.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-text-secondary">
            A calm task planner for small teams that need today, this week, and project
            ownership without heavy workflows.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-5 text-sm font-semibold text-white"
              href="/signup"
            >
              Create account
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-5 text-sm font-semibold"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
