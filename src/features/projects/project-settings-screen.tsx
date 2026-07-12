"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppToast } from "@/components/ui/app-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GitBranch,
  Trash2,
  Settings,
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

type GitHubInstallation = {
  id: string;
  githubInstallationId: number;
  githubAccountLogin: string;
  githubAccountType: string;
};

type GitHubRepository = {
  id: string;
  githubInstallationId: string;
  repositoryId: number;
  repositoryFullName: string;
  repositoryUrl: string;
  defaultBranch: string | null;
};

const nonOwnerRoles: Exclude<ProjectRole, "OWNER">[] = ["ADMIN", "MEMBER", "VIEWER"];

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="mb-4 text-lg font-semibold uppercase text-text-secondary flex items-center gap-2">
        <Settings className="size-4" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-md border border-border bg-surface-muted">
      <div className="flex flex-col gap-1">
        <span className="font-medium">{label}</span>
        {description && (
          <span className="text-sm text-text-secondary">{description}</span>
        )}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-md border border-border bg-surface-muted">
      <div className="flex flex-col gap-1">
        <span className="font-medium text-error">{label}</span>
        <span className="text-sm text-text-secondary">{description}</span>
      </div>
      <div className="w-full sm:w-auto">{action}</div>
    </div>
  );
}

export function ProjectSettingsScreen() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
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
    enabled: !!projectId,
  });

  const githubRepo = useQuery({
    queryKey: queryKeys.projectGithubRepo(projectId),
    queryFn: ({ signal }) =>
      apiGet<GitHubRepository | null>(
        `/api/projects/${projectId}/github/repositories`,
        signal,
      ),
    enabled: !!projectId,
  });

  const githubInstallations = useQuery({
    queryKey: ["github-installations"],
    queryFn: ({ signal }) =>
      apiGet<GitHubInstallation[]>(`/api/github/installations`, signal),
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
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.project(projectId), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      AppToast("Project details updated.", "success");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const connectGithub = useMutation({
    mutationFn: (body: { githubInstallationId: string; repositoryId: number }) =>
      apiMutation<GitHubRepository>(
        "post",
        `/api/projects/${projectId}/github/repositories`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectGithubRepo(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.projectGithubRepo(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(projectId) });
      AppToast("Member role updated", "success");
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      apiMutation("delete", `/api/projects/${projectId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(projectId) });
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
      queryClient.invalidateQueries({
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
    },
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });

  const [showConnectGithub, setShowConnectGithub] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [installationRepos, setInstallationRepos] = useState<GitHubRepository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
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

  const fetchInstallationRepositories = async (installationId: string) => {
    setLoadingRepos(true);
    try {
      const repos = await apiGet<GitHubRepository[]>(
        `/api/projects/${projectId}/github/repositories?installationId=${installationId}`,
      );
      setInstallationRepos(repos);
    } catch {
      AppToast("Failed to load repositories", "error");
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
    <main className="mx-auto grid max-w-4xl gap-5 p-5 md:p-8">
      <PageHeader
        title="Settings"
        description="Manage project details, members, GitHub, and archive options."
        action={
          <Link
            href={`/projects/${projectId}`}
            className="text-sm font-medium text-brand hover:underline"
          >
            ← Back to project
          </Link>
        }
      />

      <fieldset disabled={!online} className="grid gap-5">
        {/* General Settings */}
        <SettingsSection title="General">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsRow
              label="Project ID"
              description="Unique identifier for this project"
            >
              <code className="font-mono text-sm text-text-secondary bg-surface-muted px-2 py-1 rounded">
                {projectData.id}
              </code>
            </SettingsRow>
            <SettingsRow label="Role" description="Your role in this project">
              <span className="rounded-sm bg-surface-muted px-2 py-1 font-mono text-xs text-text-secondary">
                {projectData.role}
              </span>
            </SettingsRow>
            <SettingsRow label="Created" description="When this project was created">
              <span className="font-mono text-sm text-text-secondary">
                {new Date(projectData.createdAt).toLocaleDateString()}
              </span>
            </SettingsRow>
            <SettingsRow label="Status" description="Current project state">
              <span
                className={`${projectData.archivedAt ? "text-error" : "text-success"} font-mono text-sm`}
              >
                {projectData.archivedAt ? "Archived" : "Active"}
              </span>
            </SettingsRow>
          </div>
        </SettingsSection>

        {isAdmin ? (
          <SettingsSection title="Edit project">
            <div className="grid gap-4">
              <AppInput
                label="Title"
                value={editDraft?.title ?? ""}
                onChange={(event) =>
                  updateEditDraft({ title: event.currentTarget.value })
                }
              />
              <AppTextarea
                label="Description"
                value={editDraft?.description ?? ""}
                onChange={(event) =>
                  updateEditDraft({ description: event.currentTarget.value })
                }
                rows={4}
              />
              <ProjectIconPicker
                value={editDraft?.iconKey ?? "Compass"}
                onChange={(value) => updateEditDraft({ iconKey: value })}
              />
              <ProjectColorPicker
                value={editDraft?.colorKey ?? "orange"}
                onChange={(value) => updateEditDraft({ colorKey: value })}
              />
              <AppInput
                label="Timezone"
                value={editDraft?.timeZone ?? "UTC"}
                onChange={(event) =>
                  updateEditDraft({ timeZone: event.currentTarget.value })
                }
              />
              <AppButton
                className="w-fit"
                disabled={updateProject.isPending}
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
        <SettingsSection title="GitHub Integration">
          {githubRepo.data ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-md border border-border bg-surface-muted">
                <div className="flex items-center gap-3">
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
                <AppButton
                  variant="danger"
                  size="sm"
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
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Disconnecting...
                    </>
                  ) : (
                    "Disconnect Repository"
                  )}
                </AppButton>
              </div>
              <p className="mt-2 text-sm text-text-secondary">
                <ExternalLink className="size-3 inline mr-1" />
                <a
                  href={githubRepo.data.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  View on GitHub
                </a>
              </p>
            </>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-md border border-border bg-surface-muted">
              <div className="flex items-center gap-3">
                <GitBranch className="size-5 text-text-tertiary" />
                <div>
                  <span className="font-medium">No repository connected</span>
                  <span className="block text-sm text-text-secondary">
                    Link a GitHub repository to track issues and PRs
                  </span>
                </div>
              </div>
              <AppButton
                onClick={() => setShowConnectGithub(true)}
                disabled={githubInstallations.isLoading || !isAdmin}
              >
                Connect Repository
              </AppButton>
            </div>
          )}
        </SettingsSection>

        {/* Members */}
        {isAdmin && (
          <SettingsSection title="Members">
            {members.data?.length ? (
              <div className="grid gap-3">
                {members.data.map((member) => {
                  const isCurrentUser = member.id === me.data?.id;
                  const canChangeRole =
                    canManageMembers && !isCurrentUser && member.role !== "OWNER";
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
            ) : (
              <AppEmptyState
                title="No members"
                description="Invite collaborators to this project."
              />
            )}
          </SettingsSection>
        )}

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
          <SettingsSection title="Pending Invitations">
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
            ) : (
              <AppEmptyState
                title="No pending invitations"
                description="Invited users will appear here."
              />
            )}
          </SettingsSection>
        )}

        {/* Danger Zone */}
        <SettingsSection title="Danger Zone">
          {projectData.archivedAt ? (
            <AppEmptyState
              title="Project archived"
              description="This project has been archived. Archived projects are hidden from lists but their data is preserved."
            />
          ) : (
            <DangerZoneItem
              label="Archive project"
              description="Archive this project to hide it from lists. All tasks and data will be preserved. Only the project owner can archive."
              action={
                <AppButton
                  variant="danger"
                  disabled={archiveProject.isPending}
                  onClick={() =>
                    setConfirmAction({ type: "archive", label: projectData.title })
                  }
                >
                  {archiveProject.isPending ? "Archiving..." : "Archive Project"}
                </AppButton>
              }
            />
          )}
        </SettingsSection>
      </fieldset>

      {/* Connect GitHub Dialog */}
      <AppDialog
        open={showConnectGithub}
        onOpenChange={setShowConnectGithub}
        title="Connect GitHub Repository"
        description="Select a GitHub App installation and repository to link to this project."
      >
        <div className="grid gap-4">
          {!selectedInstallation ? (
            <>
              <p className="text-sm text-text-secondary">
                Choose a GitHub App installation that has access to the repository you
                want to connect.
              </p>
              {githubInstallations.isLoading ? (
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
                      disabled={!online || startGithub.isPending}
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
                ) : installationRepos.length ? (
                  installationRepos.map((repo) => (
                    <AppButton
                      key={repo.id}
                      variant="secondary"
                      className="w-full justify-start"
                      onClick={() => setSelectedRepo(repo)}
                    >
                      <GitBranch className="size-4 mr-2" />
                      {repo.repositoryFullName}
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
                  Selected: <strong>{selectedRepo.repositoryFullName}</strong>
                </p>
              </div>
              <AppButton
                onClick={() =>
                  connectGithub.mutate({
                    githubInstallationId: selectedInstallation!,
                    repositoryId: selectedRepo.repositoryId,
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
