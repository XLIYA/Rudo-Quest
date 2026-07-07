"use client";

import Link from "next/link";
import type { Route } from "next";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppAvatar } from "@/components/ui/app-avatar";
import { AppAvatarStack } from "@/components/ui/app-avatar-stack";
import { AppButton } from "@/components/ui/app-button";
import { AppDialog } from "@/components/ui/app-dialog";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppIconButton } from "@/components/ui/app-icon-button";
import { AppInput } from "@/components/ui/app-input";
import { AppSelect } from "@/components/ui/app-select";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import {
  projectRoles,
  type ProfileSummary,
  type ProjectColorKey,
  type ProjectIconKey,
  type ProjectRole,
  type ProjectSummary,
} from "@/types/domain";
import { getProjectColor } from "@/lib/theme/project-colors";
import {
  ProjectColorPicker,
  ProjectIconGlyph,
  ProjectIconPicker,
} from "./project-pickers";
import { useCreateProject, useProjects } from "./project-hooks";

const invitationRoles = projectRoles.filter(
  (role): role is Exclude<ProjectRole, "OWNER"> => role !== "OWNER",
);

type PendingInvitation = {
  user: ProfileSummary;
  role: Exclude<ProjectRole, "OWNER">;
};

/**
 * Purpose: Render project list, filters, cards, and create-project dialog.
 * Inputs: None.
 * Output: Project management screen.
 * Side effects: Fetches and creates projects through API hooks.
 */
export function ProjectsScreen() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [archived, setArchived] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (role !== "all") params.set("role", role);
  params.set("archived", archived);
  const query = useProjects(`?${params.toString()}`);

  return (
    <main className="mx-auto grid max-w-7xl gap-5 p-5 md:p-8">
      <PageHeader
        title="Projects"
        description="Small shared spaces for assignment, progress, members, and one GitHub repository."
        action={<AppButton onClick={() => setCreateOpen(true)}>Create project</AppButton>}
      />
      <section className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-[1fr_12rem_12rem]">
        <AppInput
          label="Search"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <AppSelect
          label="Role"
          value={role}
          onValueChange={setRole}
          options={[
            { value: "all", label: "All roles" },
            ...projectRoles.map((item) => ({ value: item, label: item })),
          ]}
        />
        <AppSelect
          label="Archive"
          value={archived}
          onValueChange={setArchived}
          options={[
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
            { value: "all", label: "All" },
          ]}
        />
      </section>
      {query.isLoading ? <ProjectGridSkeleton /> : null}
      {query.data?.length ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </section>
      ) : null}
      {query.data && !query.data.length ? (
        <AppEmptyState
          title="No projects"
          description="Create a project when a task needs a shared owner, member list, or GitHub repository."
          action={
            <AppButton onClick={() => setCreateOpen(true)}>Create project</AppButton>
          }
        />
      ) : null}
      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}

/**
 * Purpose: Render one project card.
 * Inputs: Project summary.
 * Output: Accessible link card.
 * Side effects: None.
 */
function ProjectCard({ project }: { project: ProjectSummary }) {
  const color = getProjectColor(project.colorKey);
  return (
    <Link
      href={`/projects/${project.id}` as Route}
      className="rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-surface)] transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex size-11 items-center justify-center rounded-md"
          style={{ background: color.soft, color: color.text }}
        >
          <ProjectIconGlyph iconKey={project.iconKey} className="size-5" />
        </span>
        <span className="rounded-sm bg-surface-muted px-2 py-1 font-mono text-xs text-text-secondary">
          {project.role}
        </span>
      </div>
      <h2 className="mt-4 text-lg font-semibold">{project.title}</h2>
      <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-text-secondary">
        {project.description ?? "No description."}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <AppAvatarStack users={project.members} />
        <span className="font-mono text-xs text-text-secondary">
          {project.openTaskCount} open
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-secondary">
        <span>{project.weeklyCompletionPercent}% this week</span>
        <span>
          {project.githubRepositoryFullName ? "GitHub connected" : "No repository"}
        </span>
      </div>
    </Link>
  );
}

/**
 * Purpose: Render create project dialog with details, collaborator invitations, and GitHub note.
 * Inputs: Controlled open state.
 * Output: Dialog form.
 * Side effects: Calls project creation mutation.
 */
function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createProject = useCreateProject();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [iconKey, setIconKey] = useState<ProjectIconKey>("Compass");
  const [colorKey, setColorKey] = useState<ProjectColorKey>("orange");
  const [memberSearch, setMemberSearch] = useState("");
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<ProjectRole, "OWNER">>("MEMBER");
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [step, setStep] = useState(1);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<{ id: string }>("/api/me", signal),
    enabled: open,
  });
  const selectedUserIds = useMemo(
    () => new Set(pendingInvitations.map((invitation) => invitation.user.id)),
    [pendingInvitations],
  );
  const suggestions = useQuery({
    queryKey: ["user-suggestions", debouncedMemberSearch],
    queryFn: ({ signal }) =>
      apiGet<ProfileSummary[]>(
        `/api/users/suggest?q=${encodeURIComponent(debouncedMemberSearch)}`,
        signal,
      ),
    enabled: open && debouncedMemberSearch.length >= 2,
  });
  const visibleSuggestions = useMemo(
    () =>
      (suggestions.data ?? []).filter(
        (user) => user.id !== me.data?.id && !selectedUserIds.has(user.id),
      ),
    [me.data?.id, selectedUserIds, suggestions.data],
  );

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedMemberSearch(memberSearch.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [memberSearch]);

  const submit = async () => {
    try {
      await createProject.mutateAsync({
        title,
        description: description || null,
        iconKey,
        colorKey,
        timeZone,
        invitations: pendingInvitations.map((invitation) => ({
          userId: invitation.user.id,
          role: invitation.role,
        })),
      });
    } catch {
      return;
    }
    setTitle("");
    setDescription("");
    setMemberSearch("");
    setDebouncedMemberSearch("");
    setPendingInvitations([]);
    setInviteRole("MEMBER");
    setStep(1);
    onOpenChange(false);
  };

  const addInvitation = (user: ProfileSummary) => {
    if (selectedUserIds.has(user.id) || user.id === me.data?.id) return;
    setPendingInvitations((current) => [...current, { user, role: inviteRole }]);
    setMemberSearch("");
    setDebouncedMemberSearch("");
  };

  const updateInvitationRole = (userId: string, role: Exclude<ProjectRole, "OWNER">) => {
    setPendingInvitations((current) =>
      current.map((invitation) =>
        invitation.user.id === userId ? { ...invitation, role } : invitation,
      ),
    );
  };

  const removeInvitation = (userId: string) => {
    setPendingInvitations((current) =>
      current.filter((invitation) => invitation.user.id !== userId),
    );
  };

  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title="Create project">
      <div className="grid gap-4">
        <div className="flex gap-2 text-xs font-semibold text-text-secondary">
          <span className={step === 1 ? "text-brand" : ""}>Details</span>
          <span className={step === 2 ? "text-brand" : ""}>Team</span>
          <span className={step === 3 ? "text-brand" : ""}>GitHub</span>
        </div>
        {step === 1 ? (
          <>
            <AppInput
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
            <AppInput
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
            <ProjectIconPicker value={iconKey} onChange={setIconKey} />
            <ProjectColorPicker value={colorKey} onChange={setColorKey} />
            <AppButton disabled={title.trim().length < 2} onClick={() => setStep(2)}>
              Next
            </AppButton>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <p className="text-sm leading-6 text-text-secondary">
              Search by handle or display name. Access starts only after each invitation
              is accepted.
            </p>
            <div className="grid gap-3 rounded-md border border-border bg-surface-muted p-3">
              <AppSelect
                label="Invitation role"
                value={inviteRole}
                onValueChange={(value) =>
                  setInviteRole(value as Exclude<ProjectRole, "OWNER">)
                }
                options={invitationRoles.map((role) => ({ value: role, label: role }))}
              />
              <AppInput
                label="Find collaborator"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.currentTarget.value)}
                placeholder="Type at least 2 characters"
              />
              {debouncedMemberSearch.length >= 2 ? (
                <div className="grid gap-2" aria-live="polite">
                  {suggestions.isLoading ? <AppSkeleton className="h-14" /> : null}
                  {visibleSuggestions.map((user) => (
                    <button
                      type="button"
                      key={user.id}
                      onClick={() => addInvitation(user)}
                      className="flex min-h-14 items-center gap-3 rounded-md border border-border bg-surface px-3 text-left transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <AppAvatar name={user.displayName} src={user.avatarUrl} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {user.displayName}
                        </span>
                        <span className="block truncate font-mono text-xs text-text-secondary">
                          @{user.handle}
                        </span>
                      </span>
                    </button>
                  ))}
                  {!suggestions.isLoading && !visibleSuggestions.length ? (
                    <p className="rounded-md border border-border bg-surface p-3 text-sm text-text-secondary">
                      No matching users found.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {pendingInvitations.length ? (
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Selected collaborators</p>
                  <AppAvatarStack
                    users={pendingInvitations.map((invitation) => invitation.user)}
                  />
                </div>
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.user.id}
                    className="grid gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AppAvatar
                        name={invitation.user.displayName}
                        src={invitation.user.avatarUrl}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {invitation.user.displayName}
                        </span>
                        <span className="block truncate font-mono text-xs text-text-secondary">
                          @{invitation.user.handle}
                        </span>
                      </span>
                    </div>
                    <AppSelect
                      label="Role"
                      value={invitation.role}
                      onValueChange={(value) =>
                        updateInvitationRole(
                          invitation.user.id,
                          value as Exclude<ProjectRole, "OWNER">,
                        )
                      }
                      options={invitationRoles.map((role) => ({
                        value: role,
                        label: role,
                      }))}
                    />
                    <AppIconButton
                      label={`Remove ${invitation.user.displayName}`}
                      onClick={() => removeInvitation(invitation.user.id)}
                    >
                      <X className="size-4" />
                    </AppIconButton>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex justify-between">
              <AppButton variant="secondary" onClick={() => setStep(1)}>
                Back
              </AppButton>
              <AppButton onClick={() => setStep(3)}>Next</AppButton>
            </div>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <p className="text-sm leading-6 text-text-secondary">
              GitHub can be connected from project settings after creation. Project
              creation does not require a repository.
            </p>
            <div className="flex justify-between">
              <AppButton variant="secondary" onClick={() => setStep(2)}>
                Back
              </AppButton>
              <AppButton disabled={createProject.isPending} onClick={submit}>
                Create project
              </AppButton>
            </div>
          </>
        ) : null}
      </div>
    </AppDialog>
  );
}

/**
 * Purpose: Render project grid loading state.
 * Inputs: None.
 * Output: Skeleton grid.
 * Side effects: None.
 */
function ProjectGridSkeleton() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <AppSkeleton className="h-52" />
      <AppSkeleton className="h-52" />
      <AppSkeleton className="h-52" />
    </section>
  );
}
