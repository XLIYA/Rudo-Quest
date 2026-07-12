import { beforeEach, describe, expect, it, vi } from "vitest";
import { changeInvitationStatus } from "./project-service";

const projectRepository = vi.hoisted(() => ({
  archiveProjectRow: vi.fn(),
  findProjectInvitation: vi.fn(),
  findProjectRole: vi.fn(),
  findProjectSummary: vi.fn(),
  expirePendingInvitations: vi.fn(),
  findProjectOwnerId: vi.fn(),
  insertInvitation: vi.fn(),
  listProjectInvitations: vi.fn(),
  listProjectMembers: vi.fn(),
  listProjectSummaries: vi.fn(),
  removeMember: vi.fn(),
  transitionInvitation: vi.fn(),
  updateMemberRole: vi.fn(),
  updateProjectRow: vi.fn(),
}));

const activityRepository = vi.hoisted(() => ({
  createActivityEvent: vi.fn(),
}));

const notificationService = vi.hoisted(() => ({
  createNotification: vi.fn(),
}));

vi.mock("@/server/repositories/project-repository", () => projectRepository);
vi.mock("@/server/repositories/activity-repository", () => activityRepository);
vi.mock("@/server/services/notification-service", () => notificationService);

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
  projectRepository.transitionInvitation.mockResolvedValue(pendingInvitation());
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
    projectRepository.findProjectRole.mockResolvedValue("MEMBER");

    await expect(
      changeInvitationStatus(otherUserId, projectId, invitationId, "REVOKED"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(projectRepository.transitionInvitation).not.toHaveBeenCalled();
  });
});
