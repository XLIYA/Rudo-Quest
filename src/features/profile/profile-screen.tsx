"use client";

import { addDays, format, parseISO } from "date-fns";
import { Activity, BellRing, Clock3, Link2, Upload, UserRound } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityHeatmap } from "@/components/shared/activity-heatmap";
import { PageHeader } from "@/components/shared/page-header";
import { AppAvatar } from "@/components/ui/app-avatar";
import { AppButton } from "@/components/ui/app-button";
import { AppCheckbox } from "@/components/ui/app-checkbox";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppInput } from "@/components/ui/app-input";
import { AppPagination } from "@/components/ui/app-pagination";
import { AppSelect } from "@/components/ui/app-select";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { AppTimePicker } from "@/components/ui/app-time-picker";
import { AppTimeZoneInput } from "@/components/ui/app-time-zone-input";
import { AppToast } from "@/components/ui/app-toast";
import { useOnline } from "@/hooks/use-online";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import {
  getPushBrowserState,
  subscribeCurrentBrowserToPush,
  unsubscribeCurrentBrowserFromPush,
  type PushBrowserState,
} from "@/lib/pwa/push";
import { cn } from "@/lib/utils/cn";
import {
  formatRelativeDay,
  getDateInTimeZone,
  getMondayWeekStart,
} from "@/lib/utils/dates";
import type { ActivityPageDto, ProfileDto, ThemePreference } from "@/types/domain";
import { cropProfileImage, uploadProfileAsset } from "./profile-assets";

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

function errorMessage(error: unknown): string {
  return normalizeApiClientError(error).message;
}

/**
 * Purpose: Render a compact profile workspace for identity, schedule, alerts, and activity.
 * Inputs: None.
 * Output: Responsive dashboard-style profile card grid.
 * Side effects: Reads and updates profile APIs, private avatar storage, and push state.
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
  const upload = useMutation({
    mutationFn: (file: File) => uploadProfileAsset("avatar", file),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data);
      AppToast("Avatar updated.", "success");
    },
    onError: (error) => AppToast(errorMessage(error), "error"),
  });
  const removeAvatar = useMutation({
    mutationFn: () => apiMutation<Profile>("delete", "/api/me/avatar"),
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

  const updateDraft = (values: Partial<ProfileDraft>) => {
    if (!profileKey || !draft) return;
    setDraftState({ key: profileKey, value: { ...draft, ...values } });
  };

  if (profile.isLoading) {
    return (
      <main className="mx-auto grid w-full max-w-[100rem] gap-4 p-5 md:p-8">
        <AppSkeleton className="h-14 w-64" />
        <div className="grid gap-4 lg:grid-cols-12">
          <AppSkeleton className="h-64 lg:col-span-4" />
          <AppSkeleton className="h-64 lg:col-span-8" />
          <AppSkeleton className="h-72 lg:col-span-7" />
          <AppSkeleton className="h-72 lg:col-span-5" />
        </div>
      </main>
    );
  }
  if (profile.isError || !profile.data || !draft) {
    return (
      <main className="p-5 md:p-8">
        <AppEmptyState
          title="Profile unavailable"
          description="Profile data could not be loaded. Check the connection and try again."
        />
      </main>
    );
  }

  const current = profile.data;
  const activityItems = activity.data?.pages.flatMap((page) => page.items) ?? [];
  const saveIdentity = () =>
    updateProfile.mutate({ displayName: draft.displayName, handle: draft.handle });
  const savePreferences = () =>
    updatePreferences.mutate({
      timeZone: draft.timeZone,
      dailyReminderTime: draft.dailyReminderTime?.trim() || null,
      quietHoursStart: draft.quietHoursStart,
      quietHoursEnd: draft.quietHoursEnd,
    });

  const handleAvatar = async (file: File | undefined) => {
    if (!file) return;
    try {
      upload.mutate(await cropProfileImage(file, 1));
    } catch (error) {
      AppToast(error instanceof Error ? error.message : "Image crop failed.", "error");
    }
  };

  const subscribeDevice = async () => {
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
  };

  const unsubscribeDevice = async () => {
    setPushPending(true);
    try {
      setPushState(await unsubscribeCurrentBrowserFromPush());
    } catch (error) {
      AppToast(errorMessage(error), "error");
    } finally {
      setPushPending(false);
    }
  };

  return (
    <main className="app-enter mx-auto grid w-full max-w-[100rem] gap-5 p-5 md:p-8">
      <PageHeader
        title="Profile"
        description="Tune your public identity, working rhythm, and account signals."
      />
      <fieldset
        disabled={!online}
        className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12"
      >
        <ProfileCard
          title="Explorer"
          description="Your collaborator-facing identity."
          icon={<UserRound className="size-4" />}
          className="overflow-hidden lg:col-span-4"
        >
          <div className="flex items-center gap-4">
            <AppAvatar
              name={current.displayName}
              src={current.avatarPath}
              className="size-20 border-4 border-surface-muted text-xl"
            />
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold">{current.displayName}</p>
              <p className="truncate font-mono text-xs text-text-secondary">
                @{current.handle}
              </p>
              <p className="mt-1 truncate text-xs text-text-tertiary">{current.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-md border border-border px-3 text-xs font-semibold transition-colors hover:border-border-strong hover:bg-surface-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand">
              <Upload className="size-4" aria-hidden="true" /> Change avatar
              <input
                className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                type="file"
                aria-label="Choose avatar image"
                accept="image/jpeg,image/png,image/webp"
                disabled={upload.isPending}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void handleAvatar(file);
                }}
              />
            </label>
            <AppButton
              variant="ghost"
              className="px-2 text-xs"
              onClick={() => removeAvatar.mutate()}
              disabled={!current.avatarPath || removeAvatar.isPending}
            >
              Remove
            </AppButton>
          </div>
        </ProfileCard>

        <ProfileCard
          title="Identity"
          description="Used in collaborator search and project activity."
          icon={<UserRound className="size-4" />}
          className="lg:col-span-8"
        >
          <div className="grid gap-3 sm:grid-cols-2">
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
        </ProfileCard>

        <ProfileCard
          title="Schedule"
          description="Theme, timezone, reminders, and quiet hours."
          icon={<Clock3 className="size-4" />}
          className="lg:col-span-8"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
            <AppTimePicker
              label="Daily reminder"
              value={draft.dailyReminderTime}
              onValueChange={(value) => updateDraft({ dailyReminderTime: value })}
              allowEmpty
              emptyLabel="No reminder"
            />
            <AppTimePicker
              label="Quiet hours start"
              value={draft.quietHoursStart}
              onValueChange={(value) =>
                value ? updateDraft({ quietHoursStart: value }) : undefined
              }
            />
            <AppTimePicker
              label="Quiet hours end"
              value={draft.quietHoursEnd}
              onValueChange={(value) =>
                value ? updateDraft({ quietHoursEnd: value }) : undefined
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
        </ProfileCard>

        <ProfileCard
          title="Notifications"
          description={pushStatusText(current, pushState)}
          icon={<BellRing className="size-4" />}
          className="lg:col-span-4"
        >
          <div className="grid gap-2">
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
          <div className="grid grid-cols-2 gap-2">
            <AppButton
              className="px-2 text-xs"
              onClick={() => void subscribeDevice()}
              disabled={
                pushPending ||
                updatePreferences.isPending ||
                !pushState.supported ||
                !pushState.configured ||
                pushState.subscribed
              }
            >
              Enable device
            </AppButton>
            <AppButton
              variant="secondary"
              className="px-2 text-xs"
              onClick={() => void unsubscribeDevice()}
              disabled={!pushState.subscribed || pushPending}
            >
              Unsubscribe
            </AppButton>
          </div>
          <Link
            href="/notifications"
            className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-brand hover:underline"
          >
            Open notification center
          </Link>
        </ProfileCard>

        <ProfileCard
          title="Completion rhythm"
          description={
            heatmap.data
              ? `${heatmap.data.heatmap.streak} day current completion streak.`
              : "Your last 13 weeks of completed work."
          }
          icon={<Activity className="size-4" />}
          className="lg:col-span-7"
        >
          {heatmap.isLoading ? <AppSkeleton className="h-40" /> : null}
          {heatmap.data ? (
            <ActivityHeatmap days={heatmap.data.heatmap.days} endDate={currentDate} />
          ) : null}
          {heatmap.isError ? (
            <p className="text-sm text-text-secondary">
              Completion history could not be loaded right now.
            </p>
          ) : null}
        </ProfileCard>

        <ProfileCard
          title="Account links"
          description="Security and project integrations."
          icon={<Link2 className="size-4" />}
          className="lg:col-span-5"
        >
          <p className="rounded-md bg-surface-muted p-3 text-sm text-text-secondary">
            GitHub connections are scoped to individual projects so collaborators only see
            the repository context they need.
          </p>
          <div className="grid gap-2">
            <AppButton
              variant="secondary"
              onClick={() => passwordReset.mutate()}
              disabled={passwordReset.isPending}
            >
              Send password reset email
            </AppButton>
            <AppButton asChild variant="secondary">
              <Link href="/projects">Manage project integrations</Link>
            </AppButton>
          </div>
        </ProfileCard>

        <ProfileCard
          title="Recent activity"
          description="Your latest task and collaboration events."
          icon={<Activity className="size-4" />}
          className="lg:col-span-12"
        >
          {activity.isLoading ? <AppSkeleton className="h-36" /> : null}
          {activityItems.length ? (
            <div className="grid max-h-72 gap-1 overflow-y-auto pr-1">
              {activityItems.slice(0, 20).map((event) => (
                <div
                  key={event.id}
                  className="grid gap-1 border-b border-border px-2 py-3 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <p className="text-sm">
                    <span className="font-semibold">
                      {event.actor?.displayName ?? "Someone"}
                    </span>{" "}
                    {event.label}
                  </p>
                  <span className="font-mono text-xs text-text-tertiary">
                    {formatRelativeDay(event.createdAt)} ·{" "}
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
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
        </ProfileCard>
      </fieldset>
    </main>
  );
}

function ProfileCard({
  title,
  description,
  icon,
  className,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn("app-card grid h-full content-start gap-4 p-4 md:p-5", className)}
    >
      <header className="flex items-start gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-text-secondary">{description}</p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function pushStatusText(profile: Profile, state: PushBrowserState): string {
  if (!state.supported) return "Push notifications are not supported in this browser.";
  if (!state.configured)
    return "Push notifications are not configured for this deployment.";
  if (state.permission === "denied")
    return "Browser permission is blocked for this site.";
  if (!profile.notificationsEnabled)
    return "Notifications are disabled for this account.";
  if (!state.subscribed)
    return "Notifications are enabled; subscribe this device for browser alerts.";
  return "This browser is subscribed for assignments and reminders.";
}
