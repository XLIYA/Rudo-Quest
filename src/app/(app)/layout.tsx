import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Purpose: Apply protected application navigation to app routes.
 * Inputs: Child route content.
 * Output: App shell wrapped page.
 * Side effects: None.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
