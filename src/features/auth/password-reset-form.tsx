"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppToast } from "@/components/ui/app-toast";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { AppButton } from "@/components/ui/app-button";
import { AppInput } from "@/components/ui/app-input";

/**
 * Purpose: Complete a Supabase password recovery session from the reset link.
 * Inputs: New password and confirmation.
 * Output: Accessible password update form.
 * Side effects: Updates the current Supabase Auth user and redirects to login.
 * Failure behavior: Shows a generic validation/provider error without leaking account state.
 */
export function PasswordResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8 || password !== confirmation) {
      AppToast("Use at least 8 characters and make both passwords match.", "error");
      return;
    }
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      AppToast("Password updated. Sign in with your new password.", "success");
      router.replace("/login?password_reset=success");
      router.refresh();
    } catch {
      AppToast("The password reset link is invalid or expired.", "error");
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
