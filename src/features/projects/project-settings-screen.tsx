"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppToast } from "@/components/ui/app-toast";
import Link from "next/link";
import {
  GitBranch,
  Trash2,
  ExternalLink,
  Loader2,
  ChevronLeft,
  Save,
} from "lucide-react";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { AppButton } from "@/components/ui/app-button";
import { AppDialog } from "@/components/ui/app-dialog";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { AppAvatar } from "@/components/ui/app-avatar";
import { PageHeader } from "@/components/shared/page-header";
import { AppSelect } from "@/components/ui/app-select";
import { AppIconButton } from "@/components/ui/app-icon-button";
import { AppInput } from "@/components/ui/app-input";
import { AppTimeZoneInput } from "@/components/ui/app-time-zone-input";
import { AppTextarea } from "@/components/ui/app-textarea";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import { AppCombobox } from "@/components/ui/app-combobox";
import {
  ProjectColorPicker,
  ProjectIconPicker,
} from "@/features/projects/project-pickers";
import type {
  ProjectColorKey,
  ProjectIconKey,
  ProjectRole,
  ProjectSummary,
} from "@/types/domain";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils/cn";

type GitHubInstallation = {
  id: string;
  githubInstallationId: number;
  githubAccountLogin: string;
  githubAccountType: string;
};

type ProjectRepositoryConnection = {
  id: string;
  githubInstallationId: string;
  repositoryId: number;
  repositoryFullName: string;
  repositoryUrl: string;
  defaultBranch: string | null;
};

type AvailableGitHubRepository = {
  id: number;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string | null;
};

const nonOwnerRoles: Exclude<ProjectRole, "OWNER">[] = ["ADMIN", "MEMBER", "VIEWER"];

/**
 * Purpose: Render a consistent project-settings section.
 * Inputs: Section title and content.
 * Output: Bordered settings section.
 * Side effects: None.
 */
function SettingsSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("app-card h-full min-w-0 overflow-hidden p-4 md:p-5", className)}
    >
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
        <span className="h-6 w-1 rounded-full bg-quest" aria-hidden="true" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/**
 * Purpose: Render one clearly destructive project setting.
 * Inputs: Action label, explanation, and control.
 * Output: Responsive danger-zone row.
 * Side effects: None beyond the supplied action control.
 */
function DangerZoneItem({
  label,
  description,
  action,
}: {
  label: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <span className="font-medium text-error">{label}</span>
        <span className="mt-1 block text-sm text-text-secondary">{description}</span>
      </div>
      <div className="flex w-full shrink-0 sm:w-auto sm:min-w-44 sm:justify-end [&>*]:w-full [&>*]:whitespace-nowrap">
        {action}
      </div>
    </div>
  );
}

/**
 * Purpose: Render authorized project metadata, membership, invitation, repository, and archive controls.
 * Inputs: Server-derived GitHub integration availability.
 * Output: Responsive project settings screen.
 * Side effects: Reads and mutates project resources through typed API hooks.
 * Failure behavior: Preserves current state and surfaces typed API failures.
 */
export function ProjectSettingsScreen({
  githubConfigured,
}: {
  githubConfigured: boolean;
}) {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const online = useOnline();

  const project = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) => apiGet<ProjectSummary>(`/api/projects/${projectId}`, signal),
  });
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<{ id: string }>("/api/me", signal),
  });

  const members = useQuery({
    queryKey: queryKeys.projectMembers(projectId),
    queryFn: ({ signal }) =>
      apiGet<
        {
          id: string;
          handle: string;
          displayName: string;
          avatarUrl: string | null;
          role: ProjectRole;
        }[]
      >(`/api/projects/${projectId}/members`, signal),
    enabled: !!projectId,
  });

  const invitations = useQuery({
    queryKey: queryKeys.projectInvitations(projectId),
    queryFn: ({ signal }) =>
      apiGet<
        {
          id: string;
          invitedUserId: string;
          handle: string;
          displayName: string;
          avatarUrl: string | null;
          role: ProjectRole;
          status: string;
          expiresAt: string;
        }[]
      >(`/api/projects/${projectId}/invitations`, signal),
    enabled: Boolean(
      projectId &&
      !project.data?.archivedAt &&
      (project.data?.role === "OWNER" || project.data?.role === "ADMIN"),
    ),
  });

  const githubRepo = useQuery({
    queryKey: queryKeys.projectGithubRepo(projectId),
    queryFn: ({ signal }) =>
      apiGet<ProjectRepositoryConnection | null>(
        `/api/projects/${projectId}/github/repositories`,
        signal,
      ),
    enabled: !!projectId,
  });

  const githubInstallations = useQuery({
    queryKey: ["github-installations"],
    queryFn: ({ signal }) =>
      apiGet<GitHubInstallation[]>(`/api/github/installations`, signal),
    enabled:
      githubConfigured &&
      (project.data?.role === "OWNER" || project.data?.role === "ADMIN"),
  });

  const archiveProject = useMutation({
    mutationFn: () => apiMutation("delete", `/api/projects/${projectId}`),
    onSuccess: () => {
      AppToast("Project archived", "success");
      router.push("/projects");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const updateProject = useMutation({
    mutationFn: (
      body: Partial<
        Pick<ProjectSummary, "title" | "description" | "iconKey" | "colorKey">
      > & { timeZone?: string },
    ) => apiMutation<ProjectSummary>("patch", `/api/projects/${projectId}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      AppToast("Project details updated.", "success");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const connectGithub = useMutation({
    mutationFn: (body: { githubInstallationId: string; repositoryId: number }) =>
      apiMutation<ProjectRepositoryConnection>(
        "post",
        `/api/projects/${projectId}/github/repositories`,
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projectGithubRepo(projectId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      setShowConnectGithub(false);
      setSelectedInstallation(null);
      setSelectedRepo(null);
      setInstallationRepos([]);
      AppToast("GitHub repository connected", "success");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const disconnectGithub = useMutation({
    mutationFn: (repositoryId: number) =>
      apiMutation(
        "delete",
        `/api/projects/${projectId}/github/repositories/${repositoryId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projectGithubRepo(projectId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      AppToast("GitHub repository disconnected", "success");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const startGithub = useMutation({
    mutationFn: () =>
      apiMutation<{ url: string }>("post", "/api/github/installations/start", {
        projectId,
      }),
    onSuccess: (data) => window.location.assign(data.url),
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const changeMemberRole = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: Exclude<ProjectRole, "OWNER">;
    }) => apiMutation("patch", `/api/projects/${projectId}/members/${userId}`, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projectMembers(projectId),
      });
      AppToast("Member role updated", "success");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      apiMutation("delete", `/api/projects/${projectId}/members/${userId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projectMembers(projectId),
      });
      AppToast("Member removed", "success");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const revokeInvitation = useMutation({
    mutationFn: (invitationId: string) =>
      apiMutation(
        "post",
        `/api/projects/${projectId}/invitations/${invitationId}/revoke`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projectInvitations(projectId),
      });
      AppToast("Invitation revoked", "success");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const transfer = useMutation({
    mutationFn: (targetUserId: string) =>
      apiMutation("post", `/api/projects/${projectId}/ownership`, {
        targetUserId,
        confirm: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projectMembers(projectId),
      });
      AppToast("Ownership transferred.", "success");
      setTransferTarget("");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const [showConnectGithub, setShowConnectGithub] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<AvailableGitHubRepository | null>(
    null,
  );
  const [installationRepos, setInstallationRepos] = useState<AvailableGitHubRepository[]>(
    [],
  );
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repositoryLoadError, setRepositoryLoadError] = useState<string | null>(null);
  type ProjectDraft = {
    title: string;
    description: string;
    iconKey: ProjectIconKey;
    colorKey: ProjectColorKey;
    timeZone: string;
  };
  const [editDraftState, setEditDraftState] = useState<{
    key: string;
    value: ProjectDraft;
  } | null>(null);
  const [transferTarget, setTransferTarget] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [debouncedInviteSearch, setDebouncedInviteSearch] = useState("");
  const [inviteUserId, setInviteUserId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<Exclude<ProjectRole, "OWNER">>("MEMBER");
  const [confirmAction, setConfirmAction] = useState<{
    type: "archive" | "disconnect" | "remove" | "revoke" | "transfer";
    id?: string;
    label: string;
  } | null>(null);

  const projectDraftKey = project.data
    ? `${project.data.id}:${project.data.title}:${project.data.description ?? ""}:${project.data.iconKey}:${project.data.colorKey}:${project.data.timeZone}`
    : null;
  const editDraft = project.data
    ? editDraftState?.key === projectDraftKey
      ? editDraftState.value
      : {
          title: project.data.title,
          description: project.data.description ?? "",
          iconKey: project.data.iconKey,
          colorKey: project.data.colorKey,
          timeZone: project.data.timeZone,
        }
    : null;
  /**
   * Purpose: Merge edits into the current project-version draft.
   * Inputs: Partial editable project values.
   * Output: Void.
   * Side effects: Updates local form state without mutating query data.
   */
  const updateEditDraft = (values: Partial<ProjectDraft>) => {
    if (!projectDraftKey || !editDraft) return;
    setEditDraftState({ key: projectDraftKey, value: { ...editDraft, ...values } });
  };

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedInviteSearch(inviteSearch.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [inviteSearch]);

  useEffect(() => {
    if (
      searchParams.get("connectGithub") === "1" &&
      (project.data?.role === "OWNER" || project.data?.role === "ADMIN")
    ) {
      setShowConnectGithub(true);
    }
  }, [project.data?.role, searchParams]);

  const inviteSuggestions = useQuery({
    queryKey: ["user-suggestions", projectId, debouncedInviteSearch],
    queryFn: ({ signal }) =>
      apiGet<
        { id: string; displayName: string; handle: string; avatarUrl: string | null }[]
      >(
        `/api/users/suggest?q=${encodeURIComponent(debouncedInviteSearch)}&excludeProjectId=${projectId}`,
        signal,
      ),
    enabled: Boolean(
      (project.data?.role === "OWNER" || project.data?.role === "ADMIN") &&
      debouncedInviteSearch.length >= 2,
    ),
  });
  const inviteOptions = useMemo(
    () =>
      inviteSuggestions.data?.map((user) => ({
        value: user.id,
        label: `${user.displayName} (@${user.handle})`,
      })) ?? [],
    [inviteSuggestions.data],
  );
  const invite = useMutation({
    mutationFn: () =>
      apiMutation("post", `/api/projects/${projectId}/invitations`, {
        invitedUserId: inviteUserId,
        role: inviteRole,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.projectInvitations(projectId),
      });
      setInviteSearch("");
      setDebouncedInviteSearch("");
      setInviteUserId(null);
      AppToast("Invitation sent.", "success");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  /**
   * Purpose: Load repositories authorized for one selected GitHub App installation.
   * Inputs: Installation database ID.
   * Output: Promise resolved after picker state is updated.
   * Side effects: Performs a typed API read and updates dialog state.
   * Failure behavior: Preserves the selected installation and exposes a retry action.
   */
  const fetchInstallationRepositories = async (installationId: string) => {
    setLoadingRepos(true);
    setRepositoryLoadError(null);
    setInstallationRepos([]);
    try {
      const repos = await apiGet<AvailableGitHubRepository[]>(
        `/api/projects/${projectId}/github/repositories?installationId=${installationId}`,
      );
      setInstallationRepos(repos);
    } catch (error) {
      const normalized = normalizeApiClientError(error);
      setRepositoryLoadError(normalized.message);
      AppToast(normalized.message, "error");
    } finally {
      setLoadingRepos(false);
    }
  };

  if (project.isLoading) {
    return (
      <main className="p-5 md:p-8">
        <AppSkeleton className="h-64" />
      </main>
    );
  }

  if (!project.data) {
    return (
      <main className="p-5 md:p-8">
        <AppEmptyState
          title="Project unavailable"
          description="This project could not be loaded."
        />
      </main>
    );
  }

  const projectData = project.data;
  const isOwner = projectData.role === "OWNER";
  const isAdmin = projectData.role === "ADMIN" || isOwner;
  const canManageMembers = isAdmin;

  return (
    <main className="app-enter mx-auto grid w-full max-w-[100rem] gap-4 p-4 sm:p-6 md:p-8">
      <PageHeader
        title="Settings"
        description="Manage project details, members, GitHub, and archive options."
        action={
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
          >
            ← Back to project
          </Link>
        }
      />

      {projectData.archivedAt ? (
        <p className="rounded-lg border border-warning bg-warning-soft p-4 text-sm">
          Archived projects are read-only. Existing details remain visible below.
        </p>
      ) : null}

      <fieldset
        disabled={!online || Boolean(projectData.archivedAt)}
        className="grid w-full grid-cols-1 items-stretch gap-4 lg:grid-cols-12"
      >
        <div className="grid min-w-0 gap-4 lg:col-span-7 lg:grid-rows-[auto_auto_1fr]">
          {isAdmin ? (
            <SettingsSection title="Project details">
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <AppInput
                    label="Title"
                    maxLength={60}
                    value={editDraft?.title ?? ""}
                    onChange={(event) =>
                      updateEditDraft({ title: event.currentTarget.value })
                    }
                  />
                </div>
                <div className="lg:col-span-8">
                  <AppTextarea
                    label="Description"
                    maxLength={500}
                    value={editDraft?.description ?? ""}
                    onChange={(event) =>
                      updateEditDraft({ description: event.currentTarget.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="lg:col-span-6">
                  <ProjectIconPicker
                    value={editDraft?.iconKey ?? "Compass"}
                    onChange={(value) => updateEditDraft({ iconKey: value })}
                  />
                </div>
                <div className="lg:col-span-6">
                  <ProjectColorPicker
                    value={editDraft?.colorKey ?? "orange"}
                    onChange={(value) => updateEditDraft({ colorKey: value })}
                  />
                </div>
                <div className="lg:col-span-6">
                  <AppTimeZoneInput
                    value={editDraft?.timeZone ?? "UTC"}
                    onChange={(event) =>
                      updateEditDraft({ timeZone: event.currentTarget.value })
                    }
                  />
                </div>
                <AppButton
                  className="w-fit lg:col-span-6 lg:justify-self-end lg:self-end"
                  disabled={
                    updateProject.isPending || (editDraft?.title.trim().length ?? 0) < 2
                  }
                  onClick={() =>
                    editDraft &&
                    updateProject.mutate({
                      title: editDraft.title,
                      description: editDraft.description || null,
                      iconKey: editDraft.iconKey,
                      colorKey: editDraft.colorKey,
                      timeZone: editDraft.timeZone,
                    })
                  }
                >
                  <Save className="size-4" aria-hidden="true" /> Save project
                </AppButton>
              </div>
            </SettingsSection>
          ) : null}

          {/* GitHub Integration */}
          <SettingsSection title="GitHub integration">
            {!githubConfigured && isAdmin ? (
              <p
                role="status"
                className="mb-3 rounded-md border border-warning bg-warning-soft p-3 text-sm"
              >
                GitHub App is not configured for this deployment. Add the documented
                GitHub environment variables before connecting a repository.
              </p>
            ) : null}
            {githubInstallations.isError && isAdmin ? (
              <p
                role="alert"
                className="mb-3 rounded-md border border-warning bg-warning-soft p-3 text-sm"
              >
                {normalizeApiClientError(githubInstallations.error).code ===
                "INTEGRATION_NOT_CONFIGURED"
                  ? "GitHub App is not configured for this deployment. Add the documented GitHub environment variables before connecting a repository."
                  : "GitHub installations could not be loaded. Try again when the connection is available."}
              </p>
            ) : null}
            {githubRepo.isLoading ? (
              <AppSkeleton className="h-24" />
            ) : githubRepo.isError ? (
              <AppEmptyState
                title="Repository status unavailable"
                description="The GitHub connection status could not be loaded."
              />
            ) : githubRepo.data ? (
              <>
                <div className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <GitBranch className="size-5 text-brand" />
                    <div>
                      <span className="font-medium text-sm">
                        {githubRepo.data.repositoryFullName}
                      </span>
                      <span className="ml-2 rounded-sm bg-brand-soft px-2 py-0.5 font-mono text-xs text-brand">
                        Connected
                      </span>
                    </div>
                  </div>
                  {isAdmin ? (
                    <AppButton
                      variant="danger"
                      size="sm"
                      className="shrink-0"
                      disabled={disconnectGithub.isPending}
                      onClick={() =>
                        setConfirmAction({
                          type: "disconnect",
                          id: String(githubRepo.data!.repositoryId),
                          label: githubRepo.data!.repositoryFullName,
                        })
                      }
                    >
                      {disconnectGithub.isPending ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Disconnecting…
                        </>
                      ) : (
                        "Disconnect repository"
                      )}
                    </AppButton>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  <ExternalLink className="size-3 inline mr-1" />
                  <a
                    href={githubRepo.data.repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-brand hover:underline"
                  >
                    View on GitHub
                  </a>
                </p>
              </>
            ) : (
              <div className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <GitBranch className="size-5 text-text-tertiary" />
                  <div>
                    <span className="font-medium">No repository connected</span>
                    <span className="block text-sm text-text-secondary">
                      Link one authorized repository for project context and ownership.
                    </span>
                  </div>
                </div>
                <AppButton
                  className="shrink-0"
                  onClick={() => setShowConnectGithub(true)}
                  disabled={
                    !githubConfigured ||
                    githubInstallations.isLoading ||
                    githubInstallations.isError ||
                    !isAdmin
                  }
                >
                  Connect Repository
                </AppButton>
              </div>
            )}
          </SettingsSection>

          {/* Members */}
          {isAdmin && (
            <SettingsSection title="Members">
              {members.isLoading ? <AppSkeleton className="h-32" /> : null}
              {members.isError ? (
                <AppEmptyState
                  title="Members unavailable"
                  description="The active member list could not be loaded."
                />
              ) : null}
              {members.data?.length ? (
                <div className="grid gap-3">
                  {members.data.map((member) => {
                    const isCurrentUser = member.id === me.data?.id;
                    const canChangeRole =
                      canManageMembers &&
                      !isCurrentUser &&
                      member.role !== "OWNER" &&
                      (isOwner || member.role !== "ADMIN");
                    const canRemove =
                      canManageMembers && !isCurrentUser && member.role !== "OWNER";
                    return (
                      <div
                        key={member.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md border border-border bg-surface-muted"
                      >
                        <div className="flex items-center gap-3">
                          <AppAvatar name={member.displayName} src={member.avatarUrl} />
                          <div>
                            <span className="font-medium">{member.displayName}</span>
                            <span className="ml-2 rounded-sm bg-surface-muted px-2 py-0.5 font-mono text-xs text-text-secondary">
                              {member.handle}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {canChangeRole ? (
                            <AppSelect
                              label="Role"
                              value={member.role}
                              onValueChange={(value) =>
                                changeMemberRole.mutate({
                                  userId: member.id,
                                  role: value as Exclude<ProjectRole, "OWNER">,
                                })
                              }
                              options={nonOwnerRoles.map((role) => ({
                                value: role,
                                label: role,
                              }))}
                              disabled={changeMemberRole.isPending}
                            />
                          ) : (
                            <span className="rounded-sm bg-surface-muted px-2 py-1 font-mono text-xs text-text-secondary">
                              {member.role}
                            </span>
                          )}
                          {canRemove && (
                            <AppIconButton
                              label={`Remove ${member.displayName}`}
                              onClick={() =>
                                setConfirmAction({
                                  type: "remove",
                                  id: member.id,
                                  label: member.displayName,
                                })
                              }
                              disabled={removeMember.isPending}
                            >
                              <Trash2 className="size-4 text-error" />
                            </AppIconButton>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !members.isLoading && !members.isError ? (
                <AppEmptyState
                  title="No members"
                  description="Invite collaborators to this project."
                />
              ) : null}
            </SettingsSection>
          )}
        </div>

        <div className="grid min-w-0 gap-4 lg:col-span-5 lg:grid-rows-[auto_auto_1fr]">
          {isOwner && members.data?.length ? (
            <SettingsSection title="Ownership transfer">
              <p className="mb-3 text-sm text-text-secondary">
                Transfer ownership to an active member. You will remain an administrator.
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <AppSelect
                  label="New owner"
                  value={transferTarget}
                  onValueChange={setTransferTarget}
                  options={members.data
                    .filter(
                      (member) => member.id !== me.data?.id && member.role !== "OWNER",
                    )
                    .map((member) => ({
                      value: member.id,
                      label: `${member.displayName} (@${member.handle})`,
                    }))}
                  placeholder="Select a member"
                />
                <AppButton
                  variant="danger"
                  disabled={!transferTarget || transfer.isPending}
                  onClick={() =>
                    setConfirmAction({
                      type: "transfer",
                      id: transferTarget,
                      label:
                        members.data?.find((member) => member.id === transferTarget)
                          ?.displayName ?? "selected member",
                    })
                  }
                >
                  Transfer ownership
                </AppButton>
              </div>
            </SettingsSection>
          ) : null}

          {/* Invitations */}
          {isAdmin && (
            <SettingsSection title="Pending invitations">
              <div className="mb-4 grid gap-3 rounded-md border border-border bg-surface-muted p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                <AppCombobox
                  label="Invite collaborator"
                  value={inviteSearch}
                  onChange={(value) => {
                    setInviteSearch(value);
                    setInviteUserId(null);
                  }}
                  onOptionSelect={(option) => {
                    setInviteSearch(option.label);
                    setInviteUserId(option.value);
                  }}
                  options={inviteOptions}
                  placeholder="Search by name or handle"
                  disabled={!online || invite.isPending}
                />
                {inviteSuggestions.isError ? (
                  <p role="alert" className="text-sm text-error sm:col-span-3">
                    Collaborator suggestions could not be loaded.
                  </p>
                ) : null}
                <AppSelect
                  label="Role"
                  value={inviteRole}
                  onValueChange={(value) =>
                    setInviteRole(value as Exclude<ProjectRole, "OWNER">)
                  }
                  options={nonOwnerRoles.map((role) => ({ value: role, label: role }))}
                  disabled={!online || invite.isPending}
                />
                <AppButton
                  disabled={!online || !inviteUserId || invite.isPending}
                  onClick={() => invite.mutate()}
                >
                  {invite.isPending ? "Sending…" : "Invite"}
                </AppButton>
              </div>
              {invitations.isLoading ? <AppSkeleton className="h-28" /> : null}
              {invitations.isError ? (
                <AppEmptyState
                  title="Invitations unavailable"
                  description="Pending invitations could not be loaded."
                />
              ) : null}
              {invitations.data?.length ? (
                <div className="grid gap-3">
                  {invitations.data.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md border border-border bg-surface-muted"
                    >
                      <div className="flex items-center gap-3">
                        <AppAvatar
                          name={invitation.displayName}
                          src={invitation.avatarUrl}
                        />
                        <div>
                          <span className="font-medium">{invitation.displayName}</span>
                          <span className="ml-2 rounded-sm bg-surface-muted px-2 py-0.5 font-mono text-xs text-text-secondary">
                            {invitation.handle}
                          </span>
                          <span className="ml-2 rounded-sm bg-warning-soft px-2 py-0.5 font-mono text-xs text-warning">
                            {invitation.role}
                          </span>
                        </div>
                      </div>
                      <AppButton
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({
                            type: "revoke",
                            id: invitation.id,
                            label: invitation.displayName,
                          })
                        }
                        disabled={revokeInvitation.isPending}
                      >
                        Revoke
                      </AppButton>
                    </div>
                  ))}
                </div>
              ) : !invitations.isLoading && !invitations.isError ? (
                <AppEmptyState
                  title="No pending invitations"
                  description="Invited users will appear here."
                />
              ) : null}
            </SettingsSection>
          )}

          {isOwner ? (
            <SettingsSection title="Danger zone">
              {projectData.archivedAt ? (
                <AppEmptyState
                  title="Project archived"
                  description="This project is hidden from active lists while its tasks and history remain preserved."
                />
              ) : (
                <DangerZoneItem
                  label="Archive project"
                  description="Hide this project from active lists while preserving its tasks and history."
                  action={
                    <AppButton
                      variant="danger"
                      disabled={archiveProject.isPending}
                      onClick={() =>
                        setConfirmAction({ type: "archive", label: projectData.title })
                      }
                    >
                      {archiveProject.isPending ? "Archiving…" : "Archive project"}
                    </AppButton>
                  }
                />
              )}
            </SettingsSection>
          ) : null}
        </div>
      </fieldset>

      {/* Connect GitHub Dialog */}
      <AppDialog
        open={showConnectGithub}
        onOpenChange={(open) => {
          setShowConnectGithub(open);
          if (!open) {
            setSelectedInstallation(null);
            setSelectedRepo(null);
            setInstallationRepos([]);
            setRepositoryLoadError(null);
          }
        }}
        title="Connect GitHub Repository"
        description="Select a GitHub App installation and repository to link to this project."
      >
        <div className="grid gap-4">
          {!githubConfigured ? (
            <AppEmptyState
              title="GitHub connection unavailable"
              description="GitHub App is not configured for this deployment. Follow the GitHub setup guide before connecting a repository."
            />
          ) : !selectedInstallation ? (
            <>
              <p className="text-sm text-text-secondary">
                Choose a GitHub App installation that has access to the repository you
                want to connect.
              </p>
              {githubInstallations.isError ? (
                <AppEmptyState
                  title="GitHub connection unavailable"
                  description={
                    normalizeApiClientError(githubInstallations.error).code ===
                    "INTEGRATION_NOT_CONFIGURED"
                      ? "GitHub App is not configured for this deployment. Follow the GitHub setup guide before connecting a repository."
                      : "Installations could not be loaded. Close this dialog and try again."
                  }
                />
              ) : githubInstallations.isLoading ? (
                <AppSkeleton className="h-32" />
              ) : githubInstallations.data?.length ? (
                <div className="grid gap-2">
                  {githubInstallations.data.map((installation) => (
                    <AppButton
                      key={installation.id}
                      variant="secondary"
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedInstallation(installation.id);
                        fetchInstallationRepositories(installation.id);
                      }}
                    >
                      <GitBranch className="size-4 mr-2" />
                      {installation.githubAccountLogin} ({installation.githubAccountType})
                    </AppButton>
                  ))}
                </div>
              ) : (
                <AppEmptyState
                  title="No GitHub installations"
                  description="Authorize GitHub, then install the Rudo Quest GitHub App on your account or organization."
                  action={
                    <AppButton
                      onClick={() => startGithub.mutate()}
                      disabled={!online || !githubConfigured || startGithub.isPending}
                    >
                      {startGithub.isPending ? "Opening GitHub…" : "Install GitHub App"}
                    </AppButton>
                  }
                />
              )}
            </>
          ) : !selectedRepo ? (
            <>
              <div className="flex items-center gap-2">
                <AppButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedInstallation(null);
                    setInstallationRepos([]);
                    setRepositoryLoadError(null);
                  }}
                >
                  <ChevronLeft className="size-4 mr-1" /> Back
                </AppButton>
                <p className="text-sm text-text-secondary">
                  Select a repository from the chosen installation.
                </p>
              </div>
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {loadingRepos ? (
                  <AppSkeleton className="h-32" />
                ) : repositoryLoadError ? (
                  <AppEmptyState
                    title="Repositories unavailable"
                    description={repositoryLoadError}
                    action={
                      <AppButton
                        variant="secondary"
                        onClick={() =>
                          void fetchInstallationRepositories(selectedInstallation)
                        }
                      >
                        Try again
                      </AppButton>
                    }
                  />
                ) : installationRepos.length ? (
                  installationRepos.map((repo) => (
                    <AppButton
                      key={repo.id}
                      variant="secondary"
                      className="w-full justify-start"
                      onClick={() => setSelectedRepo(repo)}
                    >
                      <GitBranch className="size-4 mr-2" />
                      {repo.fullName}
                    </AppButton>
                  ))
                ) : (
                  <AppEmptyState
                    title="No repositories found"
                    description="This installation doesn't have any accessible repositories."
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <AppButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedRepo(null)}
                >
                  <ChevronLeft className="size-4 mr-1" /> Back
                </AppButton>
                <p className="text-sm text-text-secondary">
                  Selected: <strong>{selectedRepo.fullName}</strong>
                </p>
              </div>
              <AppButton
                onClick={() =>
                  connectGithub.mutate({
                    githubInstallationId: selectedInstallation!,
                    repositoryId: selectedRepo.id,
                  })
                }
                disabled={connectGithub.isPending}
              >
                {connectGithub.isPending ? "Connecting..." : "Connect Repository"}
              </AppButton>
            </>
          )}
        </div>
      </AppDialog>
      <AppConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={
          confirmAction?.type === "transfer"
            ? "Transfer ownership?"
            : "Confirm project change"
        }
        description={
          confirmAction?.type === "archive"
            ? `Archive ${confirmAction.label}? Its tasks and history will be preserved.`
            : confirmAction?.type === "transfer"
              ? `Transfer ownership to ${confirmAction.label}? This cannot be undone from this dialog.`
              : `Confirm this action for ${confirmAction?.label ?? "the selected item"}.`
        }
        confirmLabel={
          confirmAction?.type === "archive"
            ? "Archive project"
            : confirmAction?.type === "transfer"
              ? "Transfer ownership"
              : "Confirm"
        }
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.type === "archive") archiveProject.mutate();
          if (confirmAction.type === "disconnect" && confirmAction.id)
            disconnectGithub.mutate(Number(confirmAction.id));
          if (confirmAction.type === "remove" && confirmAction.id)
            removeMember.mutate(confirmAction.id);
          if (confirmAction.type === "revoke" && confirmAction.id)
            revokeInvitation.mutate(confirmAction.id);
          if (confirmAction.type === "transfer" && confirmAction.id)
            transfer.mutate(confirmAction.id);
          setConfirmAction(null);
        }}
      />
    </main>
  );
}
