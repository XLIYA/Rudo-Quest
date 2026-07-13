import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeInvitationStatus,
  changeMemberRole,
  createProject,
  inviteProjectMember,
} from "./project-service";

const projectRepository = vi.hoisted(() => ({
  archiveProjectRow: vi.fn(),
  findProjectAccess: vi.fn(),
  findProjectInvitation: vi.fn(),
  findProjectRole: vi.fn(),
  findProjectSummary: vi.fn(),
  expirePendingInvitations: vi.fn(),
  findProjectOwnerId: vi.fn(),
  isProjectArchived: vi.fn(),
  insertInvitation: vi.fn(),
  insertProjectWithInvitations: vi.fn(),
  listProjectInvitations: vi.fn(),
  listProjectMembers: vi.fn(),
  listProjectSummaries: vi.fn(),
  removeMember: vi.fn(),
  transitionInvitation: vi.fn(),
  transferProjectOwnership: vi.fn(),
  updateMemberRole: vi.fn(),
  updateProjectRow: vi.fn(),
}));

const activityRepository = vi.hoisted(() => ({
  createActivityEvent: vi.fn(),
}));

const notificationService = vi.hoisted(() => ({
  createNotification: vi.fn(),
  deliverPushBestEffort: vi.fn(),
}));

const transaction = vi.hoisted(() => ({
  executor: {},
  runDbTransaction: vi.fn(async (operation: (tx: object) => Promise<unknown>) =>
    operation(transaction.executor),
  ),
}));

vi.mock("@/server/repositories/project-repository", () => projectRepository);
vi.mock("@/server/repositories/activity-repository", () => activityRepository);
vi.mock("@/server/services/notification-service", () => notificationService);
vi.mock("@/lib/db/client", () => ({
  runDbTransaction: transaction.runDbTransaction,
}));

const invitedUserId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000003";
const invitationId = "00000000-0000-4000-8000-000000000004";

function pendingInvitation() {
  return {
    id: invitationId,
    projectId,
    invitedUserId,
    role: "MEMBER",
    status: "PENDING",
    invitedBy: otherUserId,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    acceptedAt: null,
    createdAt: new Date("2026-07-10T00:00:00.000Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  projectRepository.expirePendingInvitations.mockResolvedValue(0);
  projectRepository.findProjectInvitation.mockResolvedValue(pendingInvitation());
  projectRepository.transitionInvitation.mockResolvedValue({
    invitation: pendingInvitation(),
    pushNotification: null,
    pushRecipientId: null,
  });
  projectRepository.isProjectArchived.mockResolvedValue(false);
});

describe("changeInvitationStatus authorization", () => {
  it("rejects decline attempts from users who were not invited", async () => {
    await expect(
      changeInvitationStatus(otherUserId, projectId, invitationId, "DECLINED"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(projectRepository.transitionInvitation).not.toHaveBeenCalled();
  });

  it("allows the invited user to decline their own invitation", async () => {
    await expect(
      changeInvitationStatus(invitedUserId, projectId, invitationId, "DECLINED"),
    ).resolves.toMatchObject({ id: invitationId });

    expect(projectRepository.transitionInvitation).toHaveBeenCalledWith({
      projectId,
      invitationId,
      actorId: invitedUserId,
      status: "DECLINED",
    });
  });

  it("keeps revocation limited to project admins and owners", async () => {
    projectRepository.findProjectAccess.mockResolvedValue({
      role: "MEMBER",
      archivedAt: null,
    });

    await expect(
      changeInvitationStatus(otherUserId, projectId, invitationId, "REVOKED"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(projectRepository.transitionInvitation).not.toHaveBeenCalled();
  });
});

describe("project administration rules", () => {
  beforeEach(() => {
    projectRepository.findProjectAccess.mockResolvedValue({
      role: "ADMIN",
      archivedAt: null,
    });
  });

  it("prevents an admin from promoting another member to admin", async () => {
    projectRepository.findProjectRole.mockResolvedValue("MEMBER");

    await expect(
      changeMemberRole(otherUserId, projectId, invitedUserId, "ADMIN"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(projectRepository.updateMemberRole).not.toHaveBeenCalled();
  });

  it("prevents an admin from demoting another admin", async () => {
    projectRepository.findProjectRole.mockResolvedValue("ADMIN");

    await expect(
      changeMemberRole(otherUserId, projectId, invitedUserId, "MEMBER"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(projectRepository.updateMemberRole).not.toHaveBeenCalled();
  });

  it("allows the owner to change a non-owner member role", async () => {
    projectRepository.findProjectAccess.mockResolvedValue({
      role: "OWNER",
      archivedAt: null,
    });
    projectRepository.findProjectRole.mockResolvedValue("ADMIN");
    projectRepository.updateMemberRole.mockResolvedValue({ role: "MEMBER" });

    await expect(
      changeMemberRole(otherUserId, projectId, invitedUserId, "MEMBER"),
    ).resolves.toEqual({ role: "MEMBER" });
  });
});

describe("immediate project notification delivery", () => {
  const notification = {
    id: "00000000-0000-4000-8000-000000000020",
    type: "PROJECT_INVITATION",
    title: "Project invitation",
    body: "You were invited to a Rudo Quest project.",
    href: `/projects/${projectId}?invitation=${invitationId}`,
    readAt: null,
    createdAt: "2026-07-10T00:00:00.000Z",
  } as const;

  it("delivers the durable invitation notification after project creation", async () => {
    const summary = { id: projectId };
    projectRepository.insertProjectWithInvitations.mockResolvedValue({
      summary,
      pushNotifications: [{ notification, recipientId: invitedUserId }],
    });

    await expect(
      createProject(otherUserId, {
        title: "Rudo launch",
        description: null,
        iconKey: "Compass",
        colorKey: "orange",
        timeZone: "UTC",
        invitations: [{ userId: invitedUserId, role: "MEMBER" }],
      }),
    ).resolves.toEqual(summary);

    expect(notificationService.deliverPushBestEffort).toHaveBeenCalledWith(
      notification,
      invitedUserId,
    );
  });

  it("delivers a directly-created invitation notification after commit", async () => {
    projectRepository.findProjectAccess.mockResolvedValue({
      role: "ADMIN",
      archivedAt: null,
    });
    projectRepository.insertInvitation.mockResolvedValue(pendingInvitation());
    notificationService.createNotification.mockResolvedValue(notification);

    await inviteProjectMember(otherUserId, projectId, {
      invitedUserId,
      role: "MEMBER",
    });

    expect(notificationService.deliverPushBestEffort).toHaveBeenCalledWith(
      notification,
      invitedUserId,
    );
  });
});
