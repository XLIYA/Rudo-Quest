"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { AppToast } from "@/components/ui/app-toast";
import { useOnline } from "@/hooks/use-online";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { AppButton } from "@/components/ui/app-button";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppInput } from "@/components/ui/app-input";
import { AppSelect } from "@/components/ui/app-select";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import type { ProfileDto, ThemePreference } from "@/types/domain";
import {
  getPushBrowserState,
  subscribeCurrentBrowserToPush,
  unsubscribeCurrentBrowserFromPush,
  type PushBrowserState,
} from "@/lib/pwa/push";

/**
 * Purpose: Render a dedicated account/settings surface separate from the profile identity page.
 * Inputs: None.
 * Output: Settings controls for theme, timezone, quiet hours, notifications, security, and integrations.
 * Side effects: Reads and updates authenticated profile preferences and browser push subscriptions.
 * Failure behavior: Displays typed API errors as toasts and preserves cached settings.
 */
export function SettingsScreen() {
  const queryClient = useQueryClient();
  const online = useOnline();
  const { setTheme } = useTheme();
  const profile = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<ProfileDto>("/api/me", signal),
  });
  const [push, setPush] = useState<PushBrowserState>({
    supported: false,
    configured: false,
    permission: "unsupported",
    subscribed: false,
  });
  type SettingsDraft = Pick<
    ProfileDto,
    "quietHoursStart" | "quietHoursEnd" | "dailyReminderTime" | "timeZone"
  >;
  const [draftState, setDraftState] = useState<{
    key: string;
    value: SettingsDraft;
  } | null>(null);
  const preferences = useMutation({
    mutationFn: (values: Partial<ProfileDto>) =>
      apiMutation<ProfileDto>("patch", "/api/me/preferences", values),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data);
      setTheme(data.themePreference);
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });
  const resetPassword = useMutation({
    mutationFn: () => apiMutation("post", "/api/auth/password-reset"),
    onSuccess: () => AppToast("Password reset email sent.", "success"),
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  useEffect(() => {
    if (profile.data) {
      setTheme(profile.data.themePreference);
      void getPushBrowserState().then(setPush);
    }
  }, [profile.data, setTheme]);
  if (profile.isLoading)
    return (
      <main className="mx-auto max-w-4xl p-5 md:p-8">
        <AppSkeleton className="h-[32rem]" />
      </main>
    );
  if (!profile.data)
    return (
      <main className="p-5 md:p-8">
        <AppEmptyState
          title="Settings unavailable"
          description="Sign in again to load account settings."
        />
      </main>
    );
  const current = profile.data;
  const draftKey = `${current.id}:${current.themePreference}:${current.timeZone}:${current.dailyReminderTime ?? ""}:${current.quietHoursStart}:${current.quietHoursEnd}`;
  const draft =
    draftState?.key === draftKey
      ? draftState.value
      : {
          quietHoursStart: current.quietHoursStart,
          quietHoursEnd: current.quietHoursEnd,
          dailyReminderTime: current.dailyReminderTime,
          timeZone: current.timeZone,
        };
  const updateDraft = (values: Partial<SettingsDraft>) =>
    setDraftState({ key: draftKey, value: { ...draft, ...values } });
  return (
    <main className="mx-auto grid max-w-4xl gap-5 p-5 md:p-8">
      <PageHeader
        title="Settings"
        description="Control how Rudo Quest behaves on this account and device."
      />
      <fieldset disabled={!online} className="grid gap-5">
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <AppSelect
            label="Theme"
            value={current.themePreference}
            onValueChange={(value) =>
              preferences.mutate({ themePreference: value as ThemePreference })
            }
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </section>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Time and reminders</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <AppInput
              label="Timezone"
              value={draft.timeZone}
              onChange={(event) => updateDraft({ timeZone: event.currentTarget.value })}
            />
            <AppInput
              label="Daily reminder time"
              type="time"
              value={draft.dailyReminderTime ?? ""}
              onChange={(event) =>
                updateDraft({ dailyReminderTime: event.currentTarget.value || null })
              }
            />
            <AppInput
              label="Quiet hours start"
              type="time"
              value={draft.quietHoursStart}
              onChange={(event) =>
                updateDraft({ quietHoursStart: event.currentTarget.value })
              }
            />
            <AppInput
              label="Quiet hours end"
              type="time"
              value={draft.quietHoursEnd}
              onChange={(event) =>
                updateDraft({ quietHoursEnd: event.currentTarget.value })
              }
            />
          </div>
          <AppButton
            className="w-fit"
            onClick={() =>
              preferences.mutate({
                timeZone: draft.timeZone,
                dailyReminderTime: draft.dailyReminderTime || null,
                quietHoursStart: draft.quietHoursStart,
                quietHoursEnd: draft.quietHoursEnd,
              })
            }
            disabled={preferences.isPending}
          >
            Save schedule
          </AppButton>
        </section>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Notifications and push</h2>
          <p className="text-sm text-text-secondary">
            {push.supported
              ? push.subscribed
                ? "This device is subscribed."
                : "This device is not subscribed."
              : "Push is not supported in this browser."}
          </p>
          <div className="flex flex-wrap gap-2">
            <AppButton
              onClick={async () => {
                try {
                  setPush(await subscribeCurrentBrowserToPush());
                  preferences.mutate({ notificationsEnabled: true });
                } catch (error) {
                  AppToast(normalizeApiClientError(error).message, "error");
                }
              }}
              disabled={!push.supported || push.subscribed || preferences.isPending}
            >
              Enable push
            </AppButton>
            <AppButton
              variant="secondary"
              onClick={async () => {
                try {
                  setPush(await unsubscribeCurrentBrowserFromPush());
                  preferences.mutate({
                    notificationsEnabled: false,
                    dailyReminderEnabled: false,
                  });
                } catch (error) {
                  AppToast(normalizeApiClientError(error).message, "error");
                }
              }}
              disabled={!push.subscribed || preferences.isPending}
            >
              Unsubscribe
            </AppButton>
          </div>
        </section>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Account and security</h2>
          <p className="text-sm text-text-secondary">{current.email}</p>
          <AppButton
            variant="secondary"
            className="w-fit"
            onClick={() => resetPassword.mutate()}
            disabled={resetPassword.isPending}
          >
            Send password reset email
          </AppButton>
        </section>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">GitHub App</h2>
          <p className="text-sm text-text-secondary">
            GitHub installations and repository connections are scoped to projects and
            never expose installation tokens.
          </p>
          <Link
            href="/projects"
            className="w-fit text-sm font-semibold text-brand hover:underline"
          >
            Open project connections
          </Link>
        </section>
      </fieldset>
    </main>
  );
}
