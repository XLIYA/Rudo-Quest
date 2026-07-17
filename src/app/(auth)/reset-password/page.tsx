import { PasswordResetForm } from "@/features/auth/password-reset-form";

/**
 * Purpose: Render the password recovery page.
 * Inputs: Supabase recovery session in the browser URL.
 * Output: Password reset form.
 * Side effects: None during server rendering.
 */
export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-5 text-text-primary">
      <section className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-raised)]">
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">
          New password
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Choose a new password for your Rudo Quest account.
        </p>
        <div className="mt-6">
          <PasswordResetForm />
        </div>
      </section>
    </main>
  );
}
