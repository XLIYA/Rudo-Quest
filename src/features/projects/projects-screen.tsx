"use client";

import Link from "next/link";
import type { Route } from "next";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppAvatar } from "@/components/ui/app-avatar";
import { AppAvatarStack } from "@/components/ui/app-avatar-stack";
import { AppButton } from "@/components/ui/app-button";
import { AppDialog } from "@/components/ui/app-dialog";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { AppIconButton } from "@/components/ui/app-icon-button";
import { AppInput } from "@/components/ui/app-input";
import { AppTextarea } from "@/components/ui/app-textarea";
import { AppTimeZoneInput } from "@/components/ui/app-time-zone-input";
import { AppProgress } from "@/components/ui/app-progress";
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
import { useOnline } from "@/hooks/use-online";

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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState("all");
  const [archived, setArchived] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);
  const online = useOnline();
  const params = new URLSearchParams();
  if (debouncedSearch) params.set("q", debouncedSearch);
  if (role !== "all") params.set("role", role);
  params.set("archived", archived);
  const query = useProjects(`?${params.toString()}`);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => window.clearTimeout(timeout);
  }, [search]);

  return (
    <main className="mx-auto grid max-w-7xl gap-5 p-5 md:p-8">
      <PageHeader
        title="Projects"
        description="Small shared spaces for assignment, progress, members, and one GitHub repository."
        action={
          <AppButton onClick={() => setCreateOpen(true)} disabled={!online}>
            Create project
          </AppButton>
        }
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
      {query.isError ? (
        <AppEmptyState
          title="Projects unavailable"
          description="Rudo Quest could not load your projects. Try again when the connection is available."
          action={
            <AppButton variant="secondary" onClick={() => void query.refetch()}>
              Try again
            </AppButton>
          }
        />
      ) : null}
      {query.isLoading ? <ProjectGridSkeleton /> : null}
      {!query.isError && query.data?.length ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </section>
      ) : null}
      {!query.isError && query.data && !query.data.length ? (
        <AppEmptyState
          title="No projects"
          description="Create a project when a task needs a shared owner, member list, or GitHub repository."
          action={
            <AppButton onClick={() => setCreateOpen(true)} disabled={!online}>
              Create project
            </AppButton>
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
          {project.archivedAt ? "ARCHIVED" : project.role}
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
        <span>
          {project.completedThisWeek} done · {project.weeklyCompletionPercent}% scheduled
        </span>
        <span>
          {project.githubRepositoryFullName ? "GitHub connected" : "No repository"}
        </span>
      </div>
      <AppProgress
        value={project.weeklyCompletionPercent}
        label={`${project.title} weekly completion`}
        className="mt-2"
      />
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
  const router = useRouter();
  const online = useOnline();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [iconKey, setIconKey] = useState<ProjectIconKey>("Compass");
  const [colorKey, setColorKey] = useState<ProjectColorKey>("orange");
  const [timeZone, setTimeZone] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<ProjectRole, "OWNER">>("MEMBER");
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [step, setStep] = useState(1);
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiGet<{ id: string; timeZone: string }>("/api/me", signal),
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
  const effectiveTimeZone =
    timeZone ||
    me.data?.timeZone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedMemberSearch(memberSearch.trim()),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [memberSearch]);

  /**
   * Purpose: Return the multi-step project dialog to clean defaults.
   * Inputs: None.
   * Output: Void.
   * Side effects: Clears local form, search, invitation, and step state.
   */
  const resetDraft = () => {
    setTitle("");
    setDescription("");
    setIconKey("Compass");
    setColorKey("orange");
    setTimeZone("");
    setMemberSearch("");
    setDebouncedMemberSearch("");
    setPendingInvitations([]);
    setInviteRole("MEMBER");
    setStep(1);
  };

  /**
   * Purpose: Create the project and optionally continue into GitHub connection.
   * Inputs: Whether the final step requested GitHub setup.
   * Output: Promise resolving after success or handled failure.
   * Side effects: Calls project creation, closes/reset dialog, and may navigate.
   */
  const submit = async (connectGithub: boolean) => {
    let created: ProjectSummary;
    try {
      created = await createProject.mutateAsync({
        title,
        description: description || null,
        iconKey,
        colorKey,
        timeZone: effectiveTimeZone,
        invitations: pendingInvitations.map((invitation) => ({
          userId: invitation.user.id,
          role: invitation.role,
        })),
      });
    } catch {
      return;
    }
    resetDraft();
    onOpenChange(false);
    if (connectGithub) {
      router.push(`/projects/${created.id}/settings?connectGithub=1` as Route);
    }
  };

  /**
   * Purpose: Add one unique collaborator to the pending invitation draft.
   * Inputs: Public user suggestion.
   * Output: Void.
   * Side effects: Updates selected invitations and clears the search field.
   */
  const addInvitation = (user: ProfileSummary) => {
    if (selectedUserIds.has(user.id) || user.id === me.data?.id) return;
    setPendingInvitations((current) => [...current, { user, role: inviteRole }]);
    setMemberSearch("");
    setDebouncedMemberSearch("");
  };

  /**
   * Purpose: Change a pending invitation to an allowed non-owner role.
   * Inputs: Selected user ID and new role.
   * Output: Void.
   * Side effects: Updates local invitation draft state.
   */
  const updateInvitationRole = (userId: string, role: Exclude<ProjectRole, "OWNER">) => {
    setPendingInvitations((current) =>
      current.map((invitation) =>
        invitation.user.id === userId ? { ...invitation, role } : invitation,
      ),
    );
  };

  /**
   * Purpose: Remove a collaborator before project creation.
   * Inputs: Selected user ID.
   * Output: Void.
   * Side effects: Updates local invitation draft state.
   */
  const removeInvitation = (userId: string) => {
    setPendingInvitations((current) =>
      current.filter((invitation) => invitation.user.id !== userId),
    );
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetDraft();
        onOpenChange(nextOpen);
      }}
      title="Create project"
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex justify-between gap-2 text-xs font-semibold text-text-secondary">
            <span className={step === 1 ? "text-brand" : ""}>Details</span>
            <span className={step === 2 ? "text-brand" : ""}>Team</span>
            <span className={step === 3 ? "text-brand" : ""}>GitHub</span>
          </div>
          <AppProgress
            value={(step / 3) * 100}
            label="Create project progress"
            className="h-1.5"
          />
        </div>
        {step === 1 ? (
          <>
            <AppInput
              label="Title"
              maxLength={60}
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
            <AppTextarea
              label="Description"
              maxLength={500}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
            <ProjectIconPicker value={iconKey} onChange={setIconKey} />
            <ProjectColorPicker value={colorKey} onChange={setColorKey} />
            <AppTimeZoneInput
              value={effectiveTimeZone}
              onChange={(event) => setTimeZone(event.currentTarget.value)}
            />
            <AppButton
              disabled={!online || title.trim().length < 2}
              onClick={() => setStep(2)}
            >
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
                  {suggestions.isError ? (
                    <p role="alert" className="text-sm text-error">
                      Collaborators could not be loaded. Check the connection and try
                      again.
                    </p>
                  ) : null}
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
                  {!suggestions.isLoading &&
                  !suggestions.isError &&
                  !visibleSuggestions.length ? (
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
              <AppButton disabled={!online} onClick={() => setStep(3)}>
                Next
              </AppButton>
            </div>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <p className="text-sm leading-6 text-text-secondary">
              A repository is optional. If you connect one, Rudo will open project
              settings after creation so you can authorize the GitHub App and choose an
              available repository.
            </p>
            <div className="flex flex-wrap justify-between gap-2">
              <AppButton variant="secondary" onClick={() => setStep(2)}>
                Back
              </AppButton>
              <div className="flex flex-wrap gap-2">
                <AppButton
                  variant="secondary"
                  disabled={!online || createProject.isPending}
                  onClick={() => void submit(false)}
                >
                  Create without GitHub
                </AppButton>
                <AppButton
                  disabled={!online || createProject.isPending}
                  onClick={() => void submit(true)}
                >
                  Create and connect GitHub
                </AppButton>
              </div>
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
