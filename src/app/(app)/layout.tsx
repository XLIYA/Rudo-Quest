import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getNotifications } from "@/server/services/notification-service";
import { getMyProfile } from "@/server/services/profile-service";

/**
 * Purpose: Apply protected application navigation to app routes.
 * Inputs: Child route content.
 * Output: App shell wrapped page.
 * Side effects: Verifies the server session and reads the current profile once.
 * Failure behavior: Rejects direct unauthenticated rendering even if proxy protection is bypassed.
 */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser();
  const [profile, notifications] = await Promise.all([
    getMyProfile(user.id),
    getNotifications(user.id),
  ]);
  return (
    <AppShell initialProfile={profile} initialNotifications={notifications}>
      {children}
    </AppShell>
  );
}
