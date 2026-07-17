import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentUser } from "@/server/auth/current-user";

/**
 * Purpose: Apply protected application navigation to app routes.
 * Inputs: Child route content.
 * Output: App shell wrapped page.
 * Side effects: Verifies the server session before streaming the client data shell.
 * Failure behavior: Rejects direct unauthenticated rendering even if proxy protection is bypassed.
 */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  await requireCurrentUser();
  return <AppShell>{children}</AppShell>;
}
