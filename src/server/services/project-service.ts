import { AppError } from "@/lib/api/errors";
import type { ProjectRole } from "@/types/domain";
import { assertProjectRole } from "@/server/policies/project-policy";
import { createActivityEvent } from "@/server/repositories/activity-repository";
import {
  archiveProjectRow,
  findProjectRole,
  findProjectSummary,
  insertInvitation,
  insertProject,
  listProjectInvitations,
  listProjectMembers,
  listProjectSummaries,
  removeMember,
  transitionInvitation,
  updateMemberRole,
  updateProjectRow,
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
  payload: Parameters<typeof insertProject>[0] & {
    invitations?: { userId: string; role: Exclude<ProjectRole, "OWNER"> }[];
  },
) {
  const project = await insertProject({ ...payload, ownerId: userId });
  await createActivityEvent({
    actorId: userId,
    projectId: project.id,
    eventType: "PROJECT_CREATED",
    metadata: { title: project.title },
  });
  for (const invitation of payload.invitations ?? []) {
    await inviteProjectMember(userId, project.id, {
      invitedUserId: invitation.userId,
      role: invitation.role,
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
export async function updateProject(userId: string, projectId: string, values: Parameters<typeof updateProjectRow>[1]) {
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
  await createActivityEvent({ actorId: userId, projectId, eventType: "PROJECT_ARCHIVED" });
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
  const role = await findProjectRole(projectId, userId);
  assertProjectRole(role, "ADMIN");
  const invitation = await insertInvitation({
    projectId,
    invitedUserId: payload.invitedUserId,
    role: payload.role,
    invitedBy: userId,
  });
  if (!invitation) throw new AppError("CONFLICT", 409, "User is already invited or a member.");
  await createNotification({
    recipientId: payload.invitedUserId,
    type: "PROJECT_INVITATION",
    title: "Project invitation",
    body: "You were invited to a Rudo Quest project.",
    href: `/projects/${projectId}`,
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
  if (status === "REVOKED") {
    const role = await findProjectRole(projectId, userId);
    assertProjectRole(role, "ADMIN");
  }
  const invitation = await transitionInvitation({ projectId, invitationId, actorId: userId, status });
  if (!invitation) throw new AppError("CONFLICT", 409, "Invitation cannot be changed.");
  if (status === "ACCEPTED") {
    await createActivityEvent({ actorId: userId, projectId, eventType: "MEMBER_JOINED" });
  }
  return invitation;
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
export async function removeProjectMember(userId: string, projectId: string, targetUserId: string) {
  const actorRole = await findProjectRole(projectId, userId);
  assertProjectRole(actorRole, "ADMIN");
  const removed = await removeMember({ projectId, userId: targetUserId });
  if (!removed) throw new AppError("NOT_FOUND", 404, "Member not found or cannot be removed.");
  await createActivityEvent({ actorId: userId, projectId, eventType: "MEMBER_REMOVED" });
  return removed;
}
