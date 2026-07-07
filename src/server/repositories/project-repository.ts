import { addDays } from "date-fns";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  projectInvitations,
  projectMemberships,
  projectRepositories,
  projects,
  tasks,
  profiles,
} from "@/db/schema";
import { getDb } from "@/lib/db/client";
import type { ProjectColorKey, ProjectIconKey, ProjectRole, ProjectSummary } from "@/types/domain";

/**
 * Purpose: Find the current user's role in a project.
 * Inputs: Project ID and user ID.
 * Output: Role or null.
 * Side effects: Reads memberships.
 */
export async function findProjectRole(
  projectId: string,
  userId: string,
): Promise<ProjectRole | null> {
  const rows = await getDb()
    .select({ role: projectMemberships.role })
    .from(projectMemberships)
    .where(and(eq(projectMemberships.projectId, projectId), eq(projectMemberships.userId, userId)))
    .limit(1);
  return (rows[0]?.role as ProjectRole | undefined) ?? null;
}

/**
 * Purpose: Create a project and owner membership atomically.
 * Inputs: Creator ID and validated project fields.
 * Output: Created project row.
 * Side effects: Inserts project and owner membership in a transaction.
 */
export async function insertProject(input: {
  ownerId: string;
  title: string;
  description?: string | null;
  iconKey: ProjectIconKey;
  colorKey: ProjectColorKey;
  timeZone: string;
}) {
  return getDb().transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        ownerId: input.ownerId,
        title: input.title,
        description: input.description ?? null,
        iconKey: input.iconKey,
        colorKey: input.colorKey,
        timeZone: input.timeZone,
      })
      .returning();
    if (!project) throw new Error("Project insert failed.");
    await tx.insert(projectMemberships).values({
      projectId: project.id,
      userId: input.ownerId,
      role: "OWNER",
    });
    return project;
  });
}

/**
 * Purpose: Update project details.
 * Inputs: Project ID and validated mutable fields.
 * Output: Updated project row or null.
 * Side effects: Writes project fields and updated_at.
 */
export async function updateProjectRow(
  projectId: string,
  values: Partial<{
    title: string;
    description: string | null;
    iconKey: ProjectIconKey;
    colorKey: ProjectColorKey;
    timeZone: string;
  }>,
) {
  const [updated] = await getDb()
    .update(projects)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  return updated ?? null;
}

/**
 * Purpose: Soft-archive a project.
 * Inputs: Project ID.
 * Output: Archived project row or null.
 * Side effects: Sets archived_at and updated_at.
 */
export async function archiveProjectRow(projectId: string) {
  const now = new Date();
  const [updated] = await getDb()
    .update(projects)
    .set({ archivedAt: now, updatedAt: now })
    .where(eq(projects.id, projectId))
    .returning();
  return updated ?? null;
}

/**
 * Purpose: Read projects visible to a user with summary counts.
 * Inputs: User ID and optional filters.
 * Output: Project cards with member summaries and aggregate counts.
 * Side effects: Reads project, membership, repository, and task tables.
 */
export async function listProjectSummaries(input: {
  userId: string;
  q?: string;
  role?: ProjectRole;
  archived?: "active" | "archived" | "all";
}): Promise<ProjectSummary[]> {
  const membershipRows = await getDb()
    .select({
      projectId: projectMemberships.projectId,
      role: projectMemberships.role,
      title: projects.title,
      description: projects.description,
      iconKey: projects.iconKey,
      colorKey: projects.colorKey,
      archivedAt: projects.archivedAt,
      repo: projectRepositories.repositoryFullName,
    })
    .from(projectMemberships)
    .innerJoin(projects, eq(projectMemberships.projectId, projects.id))
    .leftJoin(projectRepositories, eq(projectRepositories.projectId, projects.id))
    .where(
      and(
        eq(projectMemberships.userId, input.userId),
        input.role ? eq(projectMemberships.role, input.role) : undefined,
        input.archived === "active"
          ? isNull(projects.archivedAt)
          : input.archived === "archived"
            ? sql`${projects.archivedAt} is not null`
            : undefined,
        input.q ? sql`${projects.title} ilike ${`%${input.q}%`}` : undefined,
      ),
    )
    .orderBy(desc(projects.updatedAt));

  const ids = membershipRows.map((row) => row.projectId);
  if (ids.length === 0) return [];
  const members = await getDb()
    .select({
      projectId: projectMemberships.projectId,
      userId: profiles.id,
      handle: profiles.handle,
      displayName: profiles.displayName,
      avatarPath: profiles.avatarPath,
    })
    .from(projectMemberships)
    .innerJoin(profiles, eq(projectMemberships.userId, profiles.id))
    .where(inArray(projectMemberships.projectId, ids));

  const taskRows = await getDb()
    .select({
      projectId: tasks.projectId,
      status: tasks.status,
      scheduledDate: tasks.scheduledDate,
    })
    .from(tasks)
    .where(and(inArray(tasks.projectId, ids), isNull(tasks.archivedAt)));

  const byProject = new Map<string, typeof members>();
  for (const member of members) {
    byProject.set(member.projectId, [...(byProject.get(member.projectId) ?? []), member]);
  }
  const today = new Date();
  const weekAgo = addDays(today, -7);
  return membershipRows.map((project) => {
    const projectTasks = taskRows.filter((task) => task.projectId === project.projectId);
    const completedWeek = projectTasks.filter(
      (task) => task.status === "DONE" && new Date(task.scheduledDate) >= weekAgo,
    ).length;
    const weekTotal = projectTasks.filter((task) => new Date(task.scheduledDate) >= weekAgo).length;
    return {
      id: project.projectId,
      title: project.title,
      description: project.description,
      iconKey: project.iconKey as ProjectIconKey,
      colorKey: project.colorKey as ProjectColorKey,
      role: project.role as ProjectRole,
      openTaskCount: projectTasks.filter((task) => task.status !== "DONE").length,
      weeklyCompletionPercent: weekTotal ? Math.round((completedWeek / weekTotal) * 100) : 0,
      githubRepositoryFullName: project.repo,
      members: (byProject.get(project.projectId) ?? []).slice(0, 5).map((member) => ({
        id: member.userId,
        handle: member.handle,
        displayName: member.displayName,
        avatarUrl: member.avatarPath,
      })),
      archivedAt: project.archivedAt?.toISOString() ?? null,
    };
  });
}

/**
 * Purpose: Read a project if visible to a user.
 * Inputs: Project ID and user ID.
 * Output: Project summary with role.
 * Side effects: Reads project summaries.
 */
export async function findProjectSummary(projectId: string, userId: string) {
  const projectsForUser = await listProjectSummaries({ userId, archived: "all" });
  return projectsForUser.find((project) => project.id === projectId) ?? null;
}

/**
 * Purpose: List project members with profile summaries.
 * Inputs: Project ID.
 * Output: Member role and profile rows.
 * Side effects: Reads memberships and profiles.
 */
export async function listProjectMembers(projectId: string) {
  return getDb()
    .select({
      userId: profiles.id,
      handle: profiles.handle,
      displayName: profiles.displayName,
      avatarPath: profiles.avatarPath,
      role: projectMemberships.role,
      joinedAt: projectMemberships.joinedAt,
    })
    .from(projectMemberships)
    .innerJoin(profiles, eq(projectMemberships.userId, profiles.id))
    .where(eq(projectMemberships.projectId, projectId))
    .orderBy(projectMemberships.role, profiles.displayName);
}

/**
 * Purpose: Create a pending invitation for a non-member.
 * Inputs: Project ID, invited user ID, role, actor ID.
 * Output: Created invitation row.
 * Side effects: Inserts project_invitations.
 * Business rule: Existing pending invitations and existing members are rejected.
 */
export async function insertInvitation(input: {
  projectId: string;
  invitedUserId: string;
  role: Exclude<ProjectRole, "OWNER">;
  invitedBy: string;
}) {
  const existingMember = await getDb()
    .select({ id: projectMemberships.id })
    .from(projectMemberships)
    .where(
      and(
        eq(projectMemberships.projectId, input.projectId),
        eq(projectMemberships.userId, input.invitedUserId),
      ),
    )
    .limit(1);
  if (existingMember.length) return null;
  const pending = await getDb()
    .select({ id: projectInvitations.id })
    .from(projectInvitations)
    .where(
      and(
        eq(projectInvitations.projectId, input.projectId),
        eq(projectInvitations.invitedUserId, input.invitedUserId),
        eq(projectInvitations.status, "PENDING"),
      ),
    )
    .limit(1);
  if (pending.length) return null;
  const [created] = await getDb()
    .insert(projectInvitations)
    .values({
      projectId: input.projectId,
      invitedUserId: input.invitedUserId,
      role: input.role,
      status: "PENDING",
      invitedBy: input.invitedBy,
      expiresAt: addDays(new Date(), 7),
    })
    .returning();
  return created ?? null;
}

/**
 * Purpose: List project invitations.
 * Inputs: Project ID.
 * Output: Invitation rows joined with invited profile.
 * Side effects: Reads invitations.
 */
export async function listProjectInvitations(projectId: string) {
  return getDb()
    .select({
      id: projectInvitations.id,
      invitedUserId: profiles.id,
      handle: profiles.handle,
      displayName: profiles.displayName,
      avatarPath: profiles.avatarPath,
      role: projectInvitations.role,
      status: projectInvitations.status,
      expiresAt: projectInvitations.expiresAt,
      createdAt: projectInvitations.createdAt,
    })
    .from(projectInvitations)
    .innerJoin(profiles, eq(projectInvitations.invitedUserId, profiles.id))
    .where(eq(projectInvitations.projectId, projectId))
    .orderBy(desc(projectInvitations.createdAt));
}

/**
 * Purpose: Transition an invitation and optionally create membership on acceptance.
 * Inputs: Invitation ID, actor ID, and target status.
 * Output: Updated invitation row or null.
 * Side effects: Updates invitation and inserts membership when accepted.
 */
export async function transitionInvitation(input: {
  projectId: string;
  invitationId: string;
  actorId: string;
  status: "ACCEPTED" | "DECLINED" | "REVOKED";
}) {
  return getDb().transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.id, input.invitationId),
          eq(projectInvitations.projectId, input.projectId),
        ),
      )
      .limit(1);
    if (!invitation || invitation.status !== "PENDING") return null;
    if (input.status === "ACCEPTED") {
      if (invitation.invitedUserId !== input.actorId || invitation.expiresAt < new Date()) {
        return null;
      }
      await tx.insert(projectMemberships).values({
        projectId: invitation.projectId,
        userId: invitation.invitedUserId,
        role: invitation.role,
      });
    }
    const [updated] = await tx
      .update(projectInvitations)
      .set({
        status: input.status,
        acceptedAt: input.status === "ACCEPTED" ? new Date() : null,
      })
      .where(eq(projectInvitations.id, invitation.id))
      .returning();
    return updated ?? null;
  });
}

/**
 * Purpose: Update a member's role.
 * Inputs: Project ID, user ID, and new role.
 * Output: Updated membership or null.
 * Side effects: Writes membership role.
 */
export async function updateMemberRole(input: {
  projectId: string;
  userId: string;
  role: Exclude<ProjectRole, "OWNER">;
}) {
  const [updated] = await getDb()
    .update(projectMemberships)
    .set({ role: input.role })
    .where(
      and(
        eq(projectMemberships.projectId, input.projectId),
        eq(projectMemberships.userId, input.userId),
        ne(projectMemberships.role, "OWNER"),
      ),
    )
    .returning();
  return updated ?? null;
}

/**
 * Purpose: Remove a non-owner project member.
 * Inputs: Project ID and user ID.
 * Output: Removed membership or null.
 * Side effects: Deletes membership row.
 */
export async function removeMember(input: { projectId: string; userId: string }) {
  const [deleted] = await getDb()
    .delete(projectMemberships)
    .where(
      and(
        eq(projectMemberships.projectId, input.projectId),
        eq(projectMemberships.userId, input.userId),
        ne(projectMemberships.role, "OWNER"),
      ),
    )
    .returning();
  return deleted ?? null;
}

/**
 * Purpose: Check whether a user is an active member of a project.
 * Inputs: Project ID and user ID.
 * Output: True when a membership exists.
 * Side effects: Reads memberships.
 */
export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: projectMemberships.id })
    .from(projectMemberships)
    .where(and(eq(projectMemberships.projectId, projectId), eq(projectMemberships.userId, userId)))
    .limit(1);
  return rows.length > 0;
}
