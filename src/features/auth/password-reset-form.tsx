"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppToast } from "@/components/ui/app-toast";
import { apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { AppButton } from "@/components/ui/app-button";
import { AppInput } from "@/components/ui/app-input";
import { clearUserQueryCache, getActiveCachedUserId } from "@/lib/pwa/query-persistence";

/**
 * Purpose: Complete a Supabase password recovery session from the reset link.
 * Inputs: New password and confirmation.
 * Output: Accessible password update form.
 * Side effects: Updates the current Supabase Auth user and redirects to login.
 * Failure behavior: Shows a generic validation/provider error without leaking account state.
 */
export function PasswordResetForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  /**
   * Purpose: Validate and commit a recovered account password.
   * Inputs: Password-reset form event.
   * Output: Promise resolving after redirect or error feedback.
   * Side effects: Mutates auth state, clears private cache, and redirects to login.
   */
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8 || password !== confirmation) {
      AppToast("Use at least 8 characters and make both passwords match.", "error");
      return;
    }
    setPending(true);
    try {
      await apiMutation("patch", "/api/auth/password-reset", { password });
      const cachedUserId = await getActiveCachedUserId();
      if (cachedUserId) await clearUserQueryCache(cachedUserId);
      queryClient.clear();
      AppToast("Password updated. Sign in with your new password.", "success");
      router.replace("/login?password_reset=success");
      router.refresh();
    } catch (error) {
      AppToast(normalizeApiClientError(error).message, "error");
    } finally {
      setPending(false);
    }
  };
  return (
    <form className="grid gap-4" onSubmit={submit}>
      <AppInput
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
      />
      <AppInput
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={(event) => setConfirmation(event.currentTarget.value)}
      />
      <AppButton type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </AppButton>
    </form>
  );
}
