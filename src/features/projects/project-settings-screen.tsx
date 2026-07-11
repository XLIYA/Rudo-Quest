"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GitBranch,
  Trash2,
  Settings,
  ExternalLink,
  Loader2,
  ChevronLeft,
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
import type { ProjectRole, ProjectSummary } from "@/types/domain";

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

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
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

function SettingsRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-md border border-border bg-surface-muted">
      <div className="flex flex-col gap-1">
        <span className="font-medium">{label}</span>
        {description && <span className="text-sm text-text-secondary">{description}</span>}
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

  const project = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) => apiGet<ProjectSummary>(`/api/projects/${projectId}`, signal),
  });

  const members = useQuery({
    queryKey: queryKeys.projectMembers(projectId),
    queryFn: ({ signal }) => apiGet<{ id: string; handle: string; displayName: string; avatarUrl: string | null; role: ProjectRole }[]>(`/api/projects/${projectId}/members`, signal),
    enabled: !!projectId,
  });

  const invitations = useQuery({
    queryKey: queryKeys.projectInvitations(projectId),
    queryFn: ({ signal }) => apiGet<{ id: string; invitedUserId: string; handle: string; displayName: string; avatarUrl: string | null; role: ProjectRole; status: string; expiresAt: string }[]>(`/api/projects/${projectId}/invitations`, signal),
    enabled: !!projectId,
  });

  const githubRepo = useQuery({
    queryKey: queryKeys.projectGithubRepo(projectId),
    queryFn: ({ signal }) =>
      apiGet<GitHubRepository | null>(`/api/projects/${projectId}/github/repositories`, signal),
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
      toast.success("Project archived");
      router.push("/projects");
    },
    onError: (error) => toast.error(normalizeApiClientError(error).message),
  });

  const connectGithub = useMutation({
    mutationFn: (body: { githubInstallationId: string; repositoryId: number }) =>
      apiMutation<GitHubRepository>("post", `/api/projects/${projectId}/github/repositories`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectGithubRepo(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      toast.success("GitHub repository connected");
    },
    onError: (error) => toast.error(normalizeApiClientError(error).message),
  });

  const disconnectGithub = useMutation({
    mutationFn: (repositoryId: number) => apiMutation("delete", `/api/projects/${projectId}/github/repositories/${repositoryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectGithubRepo(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      toast.success("GitHub repository disconnected");
    },
    onError: (error) => toast.error(normalizeApiClientError(error).message),
  });

  const changeMemberRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Exclude<ProjectRole, "OWNER"> }) =>
      apiMutation("patch", `/api/projects/${projectId}/members/${userId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(projectId) });
      toast.success("Member role updated");
    },
    onError: (error) => toast.error(normalizeApiClientError(error).message),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => apiMutation("delete", `/api/projects/${projectId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(projectId) });
      toast.success("Member removed");
    },
    onError: (error) => toast.error(normalizeApiClientError(error).message),
  });

  const revokeInvitation = useMutation({
    mutationFn: (invitationId: string) => apiMutation("post", `/api/projects/${projectId}/invitations/${invitationId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectInvitations(projectId) });
      toast.success("Invitation revoked");
    },
    onError: (error) => toast.error(normalizeApiClientError(error).message),
  });

  const [showConnectGithub, setShowConnectGithub] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [installationRepos, setInstallationRepos] = useState<GitHubRepository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const fetchInstallationRepositories = async (installationId: string) => {
    setLoadingRepos(true);
    try {
      const repos = await apiGet<GitHubRepository[]>(
        `/api/projects/${projectId}/github/repositories?installationId=${installationId}`,
      );
      setInstallationRepos(repos);
    } catch {
      toast.error("Failed to load repositories");
    } finally {
      setLoadingRepos(false);
    }
  };

  if (project.isLoading) {
    return <main className="p-5 md:p-8"><AppSkeleton className="h-64" /></main>;
  }

  if (!project.data) {
    return (
      <main className="p-5 md:p-8">
        <AppEmptyState title="Project unavailable" description="This project could not be loaded." />
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
          <Link href={`/projects/${projectId}`} className="text-sm font-medium text-brand hover:underline">
            ← Back to project
          </Link>
        }
      />

      <div className="grid gap-5">
        {/* General Settings */}
        <SettingsSection title="General">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsRow label="Project ID" description="Unique identifier for this project">
              <code className="font-mono text-sm text-text-secondary bg-surface-muted px-2 py-1 rounded">{projectData.id}</code>
            </SettingsRow>
            <SettingsRow label="Role" description="Your role in this project">
              <span className="rounded-sm bg-surface-muted px-2 py-1 font-mono text-xs text-text-secondary">{projectData.role}</span>
            </SettingsRow>
            <SettingsRow label="Created" description="When this project was created">
              <span className="font-mono text-sm text-text-secondary">{new Date(projectData.createdAt).toLocaleDateString()}</span>
            </SettingsRow>
            <SettingsRow label="Status" description="Current project state">
              <span className={`${projectData.archivedAt ? "text-error" : "text-success"} font-mono text-sm`}>
                {projectData.archivedAt ? "Archived" : "Active"}
              </span>
            </SettingsRow>
          </div>
        </SettingsSection>

{/* GitHub Integration */}
        <SettingsSection title="GitHub Integration">
          {githubRepo.data ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-md border border-border bg-surface-muted">
                <div className="flex items-center gap-3">
                  <GitBranch className="size-5 text-brand" />
                  <div>
                    <span className="font-medium text-sm">{githubRepo.data.repositoryFullName}</span>
                    <span className="ml-2 rounded-sm bg-brand-soft px-2 py-0.5 font-mono text-xs text-brand">Connected</span>
                  </div>
                </div>
                <AppButton
                  variant="danger"
                  size="sm"
                  disabled={disconnectGithub.isPending}
                  onClick={() => disconnectGithub.mutate(githubRepo.data!.repositoryId)}
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
                <a href={githubRepo.data.repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
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
                  <span className="block text-sm text-text-secondary">Link a GitHub repository to track issues and PRs</span>
                </div>
              </div>
              <AppButton onClick={() => setShowConnectGithub(true)} disabled={githubInstallations.isLoading}>
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
                  const isCurrentUser = member.id === projectData.members[0]?.id;
                  const canChangeRole = canManageMembers && !isCurrentUser && member.role !== "OWNER";
                  const canRemove = canManageMembers && !isCurrentUser && member.role !== "OWNER";
                  return (
                    <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md border border-border bg-surface-muted">
                      <div className="flex items-center gap-3">
                        <AppAvatar name={member.displayName} src={member.avatarUrl} />
                        <div>
                          <span className="font-medium">{member.displayName}</span>
                          <span className="ml-2 rounded-sm bg-surface-muted px-2 py-0.5 font-mono text-xs text-text-secondary">{member.handle}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
{canChangeRole ? (
                              <AppSelect
                                label="Role"
                                value={member.role}
                                onValueChange={(value) => changeMemberRole.mutate({ userId: member.id, role: value as Exclude<ProjectRole, "OWNER"> })}
                                options={nonOwnerRoles.map((role) => ({ value: role, label: role }))}
                              />
                            ) : (
                              <span className="rounded-sm bg-surface-muted px-2 py-1 font-mono text-xs text-text-secondary">{member.role}</span>
                            )}
                        {canRemove && (
                          <AppIconButton
                            label={`Remove ${member.displayName}`}
                            onClick={() => removeMember.mutate(member.id)}
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
              <AppEmptyState title="No members" description="Invite collaborators to this project." />
            )}
          </SettingsSection>
        )}

        {/* Invitations */}
        {isAdmin && (
          <SettingsSection title="Pending Invitations">
            {invitations.data?.length ? (
              <div className="grid gap-3">
                {invitations.data.map((invitation) => (
                  <div key={invitation.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md border border-border bg-surface-muted">
                    <div className="flex items-center gap-3">
                      <AppAvatar name={invitation.displayName} src={invitation.avatarUrl} />
                      <div>
                        <span className="font-medium">{invitation.displayName}</span>
                        <span className="ml-2 rounded-sm bg-surface-muted px-2 py-0.5 font-mono text-xs text-text-secondary">{invitation.handle}</span>
                        <span className="ml-2 rounded-sm bg-warning-soft px-2 py-0.5 font-mono text-xs text-warning">{invitation.role}</span>
                      </div>
                    </div>
                    <AppButton variant="danger" size="sm" onClick={() => revokeInvitation.mutate(invitation.id)} disabled={revokeInvitation.isPending}>
                      Revoke
                    </AppButton>
                  </div>
                ))}
              </div>
            ) : (
              <AppEmptyState title="No pending invitations" description="Invited users will appear here." />
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
                  onClick={() => {
                    if (confirm("Are you sure you want to archive this project? This action can only be undone by the project owner.")) {
                      archiveProject.mutate();
                    }
                  }}
                >
                  {archiveProject.isPending ? "Archiving..." : "Archive Project"}
                </AppButton>
              }
            />
          )}
        </SettingsSection>
      </div>

      {/* Connect GitHub Dialog */}
      <AppDialog open={showConnectGithub} onOpenChange={setShowConnectGithub} title="Connect GitHub Repository" description="Select a GitHub App installation and repository to link to this project.">
        <div className="grid gap-4">
          {!selectedInstallation ? (
            <>
              <p className="text-sm text-text-secondary">Choose a GitHub App installation that has access to the repository you want to connect.</p>
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
                <AppEmptyState title="No GitHub installations" description="Install the Rudo Quest GitHub App on your account or organization first." action={<Link href="https://github.com/apps/rudo-quest/installations/new" target="_blank" rel="noopener noreferrer"><AppButton>Install GitHub App</AppButton></Link>} />
              )}
            </>
          ) : !selectedRepo ? (
            <>
              <div className="flex items-center gap-2">
                <AppButton variant="secondary" size="sm" onClick={() => { setSelectedInstallation(null); setInstallationRepos([]); }}>
                  <ChevronLeft className="size-4 mr-1" /> Back
                </AppButton>
                <p className="text-sm text-text-secondary">Select a repository from the chosen installation.</p>
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
                  <AppEmptyState title="No repositories found" description="This installation doesn't have any accessible repositories." />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <AppButton variant="secondary" size="sm" onClick={() => setSelectedRepo(null)}>
                  <ChevronLeft className="size-4 mr-1" /> Back
                </AppButton>
                <p className="text-sm text-text-secondary">Selected: <strong>{selectedRepo.repositoryFullName}</strong></p>
              </div>
              <AppButton onClick={() => connectGithub.mutate({ githubInstallationId: selectedInstallation!, repositoryId: selectedRepo.repositoryId })} disabled={connectGithub.isPending}>
                {connectGithub.isPending ? "Connecting..." : "Connect Repository"}
              </AppButton>
            </>
          )}
        </div>
      </AppDialog>
    </main>
  );
}