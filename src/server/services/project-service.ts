import { AppError } from "@/lib/api/errors";
import type { ProjectRole } from "@/types/domain";
import { assertProjectRole } from "@/server/policies/project-policy";
import { createActivityEvent } from "@/server/repositories/activity-repository";
import {
  archiveProjectRow,
  findProjectInvitation,
  findProjectRole,
  findProjectSummary,
  findProjectOwnerId,
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
import { createNotification } from "@/server/services/notification-service";

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
  const { project, invitations } = await insertProjectWithInvitations({
    ...payload,
    ownerId: userId,
    invitations: payload.invitations ?? [],
  });
  await createActivityEvent({
    actorId: userId,
    projectId: project.id,
    eventType: "PROJECT_CREATED",
    metadata: { title: project.title },
  });
  for (const invitation of invitations) {
    await createNotification({
      recipientId: invitation.invitedUserId,
      type: "PROJECT_INVITATION",
      title: "Project invitation",
      body: "You were invited to a Rudo Quest project.",
      href: `/projects/${project.id}?invitation=${invitation.id}`,
    });
    await createActivityEvent({
      actorId: userId,
      projectId: project.id,
      eventType: "MEMBER_INVITED",
      metadata: { role: invitation.role },
    });
  }
  const summary = await findProjectSummary(project.id, userId);
  if (!summary) throw new AppError("INTERNAL_ERROR", 500, "Project creation failed.");
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
  const role = await findProjectRole(projectId, userId);
  assertProjectRole(role, "ADMIN");
  const updated = await updateProjectRow(projectId, values);
  if (!updated) throw new AppError("NOT_FOUND", 404, "Project not found.");
  await createActivityEvent({ actorId: userId, projectId, eventType: "PROJECT_UPDATED" });
  return updated;
}

/**
 * Purpose: Archive a project as owner only.
 * Inputs: Actor ID and project ID.
 * Output: Archived project row.
 * Side effects: Sets archived_at and writes activity.
 */
export async function archiveProject(userId: string, projectId: string) {
  const role = await findProjectRole(projectId, userId);
  assertProjectRole(role, "OWNER");
  const updated = await archiveProjectRow(projectId);
  if (!updated) throw new AppError("NOT_FOUND", 404, "Project not found.");
  await createActivityEvent({
    actorId: userId,
    projectId,
    eventType: "PROJECT_ARCHIVED",
  });
  return updated;
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
  const role = await findProjectRole(projectId, userId);
  assertProjectRole(role, "ADMIN");
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
  const role = await findProjectRole(projectId, userId);
  assertProjectRole(role, "ADMIN");
  const invitation = await insertInvitation({
    projectId,
    invitedUserId: payload.invitedUserId,
    role: payload.role,
    invitedBy: userId,
  });
  if (!invitation)
    throw new AppError("CONFLICT", 409, "User is already invited or a member.");
  await createNotification({
    recipientId: payload.invitedUserId,
    type: "PROJECT_INVITATION",
    title: "Project invitation",
    body: "You were invited to a Rudo Quest project.",
    href: `/projects/${projectId}?invitation=${invitation.id}`,
  });
  await createActivityEvent({
    actorId: userId,
    projectId,
    eventType: "MEMBER_INVITED",
    metadata: { role: payload.role },
  });
  return invitation;
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
  status: "ACCEPTED" | "DECLINED" | "REVOKED",
) {
  await expirePendingInvitations();
  const existing = await findProjectInvitation(projectId, invitationId);
  if (!existing) throw new AppError("NOT_FOUND", 404, "Invitation not found.");
  if (status === "REVOKED") {
    const role = await findProjectRole(projectId, userId);
    assertProjectRole(role, "ADMIN");
  } else if (existing.invitedUserId !== userId) {
    throw new AppError("FORBIDDEN", 403, "You cannot change this invitation.");
  }
  if (status === "ACCEPTED" && existing.expiresAt < new Date()) {
    throw new AppError("CONFLICT", 409, "Invitation has expired.");
  }
  const invitation = await transitionInvitation({
    projectId,
    invitationId,
    actorId: userId,
    status,
  });
  if (!invitation) throw new AppError("CONFLICT", 409, "Invitation cannot be changed.");
  if (status === "ACCEPTED") {
    await createActivityEvent({ actorId: userId, projectId, eventType: "MEMBER_JOINED" });
    const ownerId = await findProjectOwnerId(projectId);
    if (ownerId && ownerId !== userId) {
      await createNotification({
        recipientId: ownerId,
        type: "INVITATION_ACCEPTED",
        title: "Invitation accepted",
        body: "A collaborator joined your project.",
        href: `/projects/${projectId}`,
      });
    }
  }
  return invitation;
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
  const role = await findProjectRole(projectId, userId);
  assertProjectRole(role, "OWNER");
  if (targetUserId === userId)
    throw new AppError("BAD_REQUEST", 400, "Choose another member.");
  const transferred = await transferProjectOwnership({
    projectId,
    currentOwnerId: userId,
    targetUserId,
  });
  if (!transferred) throw new AppError("NOT_FOUND", 404, "Target member not found.");
  await createActivityEvent({ actorId: userId, projectId, eventType: "PROJECT_UPDATED" });
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
  const actorRole = await findProjectRole(projectId, userId);
  assertProjectRole(actorRole, "ADMIN");
  if (actorRole === "ADMIN" && role === "ADMIN") {
    throw new AppError("FORBIDDEN", 403, "Admins cannot promote other admins.");
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
  const actorRole = await findProjectRole(projectId, userId);
  assertProjectRole(actorRole, "ADMIN");
  const removed = await removeMember({ projectId, userId: targetUserId });
  if (!removed)
    throw new AppError("NOT_FOUND", 404, "Member not found or cannot be removed.");
  await createActivityEvent({ actorId: userId, projectId, eventType: "MEMBER_REMOVED" });
  return removed;
}
