import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { getOptionalCurrentUser } from "@/server/auth/current-user";

/**
 * Purpose: Render email/password signup for guests.
 * Inputs: Supabase SSR cookies.
 * Output: Signup page or dashboard redirect.
 * Side effects: Redirects authenticated users.
 */
export default async function SignupPage() {
  const user = await getOptionalCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 text-text-primary">
      <section className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-raised)]">
        <h1 className="font-display text-4xl">Join Rudo</h1>
        <p className="mt-2 text-sm text-text-secondary">Create an account to start weekly planning.</p>
        <div className="mt-6">
          <AuthForm mode="signup" />
        </div>
        <p className="mt-5 text-sm text-text-secondary">
          Already have an account? <Link className="font-semibold text-brand" href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
