"use client";

import { useTheme } from "next-themes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { AppAvatar } from "@/components/ui/app-avatar";
import { AppButton } from "@/components/ui/app-button";
import { AppInput } from "@/components/ui/app-input";
import { AppSelect } from "@/components/ui/app-select";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationsPanel } from "@/features/notifications/notifications-screen";
import {
  getPushBrowserState,
  subscribeCurrentBrowserToPush,
  unsubscribeCurrentBrowserFromPush,
  type PushBrowserState,
} from "@/lib/pwa/push";

type Profile = {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  bannerPath: string | null;
  themePreference: "system" | "light" | "dark";
  timeZone: string;
  notificationsEnabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string | null;
};

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return normalizeApiClientError(error).message;
}

/**
 * Purpose: Render editable profile, theme, timezone, notifications, and activity summary.
 * Inputs: None.
 * Output: Profile page.
 * Side effects: Fetches and updates profile preferences.
 */
export function ProfileScreen() {
  const { setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [pushState, setPushState] = useState<PushBrowserState>({
    supported: false,
    configured: false,
    permission: "unsupported",
    subscribed: false,
  });
  const profile = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<Profile>("/api/me", signal),
  });
  const updatePrefs = useMutation({
    mutationFn: (body: Partial<Profile>) =>
      apiMutation<Profile>("patch", "/api/me/preferences", body),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data);
      setTheme(data.themePreference);
    },
    onError: (error) => toast.error(normalizeApiClientError(error).message),
  });
  const updateProfile = useMutation({
    mutationFn: (body: Pick<Profile, "displayName" | "handle">) =>
      apiMutation<Profile>("patch", "/api/me/profile", body),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.me, data),
    onError: (error) => toast.error(normalizeApiClientError(error).message),
  });

  useEffect(() => {
    let ignore = false;
    if (!profile.data) return;
    void getPushBrowserState().then((state) => {
      if (!ignore) setPushState(state);
    });
    return () => {
      ignore = true;
    };
  }, [profile.data]);

  const toggleNotifications = async () => {
    if (!profile.data) return;
    if (profile.data.notificationsEnabled && pushState.subscribed) {
      try {
        setPushState(await unsubscribeCurrentBrowserFromPush());
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
      updatePrefs.mutate({
        notificationsEnabled: false,
        dailyReminderEnabled: false,
      });
      return;
    }

    try {
      setPushState(await subscribeCurrentBrowserToPush());
      updatePrefs.mutate({ notificationsEnabled: true });
      toast.success("Notifications enabled for this device.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const toggleDailyReminder = async () => {
    if (!profile.data) return;
    if (profile.data.dailyReminderEnabled) {
      updatePrefs.mutate({ dailyReminderEnabled: false });
      return;
    }

    if (!profile.data.notificationsEnabled || !pushState.subscribed) {
      try {
        setPushState(await subscribeCurrentBrowserToPush());
      } catch (error) {
        toast.error(getErrorMessage(error));
        return;
      }
    }

    updatePrefs.mutate({
      notificationsEnabled: true,
      dailyReminderEnabled: true,
    });
  };

  if (profile.isLoading) {
    return (
      <main className="mx-auto grid max-w-4xl gap-5 p-5 md:p-8">
        <AppSkeleton className="h-96" />
      </main>
    );
  }
  if (!profile.data) {
    return (
      <main className="p-5 md:p-8">
        <AppEmptyState
          title="Profile unavailable"
          description="Sign in again to load profile data."
        />
      </main>
    );
  }
  return (
    <main className="mx-auto grid max-w-4xl gap-5 p-5 md:p-8">
      <PageHeader
        title="Profile"
        description="Identity, appearance, timezone, and notifications."
      />
      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-4">
          <AppAvatar
            name={profile.data.displayName}
            src={profile.data.avatarPath}
            className="size-16"
          />
          <div>
            <h2 className="text-xl font-semibold">{profile.data.displayName}</h2>
            <p className="font-mono text-sm text-text-secondary">
              @{profile.data.handle}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <AppInput
            label="Display name"
            defaultValue={profile.data.displayName}
            onBlur={(event) =>
              updateProfile.mutate({
                displayName: event.currentTarget.value,
                handle: profile.data.handle,
              })
            }
          />
          <AppInput
            label="Handle"
            defaultValue={profile.data.handle}
            onBlur={(event) =>
              updateProfile.mutate({
                displayName: profile.data.displayName,
                handle: event.currentTarget.value,
              })
            }
          />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Appearance and schedule</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Theme and local reminder timing live here, not in the app navigation.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AppSelect
            label="Theme"
            value={profile.data.themePreference}
            onValueChange={(value) =>
              updatePrefs.mutate({ themePreference: value as Profile["themePreference"] })
            }
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <AppInput
            label="Timezone"
            defaultValue={profile.data.timeZone}
            onBlur={(event) =>
              updatePrefs.mutate({ timeZone: event.currentTarget.value })
            }
          />
          <AppInput
            label="Daily reminder time"
            type="time"
            defaultValue={profile.data.dailyReminderTime ?? ""}
            onBlur={(event) =>
              updatePrefs.mutate({
                dailyReminderTime: event.currentTarget.value.trim() || null,
              })
            }
          />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Notification preferences</h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {notificationStatus(profile.data, pushState)}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <AppButton
            variant={profile.data.notificationsEnabled ? "primary" : "secondary"}
            disabled={updatePrefs.isPending}
            onClick={toggleNotifications}
          >
            {notificationActionLabel(profile.data, pushState)}
          </AppButton>
          {profile.data.notificationsEnabled && !pushState.subscribed ? (
            <AppButton
              variant="secondary"
              disabled={updatePrefs.isPending}
              onClick={() =>
                updatePrefs.mutate({
                  notificationsEnabled: false,
                  dailyReminderEnabled: false,
                })
              }
            >
              Turn off
            </AppButton>
          ) : null}
          <AppButton
            variant={profile.data.dailyReminderEnabled ? "primary" : "secondary"}
            disabled={updatePrefs.isPending}
            onClick={toggleDailyReminder}
          >
            Daily reminder
          </AppButton>
        </div>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5">
        <NotificationsPanel compact />
      </section>
    </main>
  );
}

function notificationStatus(profile: Profile, pushState: PushBrowserState): string {
  if (!pushState.supported) {
    return "Push is not available in this browser. Install the PWA or use a browser with push support.";
  }
  if (!pushState.configured) {
    return "Push keys are not configured for this deployment.";
  }
  if (pushState.permission === "denied") {
    return "Browser notification permission is blocked for this site.";
  }
  if (!profile.notificationsEnabled) {
    return "Notifications are off. Turn them on to subscribe this device.";
  }
  if (!pushState.subscribed) {
    return "Notifications are on, but this device still needs to be subscribed.";
  }
  return "This device is subscribed for PWA notifications and daily reminders.";
}

function notificationActionLabel(profile: Profile, pushState: PushBrowserState): string {
  if (profile.notificationsEnabled && !pushState.subscribed) {
    return "Subscribe this device";
  }
  return profile.notificationsEnabled ? "Notifications on" : "Notifications off";
}
