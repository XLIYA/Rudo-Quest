import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { getOptionalCurrentUser } from "@/server/auth/current-user";

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

/**
 * Purpose: Translate safe confirmation error codes into actionable sign-in guidance.
 * Inputs: Optional single or repeated error query value.
 * Output: User-facing message or null for unknown values.
 * Side effects: None.
 */
function getConfirmationError(error: string | string[] | undefined): string | null {
  const code = Array.isArray(error) ? error[0] : error;
  if (code === "confirmation_expired") {
    return "That email confirmation link is invalid or expired. Use the newest email, or sign in if your account is already confirmed.";
  }
  if (code === "confirmation_failed") {
    return "Email confirmation could not be completed. Request a new confirmation email and try again.";
  }
  return null;
}

/**
 * Purpose: Render email/password sign-in for unauthenticated users.
 * Inputs: Supabase SSR cookies.
 * Output: Login page or dashboard redirect.
 * Side effects: Redirects authenticated users.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getOptionalCurrentUser();
  if (user) redirect("/dashboard");
  const confirmationError = getConfirmationError((await searchParams).error);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 text-text-primary">
      <section className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-raised)]">
        <h1 className="font-display text-4xl">Rudo Quest</h1>
        <p className="mt-2 text-sm text-text-secondary">Sign in to plan the week.</p>
        {confirmationError ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-error/30 bg-error/10 p-3 text-sm leading-5 text-error"
          >
            {confirmationError}
          </p>
        ) : null}
        <div className="mt-6">
          <AuthForm mode="login" />
        </div>
        <p className="mt-1 flex min-h-9 flex-wrap items-center gap-x-1 text-sm text-text-secondary">
          New here?{" "}
          <Link
            className="inline-flex min-h-9 items-center font-semibold text-brand hover:underline"
            href="/signup"
          >
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
