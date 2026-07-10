"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { AppButton } from "@/components/ui/app-button";
import { AppInput } from "@/components/ui/app-input";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const signupSchema = loginSchema.extend({
  displayName: z.string().min(2).max(60),
  password: z.string().min(8).max(128),
});

type AuthValues = {
  email: string;
  password: string;
  displayName?: string;
};

export function getSafePostLoginPath(next: string | null): Route {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  try {
    const parsed = new URL(next, "https://rudo.local");
    if (parsed.origin !== "https://rudo.local") return "/dashboard";
    return `${parsed.pathname}${parsed.search}${parsed.hash}` as Route;
  } catch {
    return "/dashboard";
  }
}

/**
 * Purpose: Render and submit login/signup forms through the central Axios client.
 * Inputs: Auth mode.
 * Output: Accessible auth form.
 * Side effects: Calls auth API routes, redirects on success, shows toasts on failure.
 */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const search = useSearchParams();
  const schema = mode === "login" ? loginSchema : signupSchema;
  const form = useForm<AuthValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", ...(mode === "signup" ? { displayName: "" } : {}) },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await apiMutation("post", mode === "login" ? "/api/auth/signin" : "/api/auth/signup", values);
      if (mode === "signup") {
        router.push("/verify-email");
      } else {
        router.push(getSafePostLoginPath(search.get("next")));
      }
      router.refresh();
    } catch (error) {
      const normalized = normalizeApiClientError(error);
      toast.error(normalized.message);
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-4">
      {mode === "signup" ? (
        <AppInput
          label="Display name"
          autoComplete="name"
          error={form.formState.errors.displayName?.message}
          {...form.register("displayName")}
        />
      ) : null}
      <AppInput label="Email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register("email")} />
      <AppInput
        label="Password"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      <AppButton type="submit" disabled={form.formState.isSubmitting}>
        {mode === "login" ? "Sign in" : "Create account"}
      </AppButton>
    </form>
  );
}
