import { addDays } from "date-fns";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  activityEvents,
  notifications,
  projectInvitations,
  projectMemberships,
  projectRepositories,
  projects,
  tasks,
  profiles,
} from "@/db/schema";
import { getDb, type DbExecutor } from "@/lib/db/client";
import { createProfileAssetUrlMap, profileAssetUrl } from "@/server/profile-assets";
import type {
  InvitationStatus,
  NotificationDto,
  NotificationType,
  ProjectColorKey,
  ProjectIconKey,
  ProjectRole,
  ProjectSummary,
} from "@/types/domain";
import { AppError } from "@/lib/api/errors";

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
    .where(
      and(
        eq(projectMemberships.projectId, projectId),
        eq(projectMemberships.userId, userId),
      ),
    )
    .limit(1);
  return (rows[0]?.role as ProjectRole | undefined) ?? null;
}

/**
 * Purpose: Resolve a user's role together with the project's archive state.
 * Inputs: Project and user IDs.
 * Output: Access state or null when the user is not a member.
 * Side effects: Reads projects and memberships.
 */
export async function findProjectAccess(projectId: string, userId: string) {
  const rows = await getDb()
    .select({ role: projectMemberships.role, archivedAt: projects.archivedAt })
    .from(projectMemberships)
    .innerJoin(projects, eq(projectMemberships.projectId, projects.id))
    .where(
      and(
        eq(projectMemberships.projectId, projectId),
        eq(projectMemberships.userId, userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? { role: row.role as ProjectRole, archivedAt: row.archivedAt } : null;
}

/**
 * Purpose: Resolve whether a project exists and is archived.
 * Inputs: Project ID.
 * Output: Archive flag, or null when the project does not exist.
 * Side effects: Reads the projects table.
 */
export async function isProjectArchived(projectId: string): Promise<boolean | null> {
  const rows = await getDb()
    .select({ archivedAt: projects.archivedAt })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return rows[0] ? Boolean(rows[0].archivedAt) : null;
}

/**
 * Purpose: Create a project, owner membership, and all initial invitations atomically.
 * Inputs: Owner identity, validated project fields, and unique invitation payloads.
 * Output: Project row and inserted invitation rows.
 * Side effects: Writes projects, memberships, and invitations in one transaction.
 * Failure behavior: Rolls back the entire operation when an invite is invalid or duplicated.
 */
export async function insertProjectWithInvitations(input: {
  ownerId: string;
  title: string;
  description?: string | null;
  iconKey: ProjectIconKey;
  colorKey: ProjectColorKey;
  timeZone: string;
  invitations: { userId: string; role: Exclude<ProjectRole, "OWNER"> }[];
}) {
  const invitedUserIds = input.invitations.map((invitation) => invitation.userId);
  if (
    invitedUserIds.includes(input.ownerId) ||
    new Set(invitedUserIds).size !== invitedUserIds.length
  ) {
    throw new AppError(
      "CONFLICT",
      409,
      "Project invitations contain a duplicate member.",
    );
  }
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
    const [ownerProfile] = await tx
      .select({
        id: profiles.id,
        handle: profiles.handle,
        displayName: profiles.displayName,
      })
      .from(profiles)
      .where(eq(profiles.id, input.ownerId))
      .limit(1);
    if (!ownerProfile) throw new Error("Project owner profile was not found.");

    if (invitedUserIds.length) {
      const existingProfiles = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(inArray(profiles.id, invitedUserIds));
      if (existingProfiles.length !== invitedUserIds.length) {
        throw new AppError("BAD_REQUEST", 400, "One or more invited users do not exist.");
      }
    }
    const createdInvitations = input.invitations.length
      ? await tx
          .insert(projectInvitations)
          .values(
            input.invitations.map((invitation) => ({
              projectId: project.id,
              invitedUserId: invitation.userId,
              role: invitation.role,
              status: "PENDING" as const,
              invitedBy: input.ownerId,
              expiresAt: addDays(new Date(), 7),
            })),
          )
          .returning()
      : [];
    await tx.insert(activityEvents).values({
      actorId: input.ownerId,
      projectId: project.id,
      eventType: "PROJECT_CREATED",
      metadata: { title: project.title },
    });
    const createdNotifications = createdInvitations.length
      ? await tx
          .insert(notifications)
          .values(
            createdInvitations.map((invitation) => ({
              recipientId: invitation.invitedUserId,
              type: "PROJECT_INVITATION",
              title: "Project invitation",
              body: "You were invited to a Rudo Quest project.",
              href: `/projects/${project.id}?invitation=${invitation.id}`,
            })),
          )
          .returning()
      : [];
    if (createdInvitations.length) {
      await tx.insert(activityEvents).values(
        createdInvitations.map((invitation) => ({
          actorId: input.ownerId,
          projectId: project.id,
          eventType: "MEMBER_INVITED",
          metadata: { role: invitation.role },
        })),
      );
    }
    return {
      project,
      invitations: createdInvitations,
      pushNotifications: createdNotifications.map((notification) => ({
        recipientId: notification.recipientId,
        notification: {
          id: notification.id,
          type: notification.type as NotificationType,
          title: notification.title,
          body: notification.body,
          href: notification.href,
          readAt: notification.readAt?.toISOString() ?? null,
          createdAt: notification.createdAt.toISOString(),
        } satisfies NotificationDto,
      })),
      summary: {
        id: project.id,
        title: project.title,
        description: project.description,
        iconKey: project.iconKey as ProjectIconKey,
        colorKey: project.colorKey as ProjectColorKey,
        timeZone: project.timeZone,
        role: "OWNER" as const,
        openTaskCount: 0,
        completedThisWeek: 0,
        weeklyCompletionPercent: 0,
        githubRepositoryFullName: null,
        members: [{ ...ownerProfile, avatarUrl: null }],
        archivedAt: null,
        createdAt: project.createdAt.toISOString(),
      } satisfies ProjectSummary,
    };
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
  db: DbExecutor = getDb(),
) {
  const [updated] = await db
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
export async function archiveProjectRow(projectId: string, db: DbExecutor = getDb()) {
  const now = new Date();
  const [updated] = await db
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
  projectId?: string;
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
      timeZone: projects.timeZone,
      archivedAt: projects.archivedAt,
      createdAt: projects.createdAt,
      repo: projectRepositories.repositoryFullName,
    })
    .from(projectMemberships)
    .innerJoin(projects, eq(projectMemberships.projectId, projects.id))
    .leftJoin(projectRepositories, eq(projectRepositories.projectId, projects.id))
    .where(
      and(
        eq(projectMemberships.userId, input.userId),
        input.projectId ? eq(projects.id, input.projectId) : undefined,
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

  const taskAggregates = await getDb()
    .select({
      projectId: tasks.projectId,
      openTaskCount: sql<number>`count(*) filter (where ${tasks.status} <> 'DONE')`,
      completedScheduledWeek: sql<number>`count(*) filter (
        where ${tasks.status} = 'DONE'
          and ${tasks.scheduledDate} >= date_trunc('week', now() at time zone ${projects.timeZone})::date
          and ${tasks.scheduledDate} < date_trunc('week', now() at time zone ${projects.timeZone})::date + 7
      )`,
      completedThisWeek: sql<number>`count(*) filter (
        where ${tasks.status} = 'DONE'
          and (${tasks.completedAt} at time zone ${projects.timeZone})::date >= date_trunc('week', now() at time zone ${projects.timeZone})::date
          and (${tasks.completedAt} at time zone ${projects.timeZone})::date < date_trunc('week', now() at time zone ${projects.timeZone})::date + 7
      )`,
      weekTotal: sql<number>`count(*) filter (
        where ${tasks.scheduledDate} >= date_trunc('week', now() at time zone ${projects.timeZone})::date
          and ${tasks.scheduledDate} < date_trunc('week', now() at time zone ${projects.timeZone})::date + 7
      )`,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(inArray(tasks.projectId, ids), isNull(tasks.archivedAt)))
    .groupBy(tasks.projectId);

  const byProject = new Map<string, typeof members>();
  for (const member of members) {
    byProject.set(member.projectId, [...(byProject.get(member.projectId) ?? []), member]);
  }
  const aggregateByProject = new Map(
    taskAggregates.map((aggregate) => [aggregate.projectId, aggregate]),
  );
  const avatarUrls = await createProfileAssetUrlMap(
    members.map((member) => member.avatarPath),
  );
  return membershipRows.map((project) => {
    const aggregate = aggregateByProject.get(project.projectId);
    const completedScheduledWeek = Number(aggregate?.completedScheduledWeek ?? 0);
    const weekTotal = Number(aggregate?.weekTotal ?? 0);
    return {
      id: project.projectId,
      title: project.title,
      description: project.description,
      iconKey: project.iconKey as ProjectIconKey,
      colorKey: project.colorKey as ProjectColorKey,
      timeZone: project.timeZone,
      role: project.role as ProjectRole,
      openTaskCount: Number(aggregate?.openTaskCount ?? 0),
      completedThisWeek: Number(aggregate?.completedThisWeek ?? 0),
      weeklyCompletionPercent: weekTotal
        ? Math.round((completedScheduledWeek / weekTotal) * 100)
        : 0,
      githubRepositoryFullName: project.repo,
      members: (byProject.get(project.projectId) ?? []).slice(0, 5).map((member) => ({
        id: member.userId,
        handle: member.handle,
        displayName: member.displayName,
        avatarUrl: profileAssetUrl(member.avatarPath, avatarUrls),
      })),
      archivedAt: project.archivedAt?.toISOString() ?? null,
      createdAt: project.createdAt?.toISOString() ?? new Date().toISOString(),
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
  const projectsForUser = await listProjectSummaries({
    userId,
    projectId,
    archived: "all",
  });
  return projectsForUser.find((project) => project.id === projectId) ?? null;
}

/**
 * Purpose: Expire all pending invitations whose seven-day window has elapsed.
 * Inputs: None.
 * Output: Number of invitations transitioned to EXPIRED.
 * Side effects: Updates project_invitations.
 */
export async function expirePendingInvitations(): Promise<number> {
  const rows = await getDb()
    .update(projectInvitations)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(projectInvitations.status, "PENDING"),
        sql`${projectInvitations.expiresAt} <= now()`,
      ),
    )
    .returning({ id: projectInvitations.id });
  return rows.length;
}

/**
 * Purpose: List project members with profile summaries.
 * Inputs: Project ID.
 * Output: Member role and profile rows.
 * Side effects: Reads memberships and profiles.
 */
export async function listProjectMembers(projectId: string) {
  const rows = await getDb()
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
  const avatarUrls = await createProfileAssetUrlMap(rows.map((row) => row.avatarPath));
  return rows.map((row) => ({
    id: row.userId,
    handle: row.handle,
    displayName: row.displayName,
    avatarUrl: profileAssetUrl(row.avatarPath, avatarUrls),
    role: row.role as ProjectRole,
    joinedAt: row.joinedAt.toISOString(),
  }));
}

/**
 * Purpose: Create a pending invitation for a non-member.
 * Inputs: Project ID, invited user ID, role, actor ID.
 * Output: Created invitation row.
 * Side effects: Inserts project_invitations.
 * Business rule: Existing pending invitations and existing members are rejected.
 */
export async function insertInvitation(
  input: {
    projectId: string;
    invitedUserId: string;
    role: Exclude<ProjectRole, "OWNER">;
    invitedBy: string;
  },
  db: DbExecutor = getDb(),
) {
  const existingMember = await db
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
  const pending = await db
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
  const [created] = await db
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
  const rows = await getDb()
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
    .where(
      and(
        eq(projectInvitations.projectId, projectId),
        eq(projectInvitations.status, "PENDING"),
      ),
    )
    .orderBy(desc(projectInvitations.createdAt));
  const avatarUrls = await createProfileAssetUrlMap(rows.map((row) => row.avatarPath));
  return rows.map((row) => ({
    id: row.id,
    invitedUserId: row.invitedUserId,
    handle: row.handle,
    displayName: row.displayName,
    avatarUrl: profileAssetUrl(row.avatarPath, avatarUrls),
    role: row.role as Exclude<ProjectRole, "OWNER">,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Purpose: Read one project invitation for transition authorization.
 * Inputs: Project ID and invitation ID.
 * Output: Invitation row or null.
 * Side effects: Reads project_invitations.
 */
export async function findProjectInvitation(projectId: string, invitationId: string) {
  const rows = await getDb()
    .select()
    .from(projectInvitations)
    .where(
      and(
        eq(projectInvitations.id, invitationId),
        eq(projectInvitations.projectId, projectId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
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
  status: Extract<InvitationStatus, "ACCEPTED" | "DECLINED" | "REVOKED">;
}) {
  return getDb().transaction(async (tx) => {
    let pushNotification: NotificationDto | null = null;
    let pushRecipientId: string | null = null;
    const [invitation] = await tx
      .update(projectInvitations)
      .set({
        status: input.status,
        acceptedAt: input.status === "ACCEPTED" ? new Date() : null,
      })
      .where(
        and(
          eq(projectInvitations.id, input.invitationId),
          eq(projectInvitations.projectId, input.projectId),
          eq(projectInvitations.status, "PENDING"),
          input.status === "REVOKED"
            ? undefined
            : eq(projectInvitations.invitedUserId, input.actorId),
          input.status === "ACCEPTED"
            ? sql`${projectInvitations.expiresAt} > now()`
            : undefined,
        ),
      )
      .returning();
    if (!invitation) return null;
    if (input.status === "ACCEPTED") {
      await tx.insert(projectMemberships).values({
        projectId: invitation.projectId,
        userId: invitation.invitedUserId,
        role: invitation.role,
      });
      await tx.insert(activityEvents).values({
        actorId: input.actorId,
        projectId: input.projectId,
        eventType: "MEMBER_JOINED",
      });
      const [project] = await tx
        .select({ ownerId: projects.ownerId })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);
      if (project?.ownerId && project.ownerId !== input.actorId) {
        const [ownerNotification] = await tx
          .insert(notifications)
          .values({
            recipientId: project.ownerId,
            type: "INVITATION_ACCEPTED",
            title: "Invitation accepted",
            body: "A collaborator joined your project.",
            href: `/projects/${input.projectId}`,
          })
          .returning();
        if (ownerNotification) {
          pushRecipientId = project.ownerId;
          pushNotification = {
            id: ownerNotification.id,
            type: ownerNotification.type as NotificationType,
            title: ownerNotification.title,
            body: ownerNotification.body,
            href: ownerNotification.href,
            readAt: ownerNotification.readAt?.toISOString() ?? null,
            createdAt: ownerNotification.createdAt.toISOString(),
          } satisfies NotificationDto;
        }
      }
    }
    if (input.status !== "REVOKED") {
      await tx
        .update(notifications)
        .set({
          title:
            input.status === "ACCEPTED"
              ? "Project invitation accepted"
              : "Project invitation declined",
          body:
            input.status === "ACCEPTED"
              ? "You joined the project."
              : "You declined the project invitation.",
          href: input.status === "ACCEPTED" ? `/projects/${input.projectId}` : null,
          readAt: new Date(),
        })
        .where(
          and(
            eq(notifications.recipientId, invitation.invitedUserId),
            eq(notifications.type, "PROJECT_INVITATION"),
            eq(
              notifications.href,
              `/projects/${input.projectId}?invitation=${invitation.id}`,
            ),
          ),
        );
    }
    return { invitation, pushNotification, pushRecipientId };
  });
}

/**
 * Purpose: Transfer project ownership to an existing non-owner member atomically.
 * Inputs: Project ID and target member ID.
 * Output: Updated owner and previous-owner memberships.
 * Side effects: Changes two membership roles in one transaction.
 * Failure behavior: Returns null when the target is not an active member.
 */
export async function transferProjectOwnership(input: {
  projectId: string;
  currentOwnerId: string;
  targetUserId: string;
}) {
  return getDb().transaction(async (tx) => {
    const target = await tx
      .select({ role: projectMemberships.role })
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.projectId, input.projectId),
          eq(projectMemberships.userId, input.targetUserId),
          ne(projectMemberships.role, "OWNER"),
        ),
      )
      .limit(1);
    if (!target.length) return null;
    await tx
      .update(projectMemberships)
      .set({ role: "ADMIN" })
      .where(
        and(
          eq(projectMemberships.projectId, input.projectId),
          eq(projectMemberships.userId, input.currentOwnerId),
          eq(projectMemberships.role, "OWNER"),
        ),
      );
    await tx
      .update(projects)
      .set({ ownerId: input.targetUserId, updatedAt: new Date() })
      .where(
        and(eq(projects.id, input.projectId), eq(projects.ownerId, input.currentOwnerId)),
      );
    const [newOwner] = await tx
      .update(projectMemberships)
      .set({ role: "OWNER" })
      .where(
        and(
          eq(projectMemberships.projectId, input.projectId),
          eq(projectMemberships.userId, input.targetUserId),
        ),
      )
      .returning();
    if (newOwner) {
      await tx.insert(activityEvents).values({
        actorId: input.currentOwnerId,
        projectId: input.projectId,
        eventType: "PROJECT_UPDATED",
      });
    }
    return newOwner ?? null;
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
export async function removeMember(input: {
  projectId: string;
  userId: string;
  actorId: string;
}) {
  return getDb().transaction(async (tx) => {
    const [member] = await tx
      .select({ id: projectMemberships.id })
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.projectId, input.projectId),
          eq(projectMemberships.userId, input.userId),
          ne(projectMemberships.role, "OWNER"),
        ),
      )
      .limit(1);
    if (!member) return null;
    await tx
      .update(tasks)
      .set({
        assigneeId: null,
        version: sql`${tasks.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(tasks.projectId, input.projectId), eq(tasks.assigneeId, input.userId)),
      );
    const [deleted] = await tx
      .delete(projectMemberships)
      .where(eq(projectMemberships.id, member.id))
      .returning();
    if (!deleted) return null;
    await tx.insert(activityEvents).values({
      actorId: input.actorId,
      projectId: input.projectId,
      eventType: "MEMBER_REMOVED",
    });
    return deleted;
  });
}

/**
 * Purpose: Check whether a user is an active member of a project.
 * Inputs: Project ID and user ID.
 * Output: True when a membership exists.
 * Side effects: Reads memberships.
 */
export async function isProjectMember(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const rows = await getDb()
    .select({ id: projectMemberships.id })
    .from(projectMemberships)
    .where(
      and(
        eq(projectMemberships.projectId, projectId),
        eq(projectMemberships.userId, userId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
