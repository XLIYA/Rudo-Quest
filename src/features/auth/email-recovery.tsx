"use client";

import { useState } from "react";
import { AppToast } from "@/components/ui/app-toast";
import { apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { AppButton } from "@/components/ui/app-button";
import { AppInput } from "@/components/ui/app-input";

type RecoveryKind = "password" | "verification";

/**
 * Purpose: Provide explicit password-recovery and verification-resend controls.
 * Inputs: Recovery mode selected by the user.
 * Output: Compact accessible email form.
 * Side effects: Sends a rate-limited public auth request.
 * Failure behavior: Shows a generic provider error without exposing account existence.
 */
export function EmailRecoveryActions({ initialKind }: { initialKind?: RecoveryKind }) {
  const [kind, setKind] = useState<RecoveryKind | null>(initialKind ?? null);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  /**
   * Purpose: Submit the selected generic recovery request.
   * Inputs: Recovery form event.
   * Output: Promise resolving after feedback is shown.
   * Side effects: Calls the auth API, resets input, and displays a toast.
   */
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!kind || !email) return;
    setPending(true);
    try {
      await apiMutation(
        "post",
        kind === "password"
          ? "/api/auth/password-reset-request"
          : "/api/auth/resend-verification",
        { email },
      );
      AppToast(
        kind === "password"
          ? "If an account matches, a recovery email is on its way."
          : "If an account matches, a verification email is on its way.",
        "success",
      );
      setEmail("");
    } catch (error) {
      AppToast(normalizeApiClientError(error).message, "error");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="mt-5 grid gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline"
          onClick={() => setKind(kind === "password" ? null : "password")}
        >
          Forgot password?
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline"
          onClick={() => setKind(kind === "verification" ? null : "verification")}
        >
          Resend verification email
        </button>
      </div>
      {kind ? (
        <form className="grid gap-3" onSubmit={submit}>
          <AppInput
            label="Account email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <AppButton type="submit" variant="secondary" disabled={pending || !email}>
            {pending
              ? "Sending…"
              : kind === "password"
                ? "Send recovery email"
                : "Send verification email"}
          </AppButton>
        </form>
      ) : null}
    </div>
  );
}
