import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { getOptionalCurrentUser } from "@/server/auth/current-user";

/**
 * Purpose: Render email/password sign-in for unauthenticated users.
 * Inputs: Supabase SSR cookies.
 * Output: Login page or dashboard redirect.
 * Side effects: Redirects authenticated users.
 */
export default async function LoginPage() {
  const user = await getOptionalCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 text-text-primary">
      <section className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-raised)]">
        <h1 className="font-display text-4xl">Rudo Quest</h1>
        <p className="mt-2 text-sm text-text-secondary">Sign in to plan the week.</p>
        <div className="mt-6">
          <AuthForm mode="login" />
        </div>
        <p className="mt-5 text-sm text-text-secondary">
          New here? <Link className="font-semibold text-brand" href="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
