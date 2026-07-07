"use client";

import { useTheme } from "next-themes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { AppAvatar } from "@/components/ui/app-avatar";
import { AppButton } from "@/components/ui/app-button";
import { AppInput } from "@/components/ui/app-input";
import { AppSelect } from "@/components/ui/app-select";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { PageHeader } from "@/components/shared/page-header";

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

/**
 * Purpose: Render editable profile, theme, timezone, notifications, and activity summary.
 * Inputs: None.
 * Output: Profile page.
 * Side effects: Fetches and updates profile preferences.
 */
export function ProfileScreen() {
  const { setTheme } = useTheme();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<Profile>("/api/me", signal),
  });
  const updatePrefs = useMutation({
    mutationFn: (body: Partial<Profile>) => apiMutation<Profile>("patch", "/api/me/preferences", body),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data);
      setTheme(data.themePreference);
    },
    onError: (error) => toast.error(normalizeApiClientError(error).message),
  });
  const updateProfile = useMutation({
    mutationFn: (body: Pick<Profile, "displayName" | "handle">) => apiMutation<Profile>("patch", "/api/me/profile", body),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.me, data),
    onError: (error) => toast.error(normalizeApiClientError(error).message),
  });
  if (!profile.data) return <main className="p-5 md:p-8"><AppEmptyState title="Profile unavailable" description="Sign in again to load profile data." /></main>;
  return (
    <main className="mx-auto grid max-w-4xl gap-5 p-5 md:p-8">
      <PageHeader title="Profile" description="Identity, theme, timezone, and notification preferences." />
      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-4">
          <AppAvatar name={profile.data.displayName} src={profile.data.avatarPath} className="size-16" />
          <div>
            <h2 className="text-xl font-semibold">{profile.data.displayName}</h2>
            <p className="font-mono text-sm text-text-secondary">@{profile.data.handle}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <AppInput
            label="Display name"
            defaultValue={profile.data.displayName}
            onBlur={(event) => updateProfile.mutate({ displayName: event.currentTarget.value, handle: profile.data.handle })}
          />
          <AppInput
            label="Handle"
            defaultValue={profile.data.handle}
            onBlur={(event) => updateProfile.mutate({ displayName: profile.data.displayName, handle: event.currentTarget.value })}
          />
          <AppSelect
            label="Theme"
            value={profile.data.themePreference}
            onValueChange={(value) => updatePrefs.mutate({ themePreference: value as Profile["themePreference"] })}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <AppInput
            label="Timezone"
            defaultValue={profile.data.timeZone}
            onBlur={(event) => updatePrefs.mutate({ timeZone: event.currentTarget.value })}
          />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <AppButton
            variant={profile.data.notificationsEnabled ? "primary" : "secondary"}
            onClick={() => updatePrefs.mutate({ notificationsEnabled: !profile.data.notificationsEnabled })}
          >
            {profile.data.notificationsEnabled ? "Notifications on" : "Notifications off"}
          </AppButton>
          <AppButton
            variant={profile.data.dailyReminderEnabled ? "primary" : "secondary"}
            onClick={() => updatePrefs.mutate({ dailyReminderEnabled: !profile.data.dailyReminderEnabled })}
          >
            Daily reminder
          </AppButton>
        </div>
      </section>
    </main>
  );
}
