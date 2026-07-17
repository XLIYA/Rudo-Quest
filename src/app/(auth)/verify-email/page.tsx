import Link from "next/link";
import { EmailRecoveryActions } from "@/features/auth/email-recovery";

/**
 * Purpose: Explain email verification after signup.
 * Inputs: None.
 * Output: Verification instructions.
 * Side effects: None.
 */
export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 text-text-primary">
      <section className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center shadow-[var(--shadow-raised)]">
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">
          Check email
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Supabase sent a verification link. After verification, sign in to open Rudo
          Quest.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-white"
          href="/login"
        >
          Back to sign in
        </Link>
        <EmailRecoveryActions initialKind="verification" />
      </section>
    </main>
  );
}
