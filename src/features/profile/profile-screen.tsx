"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { AppToast } from "@/components/ui/app-toast";
import { useOnline } from "@/hooks/use-online";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { AppAvatar } from "@/components/ui/app-avatar";
import { AppButton } from "@/components/ui/app-button";
import { AppCheckbox } from "@/components/ui/app-checkbox";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppInput } from "@/components/ui/app-input";
import { AppTimeZoneInput } from "@/components/ui/app-time-zone-input";
import { AppSelect } from "@/components/ui/app-select";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { AppPagination } from "@/components/ui/app-pagination";
import { PageHeader } from "@/components/shared/page-header";
import { ActivityHeatmap } from "@/components/shared/activity-heatmap";
import type {
  ActivityPageDto,
  BannerPresetKey,
  ProfileDto,
  ThemePreference,
} from "@/types/domain";
import { bannerPresetKeys } from "@/types/domain";
import { cropProfileImage, uploadProfileAsset } from "./profile-assets";
import {
  getPushBrowserState,
  subscribeCurrentBrowserToPush,
  unsubscribeCurrentBrowserFromPush,
  type PushBrowserState,
} from "@/lib/pwa/push";
import {
  formatRelativeDay,
  getDateInTimeZone,
  getMondayWeekStart,
} from "@/lib/utils/dates";

type Profile = ProfileDto;
type ProfileDraft = Pick<
  Profile,
  | "displayName"
  | "handle"
  | "timeZone"
  | "dailyReminderTime"
  | "quietHoursStart"
  | "quietHoursEnd"
>;

type ProfileHeatmapData = {
  heatmap: { days: { date: string; count: number }[]; streak: number };
};

const bannerLabels: Record<BannerPresetKey, string> = {
  sunrise: "Sunrise route",
  trail: "Trail map",
  night: "Night watch",
};

/**
 * Purpose: Convert a caught API failure into safe profile-page feedback.
 * Inputs: Unknown caught value.
 * Output: Normalized user-facing message.
 * Side effects: None.
 */
function errorMessage(error: unknown): string {
  return normalizeApiClientError(error).message;
}

/**
 * Purpose: Render the authenticated profile surface with identity, private media, preferences, activity, and push controls.
 * Inputs: None.
 * Output: Profile management page.
 * Side effects: Reads and updates profile APIs, signed storage assets, and browser push state.
 * Failure behavior: Shows typed toasts while preserving the last successful profile cache.
 */
export function ProfileScreen() {
  const queryClient = useQueryClient();
  const online = useOnline();
  const { setTheme } = useTheme();
  const profile = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<Profile>("/api/me", signal),
  });
  const activity = useInfiniteQuery({
    queryKey: queryKeys.activity(),
    queryFn: ({ pageParam, signal }) =>
      apiGet<ActivityPageDto>(
        `/api/activity${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`,
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.cursor,
    enabled: Boolean(profile.data),
  });
  const profileTimeZone =
    profile.data?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const currentDate = getDateInTimeZone(new Date(), profileTimeZone);
  const currentWeekStart = getMondayWeekStart(parseISO(currentDate));
  const currentWeekEnd = format(addDays(parseISO(currentWeekStart), 6), "yyyy-MM-dd");
  const heatmap = useQuery({
    queryKey: queryKeys.dashboard(currentWeekStart, currentWeekEnd),
    queryFn: ({ signal }) =>
      apiGet<ProfileHeatmapData>(
        `/api/dashboard?from=${currentWeekStart}&to=${currentWeekEnd}`,
        signal,
      ),
    enabled: Boolean(profile.data),
  });
  const [draftState, setDraftState] = useState<{
    key: string;
    value: ProfileDraft;
  } | null>(null);
  const [pushState, setPushState] = useState<PushBrowserState>({
    supported: false,
    configured: false,
    permission: "unsupported",
    subscribed: false,
  });
  const [pushPending, setPushPending] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setTheme(profile.data.themePreference);
    void getPushBrowserState().then(setPushState);
  }, [profile.data, setTheme]);

  const updateProfile = useMutation({
    mutationFn: (values: Pick<Profile, "displayName" | "handle">) =>
      apiMutation<Profile>("patch", "/api/me/profile", values),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.me, data),
    onError: (error) => AppToast(errorMessage(error), "error"),
  });
  const updatePreferences = useMutation({
    mutationFn: (values: Partial<Profile>) =>
      apiMutation<Profile>("patch", "/api/me/preferences", values),
    onMutate: (values) => {
      const previousTheme = profile.data?.themePreference ?? "system";
      if (values.themePreference) setTheme(values.themePreference);
      return { previousTheme };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data);
      setTheme(data.themePreference);
    },
    onError: (error, _values, context) => {
      setTheme(context?.previousTheme ?? "system");
      AppToast(errorMessage(error), "error");
    },
  });
  const preset = useMutation({
    mutationFn: (presetKey: BannerPresetKey) =>
      apiMutation<Profile>("patch", "/api/me/banner/preset", { presetKey }),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.me, data),
    onError: (error) => AppToast(errorMessage(error), "error"),
  });
  const upload = useMutation({
    mutationFn: (input: { kind: "avatar" | "banner"; file: File }) =>
      uploadProfileAsset(input.kind, input.file),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data);
      AppToast("Profile image updated.", "success");
    },
    onError: (error) => AppToast(errorMessage(error), "error"),
  });
  const removeAsset = useMutation({
    mutationFn: (kind: "avatar" | "banner") =>
      apiMutation<Profile>("delete", `/api/me/${kind}`),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.me, data),
    onError: (error) => AppToast(errorMessage(error), "error"),
  });
  const passwordReset = useMutation({
    mutationFn: () => apiMutation("post", "/api/auth/password-reset"),
    onSuccess: () => AppToast("A password reset email has been sent.", "success"),
    onError: (error) => AppToast(errorMessage(error), "error"),
  });

  const profileKey = profile.data
    ? `${profile.data.id}:${profile.data.displayName}:${profile.data.handle}:${profile.data.timeZone}:${profile.data.dailyReminderTime ?? ""}:${profile.data.quietHoursStart}:${profile.data.quietHoursEnd}`
    : null;
  const draft = profile.data
    ? draftState?.key === profileKey
      ? draftState.value
      : {
          displayName: profile.data.displayName,
          handle: profile.data.handle,
          timeZone: profile.data.timeZone,
          dailyReminderTime: profile.data.dailyReminderTime,
          quietHoursStart: profile.data.quietHoursStart,
          quietHoursEnd: profile.data.quietHoursEnd,
        }
    : null;
  /**
   * Purpose: Merge profile form edits without copying server state into a global store.
   * Inputs: Partial identity/reminder draft.
   * Output: Void.
   * Side effects: Updates version-keyed local form state.
   */
  const updateDraft = (values: Partial<ProfileDraft>) => {
    if (!profileKey || !draft) return;
    setDraftState({ key: profileKey, value: { ...draft, ...values } });
  };

  if (profile.isLoading)
    return (
      <main className="mx-auto max-w-4xl p-5 md:p-8">
        <AppSkeleton className="h-[42rem]" />
      </main>
    );
  if (profile.isError || !profile.data || !draft)
    return (
      <main className="p-5 md:p-8">
        <AppEmptyState
          title="Profile unavailable"
          description="Profile data could not be loaded. Check the connection and try again."
        />
      </main>
    );
  const current = profile.data;
  const activityItems = activity.data?.pages.flatMap((page) => page.items) ?? [];
  const bannerSrc =
    current.bannerPath ??
    (current.bannerPresetKey ? `/banners/${current.bannerPresetKey}.svg` : null);

  /**
   * Purpose: Crop a selected image to the required profile aspect ratio before upload.
   * Inputs: Asset kind and optional browser file.
   * Output: Promise resolving after the upload mutation starts.
   * Side effects: Decodes/crops client-side image bytes and starts signed upload.
   * Failure behavior: Displays validation or crop failures without changing the profile.
   */
  const handleFile = async (kind: "avatar" | "banner", file: File | undefined) => {
    if (!file) return;
    try {
      const cropped = await cropProfileImage(file, kind === "avatar" ? 1 : 2.8);
      upload.mutate({ kind, file: cropped });
    } catch (error) {
      AppToast(error instanceof Error ? error.message : "Image crop failed.", "error");
    }
  };

  /**
   * Purpose: Persist the current display-name and handle draft.
   * Inputs: None.
   * Output: Void.
   * Side effects: Starts the identity mutation.
   */
  const saveIdentity = () =>
    updateProfile.mutate({ displayName: draft.displayName, handle: draft.handle });
  /**
   * Purpose: Persist timezone and reminder-window draft values.
   * Inputs: None.
   * Output: Void.
   * Side effects: Starts the preference mutation.
   */
  const savePreferences = () =>
    updatePreferences.mutate({
      timeZone: draft.timeZone,
      dailyReminderTime: draft.dailyReminderTime?.trim() || null,
      quietHoursStart: draft.quietHoursStart,
      quietHoursEnd: draft.quietHoursEnd,
    });

  return (
    <main className="mx-auto grid max-w-5xl gap-5 p-5 md:p-8">
      <PageHeader
        title="Profile"
        description="Your identity, rhythm, and notification controls."
      />
      <fieldset disabled={!online} className="grid gap-5">
        <section className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="relative h-40 bg-brand-soft">
            {bannerSrc ? (
              <Image
                src={bannerSrc}
                alt="Profile banner"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 960px"
              />
            ) : null}
          </div>
          <div className="grid gap-5 p-5 md:grid-cols-[auto_1fr] md:items-end">
            <AppAvatar
              name={current.displayName}
              src={current.avatarPath}
              className="-mt-14 size-24 border-4 border-surface text-xl"
            />
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">{current.displayName}</h2>
                <p className="font-mono text-sm text-text-secondary">@{current.handle}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="relative inline-flex min-h-12 cursor-pointer items-center overflow-hidden rounded-md border border-border px-3 text-sm font-semibold hover:bg-surface-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
                  Upload avatar
                  <input
                    className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    type="file"
                    aria-label="Choose avatar image"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={upload.isPending}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      void handleFile("avatar", file);
                    }}
                  />
                </label>
                {current.avatarPath ? (
                  <AppButton
                    variant="ghost"
                    onClick={() => removeAsset.mutate("avatar")}
                    disabled={removeAsset.isPending}
                  >
                    Remove avatar
                  </AppButton>
                ) : null}
              </div>
            </div>
          </div>
        </section>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-lg font-semibold">Banner</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Choose a quiet preset or crop a private image to fit the explorer header.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {bannerPresetKeys.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={current.bannerPresetKey === key}
                disabled={preset.isPending}
                onClick={() => preset.mutate(key)}
                className={`overflow-hidden rounded-md border text-left focus-visible:outline-2 focus-visible:outline-brand ${current.bannerPresetKey === key ? "border-brand" : "border-border"}`}
              >
                <Image
                  src={`/banners/${key}.svg`}
                  alt=""
                  width={360}
                  height={128}
                  className="h-24 w-full object-cover"
                />
                <span className="block p-2 text-sm font-semibold">
                  {bannerLabels[key]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative inline-flex min-h-12 cursor-pointer items-center overflow-hidden rounded-md border border-border px-3 text-sm font-semibold hover:bg-surface-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
              Upload banner
              <input
                className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                type="file"
                aria-label="Choose banner image"
                accept="image/jpeg,image/png,image/webp"
                disabled={upload.isPending}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void handleFile("banner", file);
                }}
              />
            </label>
            {current.bannerPath ? (
              <AppButton
                variant="ghost"
                onClick={() => removeAsset.mutate("banner")}
                disabled={removeAsset.isPending}
              >
                Remove banner
              </AppButton>
            ) : null}
          </div>
        </section>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-lg font-semibold">Identity</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Public profile fields used in collaborator search.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <AppInput
              label="Display name"
              value={draft.displayName}
              onChange={(event) =>
                updateDraft({ displayName: event.currentTarget.value })
              }
            />
            <AppInput
              label="Handle"
              value={draft.handle}
              onChange={(event) => updateDraft({ handle: event.currentTarget.value })}
            />
          </div>
          <AppButton
            className="w-fit"
            onClick={saveIdentity}
            disabled={updateProfile.isPending}
          >
            Save identity
          </AppButton>
        </section>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-lg font-semibold">Preferences</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Theme and reminders follow your timezone.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AppSelect
              label="Theme"
              value={current.themePreference}
              onValueChange={(value) =>
                updatePreferences.mutate({ themePreference: value as ThemePreference })
              }
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
            <AppTimeZoneInput
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
            onClick={savePreferences}
            disabled={updatePreferences.isPending}
          >
            Save schedule
          </AppButton>
        </section>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Permission is requested only when you explicitly subscribe this device.
            </p>
          </div>
          <p className="text-sm text-text-secondary">
            {pushStatusText(current, pushState)}
          </p>
          <div className="flex flex-wrap gap-2">
            <AppButton
              onClick={async () => {
                setPushPending(true);
                try {
                  const nextState = await subscribeCurrentBrowserToPush();
                  try {
                    await updatePreferences.mutateAsync({ notificationsEnabled: true });
                    setPushState(nextState);
                  } catch {
                    setPushState(await unsubscribeCurrentBrowserFromPush());
                  }
                } catch (error) {
                  if (normalizeApiClientError(error).code === "CLIENT_ERROR") {
                    AppToast(errorMessage(error), "error");
                  }
                } finally {
                  setPushPending(false);
                }
              }}
              disabled={
                pushPending ||
                updatePreferences.isPending ||
                !pushState.supported ||
                !pushState.configured ||
                pushState.subscribed
              }
            >
              Enable this device
            </AppButton>
            <AppButton
              variant="secondary"
              onClick={async () => {
                setPushPending(true);
                try {
                  setPushState(await unsubscribeCurrentBrowserFromPush());
                } catch (error) {
                  AppToast(errorMessage(error), "error");
                } finally {
                  setPushPending(false);
                }
              }}
              disabled={!pushState.subscribed || pushPending}
            >
              Unsubscribe this device
            </AppButton>
            <AppCheckbox
              label="Account notifications"
              checked={current.notificationsEnabled}
              onCheckedChange={(checked) =>
                updatePreferences.mutate({ notificationsEnabled: checked === true })
              }
              disabled={updatePreferences.isPending}
            />
            <AppCheckbox
              label="Daily reminders"
              checked={current.dailyReminderEnabled}
              onCheckedChange={(checked) =>
                updatePreferences.mutate({ dailyReminderEnabled: checked === true })
              }
              disabled={!current.notificationsEnabled || updatePreferences.isPending}
            />
          </div>
          <Link
            href="/notifications"
            className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-brand hover:underline"
          >
            Open notification center
          </Link>
        </section>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-lg font-semibold">Completion rhythm</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {heatmap.data
                ? `${heatmap.data.heatmap.streak} day current completion streak.`
                : "Your last 13 weeks of completed work."}
            </p>
          </div>
          {heatmap.isLoading ? <AppSkeleton className="h-40" /> : null}
          {heatmap.data ? (
            <ActivityHeatmap days={heatmap.data.heatmap.days} endDate={currentDate} />
          ) : null}
          {heatmap.isError ? (
            <p className="text-sm text-text-secondary">
              Completion history could not be loaded right now.
            </p>
          ) : null}
        </section>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-lg font-semibold">Account and integrations</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {current.email} · GitHub connections are managed per project.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AppButton
              variant="secondary"
              onClick={() => passwordReset.mutate()}
              disabled={passwordReset.isPending}
            >
              Send password reset email
            </AppButton>
            <Link
              href="/projects"
              className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-surface-muted"
            >
              Manage GitHub by project
            </Link>
          </div>
        </section>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-lg font-semibold">Activity</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Recent work and collaboration events.
            </p>
          </div>
          {activity.isLoading ? <AppSkeleton className="h-32" /> : null}
          {activityItems.length ? (
            <div className="grid gap-2">
              {activityItems.slice(0, 20).map((event) => (
                <p key={event.id} className="rounded-md bg-surface-muted p-3 text-sm">
                  <span className="font-semibold">
                    {event.actor?.displayName ?? "Someone"}
                  </span>{" "}
                  {event.label}
                  <span className="mt-1 block font-mono text-xs text-text-tertiary">
                    {formatRelativeDay(event.createdAt)} ·{" "}
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </p>
              ))}
            </div>
          ) : null}
          {!activity.isLoading && !activityItems.length ? (
            <AppEmptyState
              title="No activity yet"
              description="Your completed work and project changes will appear here."
            />
          ) : null}
          <AppPagination
            hasNext={Boolean(activity.hasNextPage)}
            pending={activity.isFetchingNextPage}
            label="Load older activity"
            pendingLabel="Loading older activity…"
            onNext={() => void activity.fetchNextPage()}
          />
        </section>
      </fieldset>
    </main>
  );
}

/**
 * Purpose: Explain the effective browser/account push state in plain language.
 * Inputs: Current profile preferences and browser capability/subscription state.
 * Output: User-facing status sentence.
 * Side effects: None.
 */
function pushStatusText(profile: Profile, state: PushBrowserState): string {
  if (!state.supported) return "Push notifications are not supported in this browser.";
  if (!state.configured)
    return "Push notifications are not configured for this deployment.";
  if (state.permission === "denied")
    return "Browser permission is blocked for this site.";
  if (!profile.notificationsEnabled)
    return "Notifications are disabled for this account.";
  if (!state.subscribed)
    return "Notifications are enabled; subscribe this device to receive browser alerts.";
  return "This browser is subscribed for safe assignment and reminder alerts.";
}
