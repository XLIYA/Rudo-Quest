import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getMyProfile } from "@/server/services/profile-service";
import { getNotifications } from "@/server/services/notification-service";

/**
 * Purpose: Apply protected application navigation to app routes with
 * server-fetched shell data so profile and notification chrome render
 * without client-side flicker or forced refetches.
 * Inputs: Child route content.
 * Output: App shell wrapped page.
 * Side effects: Verifies the server session, reads the profile and first
 * notification page before streaming the client data shell.
 * Failure behavior: Rejects direct unauthenticated rendering even if proxy
 * protection is bypassed; shell data failures fall back to client fetching
 * instead of blocking the page.
 */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  let user;
  try {
    user = await requireCurrentUser();
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/login");
    throw error;
  }
  const [profile, notifications] = await Promise.allSettled([
    getMyProfile(user.id),
    getNotifications(user.id),
  ]);
  const initialProfile = profile.status === "fulfilled" ? profile.value : undefined;
  const initialNotifications =
    notifications.status === "fulfilled" ? notifications.value : undefined;
  return (
    <AppShell initialProfile={initialProfile} initialNotifications={initialNotifications}>
      {children}
    </AppShell>
  );
}
