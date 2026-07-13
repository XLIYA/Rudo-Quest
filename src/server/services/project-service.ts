import { AppError } from "@/lib/api/errors";
import { runDbTransaction } from "@/lib/db/client";
import type { InvitationStatus, ProjectRole } from "@/types/domain";
import { assertProjectRole } from "@/server/policies/project-policy";
import { createActivityEvent } from "@/server/repositories/activity-repository";
import {
  archiveProjectRow,
  findProjectInvitation,
  findProjectAccess,
  findProjectRole,
  findProjectSummary,
  isProjectArchived,
  expirePendingInvitations,
  insertInvitation,
  insertProjectWithInvitations,
  listProjectInvitations,
  listProjectMembers,
  listProjectSummaries,
  removeMember,
  transitionInvitation,
  updateMemberRole,
  updateProjectRow,
  transferProjectOwnership,
} from "@/server/repositories/project-repository";
import {
  createNotification,
  deliverPushBestEffort,
} from "@/server/services/notification-service";

/**
 * Purpose: Require a minimum role on a project that is still active.
 * Inputs: Project ID, current user ID, and minimum accepted role.
 * Output: The user's verified server-side role.
 * Side effects: Reads project access.
 * Failure behavior: Throws forbidden or conflict for insufficient access or archived projects.
 */
async function requireActiveProjectRole(
  projectId: string,
  userId: string,
  minimum: ProjectRole,
): Promise<ProjectRole> {
  const access = await findProjectAccess(projectId, userId);
  if (!access) {
    assertProjectRole(null, minimum);
    throw new AppError("FORBIDDEN", 403, "Project access is required.");
  }
  assertProjectRole(access.role, minimum);
  if (access?.archivedAt) {
    throw new AppError("CONFLICT", 409, "Archived projects are read-only.");
  }
  return access.role;
}

/**
 * Purpose: List projects visible to a user.
 * Inputs: User ID and filters.
 * Output: Project summary DTOs.
 * Side effects: Reads database.
 */
export async function listProjectsForUser(
  userId: string,
  filters: { q?: string; role?: ProjectRole; archived?: "active" | "archived" | "all" },
) {
  return listProjectSummaries({ userId, ...filters });
}

/**
 * Purpose: Create a project with owner membership and optional invitations.
 * Inputs: Actor ID and validated create project payload.
 * Output: Created project summary.
 * Side effects: Writes project, memberships, invitations, notifications, activity.
 */
export async function createProject(
  userId: string,
  payload: Omit<
    Parameters<typeof insertProjectWithInvitations>[0],
    "ownerId" | "invitations"
  > & {
    invitations?: { userId: string; role: Exclude<ProjectRole, "OWNER"> }[];
  },
) {
  const { summary, pushNotifications } = await insertProjectWithInvitations({
    ...payload,
    ownerId: userId,
    invitations: payload.invitations ?? [],
  });
  await Promise.all(
    pushNotifications.map(({ notification, recipientId }) =>
      deliverPushBestEffort(notification, recipientId),
    ),
  );
  return summary;
}

/**
 * Purpose: Read a single visible project.
 * Inputs: Actor ID and project ID.
 * Output: Project summary.
 * Side effects: Reads project membership.
 */
export async function getProject(userId: string, projectId: string) {
  const project = await findProjectSummary(projectId, userId);
  if (!project) throw new AppError("NOT_FOUND", 404, "Project not found.");
  return project;
}

/**
 * Purpose: Update project metadata as owner/admin.
 * Inputs: Actor ID, project ID, and mutable fields.
 * Output: Updated project row.
 * Side effects: Writes project and activity event.
 */
export async function updateProject(
  userId: string,
  projectId: string,
  values: Parameters<typeof updateProjectRow>[1],
) {
  await requireActiveProjectRole(projectId, userId, "ADMIN");
  return runDbTransaction(async (tx) => {
    const updated = await updateProjectRow(projectId, values, tx);
    if (!updated) throw new AppError("NOT_FOUND", 404, "Project not found.");
    await createActivityEvent(
      { actorId: userId, projectId, eventType: "PROJECT_UPDATED" },
      tx,
    );
    return updated;
  });
}

/**
 * Purpose: Archive a project as owner only.
 * Inputs: Actor ID and project ID.
 * Output: Archived project row.
 * Side effects: Sets archived_at and writes activity.
 */
export async function archiveProject(userId: string, projectId: string) {
  await requireActiveProjectRole(projectId, userId, "OWNER");
  return runDbTransaction(async (tx) => {
    const updated = await archiveProjectRow(projectId, tx);
    if (!updated) throw new AppError("NOT_FOUND", 404, "Project not found.");
    await createActivityEvent(
      { actorId: userId, projectId, eventType: "PROJECT_ARCHIVED" },
      tx,
    );
    return updated;
  });
}

/**
 * Purpose: List project members after view authorization.
 * Inputs: Actor ID and project ID.
 * Output: Member list.
 * Side effects: Reads memberships.
 */
export async function getProjectMembers(userId: string, projectId: string) {
  const role = await findProjectRole(projectId, userId);
  assertProjectRole(role, "VIEWER");
  return listProjectMembers(projectId);
}

/**
 * Purpose: List project invitations after admin authorization.
 * Inputs: Actor ID and project ID.
 * Output: Invitation list.
 * Side effects: Reads invitations.
 */
export async function getProjectInvitations(userId: string, projectId: string) {
  await expirePendingInvitations();
  await requireActiveProjectRole(projectId, userId, "ADMIN");
  return listProjectInvitations(projectId);
}

/**
 * Purpose: Invite a non-member to a project.
 * Inputs: Actor ID, project ID, invited user ID, and role.
 * Output: Created invitation.
 * Side effects: Writes invitation, notification, and activity.
 */
export async function inviteProjectMember(
  userId: string,
  projectId: string,
  payload: { invitedUserId: string; role: Exclude<ProjectRole, "OWNER"> },
) {
  await expirePendingInvitations();
  await requireActiveProjectRole(projectId, userId, "ADMIN");
  const result = await runDbTransaction(async (tx) => {
    const invitation = await insertInvitation(
      {
        projectId,
        invitedUserId: payload.invitedUserId,
        role: payload.role,
        invitedBy: userId,
      },
      tx,
    );
    if (!invitation)
      throw new AppError("CONFLICT", 409, "User is already invited or a member.");
    const notification = await createNotification(
      {
        recipientId: payload.invitedUserId,
        type: "PROJECT_INVITATION",
        title: "Project invitation",
        body: "You were invited to a Rudo Quest project.",
        href: `/projects/${projectId}?invitation=${invitation.id}`,
      },
      tx,
    );
    await createActivityEvent(
      {
        actorId: userId,
        projectId,
        eventType: "MEMBER_INVITED",
        metadata: { role: payload.role },
      },
      tx,
    );
    return { invitation, notification };
  });
  await deliverPushBestEffort(result.notification, payload.invitedUserId);
  return result.invitation;
}

/**
 * Purpose: Accept, decline, or revoke an invitation under the correct authorization rules.
 * Inputs: Actor ID, project ID, invitation ID, and target transition.
 * Output: Updated invitation.
 * Side effects: Updates invitations, may insert membership, writes activity and notifications.
 */
export async function changeInvitationStatus(
  userId: string,
  projectId: string,
  invitationId: string,
  status: Extract<InvitationStatus, "ACCEPTED" | "DECLINED" | "REVOKED">,
) {
  await expirePendingInvitations();
  const existing = await findProjectInvitation(projectId, invitationId);
  if (!existing) throw new AppError("NOT_FOUND", 404, "Invitation not found.");
  const archived = await isProjectArchived(projectId);
  if (archived === null) throw new AppError("NOT_FOUND", 404, "Project not found.");
  if (archived) throw new AppError("CONFLICT", 409, "Archived projects are read-only.");
  if (status === "REVOKED") {
    await requireActiveProjectRole(projectId, userId, "ADMIN");
  } else if (existing.invitedUserId !== userId) {
    throw new AppError("FORBIDDEN", 403, "You cannot change this invitation.");
  }
  if (status === "ACCEPTED" && existing.expiresAt < new Date()) {
    throw new AppError("CONFLICT", 409, "Invitation has expired.");
  }
  const transition = await transitionInvitation({
    projectId,
    invitationId,
    actorId: userId,
    status,
  });
  if (!transition) throw new AppError("CONFLICT", 409, "Invitation cannot be changed.");
  if (transition.pushNotification && transition.pushRecipientId) {
    await deliverPushBestEffort(transition.pushNotification, transition.pushRecipientId);
  }
  return transition.invitation;
}

/**
 * Purpose: Transfer project ownership after explicit confirmation.
 * Inputs: Current owner ID, project ID, and target member ID.
 * Output: New owner membership.
 * Side effects: Updates membership roles and logs the project change.
 * Failure behavior: Throws when the actor is not the owner or target is not a member.
 */
export async function transferOwnership(
  userId: string,
  projectId: string,
  targetUserId: string,
) {
  await requireActiveProjectRole(projectId, userId, "OWNER");
  if (targetUserId === userId)
    throw new AppError("BAD_REQUEST", 400, "Choose another member.");
  const transferred = await transferProjectOwnership({
    projectId,
    currentOwnerId: userId,
    targetUserId,
  });
  if (!transferred) throw new AppError("NOT_FOUND", 404, "Target member not found.");
  return transferred;
}

/**
 * Purpose: Change a non-owner member role.
 * Inputs: Actor ID, project ID, target user ID, and new role.
 * Output: Updated membership.
 * Side effects: Updates membership role.
 */
export async function changeMemberRole(
  userId: string,
  projectId: string,
  targetUserId: string,
  role: Exclude<ProjectRole, "OWNER">,
) {
  const actorRole = await requireActiveProjectRole(projectId, userId, "ADMIN");
  const targetRole = await findProjectRole(projectId, targetUserId);
  if (actorRole === "ADMIN" && (role === "ADMIN" || targetRole === "ADMIN")) {
    throw new AppError(
      "FORBIDDEN",
      403,
      "Only the owner can change an administrator's role.",
    );
  }
  const updated = await updateMemberRole({ projectId, userId: targetUserId, role });
  if (!updated) throw new AppError("NOT_FOUND", 404, "Member not found.");
  return updated;
}

/**
 * Purpose: Remove a non-owner project member.
 * Inputs: Actor ID, project ID, target user ID.
 * Output: Removed membership.
 * Side effects: Deletes membership and writes activity.
 */
export async function removeProjectMember(
  userId: string,
  projectId: string,
  targetUserId: string,
) {
  await requireActiveProjectRole(projectId, userId, "ADMIN");
  const removed = await removeMember({
    projectId,
    userId: targetUserId,
    actorId: userId,
  });
  if (!removed)
    throw new AppError("NOT_FOUND", 404, "Member not found or cannot be removed.");
  return removed;
}
