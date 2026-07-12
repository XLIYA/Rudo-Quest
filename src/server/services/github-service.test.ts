import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeGitHubInstallation,
  connectRepository,
  listGitHubRepositories,
} from "./github-service";

const githubApp = vi.hoisted(() => ({
  createGitHubInstallationState: vi.fn(),
  decryptGitHubUserToken: vi.fn(),
  encryptGitHubUserToken: vi.fn(),
  exchangeGitHubUserCode: vi.fn(),
  findInstallationRepository: vi.fn(),
  getGitHubInstallationInfo: vi.fn(),
  getGitHubInstallUrl: vi.fn(),
  getGitHubAuthorizationUrl: vi.fn(),
  listInstallationRepositories: vi.fn(),
  listUserInstallationIds: vi.fn(),
  verifyGitHubInstallationState: vi.fn(),
  verifyGitHubWebhookSignature: vi.fn(),
}));

const projectRepository = vi.hoisted(() => ({
  findProjectRole: vi.fn(),
}));

const githubRepository = vi.hoisted(() => ({
  connectProjectRepository: vi.fn(),
  disconnectProjectRepository: vi.fn(),
  findGitHubInstallationForUser: vi.fn(),
  findGitHubInstallationState: vi.fn(),
  consumeGitHubInstallationState: vi.fn(),
  findGitHubInstallationByExternalId: vi.fn(),
  saveGitHubInstallationUserToken: vi.fn(),
  insertGitHubInstallationState: vi.fn(),
  findProjectRepository: vi.fn(),
  upsertGitHubInstallation: vi.fn(),
}));

const activityRepository = vi.hoisted(() => ({
  createActivityEvent: vi.fn(),
}));

vi.mock("@/lib/github/app", () => githubApp);
vi.mock("@/server/repositories/project-repository", () => projectRepository);
vi.mock("@/server/repositories/github-repository", () => githubRepository);
vi.mock("@/server/repositories/activity-repository", () => activityRepository);

const userId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000009";
const projectId = "00000000-0000-4000-8000-000000000002";
const installationRowId = "00000000-0000-4000-8000-000000000003";

beforeEach(() => {
  vi.clearAllMocks();
  projectRepository.findProjectRole.mockResolvedValue("ADMIN");
});

describe("GitHub installation ownership", () => {
  it("rejects a callback replay after the nonce was consumed", async () => {
    const state = "signed-state";
    githubApp.verifyGitHubInstallationState.mockReturnValue({
      userId,
      nonce: "nonce",
      v: 1,
      exp: 4_000_000_000,
    });
    githubRepository.findGitHubInstallationState.mockResolvedValue({
      userId,
      nonce: "nonce",
      encryptedUserToken: "encrypted",
      consumedAt: null,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    githubApp.decryptGitHubUserToken.mockReturnValue("user-token");
    githubApp.listUserInstallationIds.mockResolvedValue([123]);
    githubApp.getGitHubInstallationInfo.mockResolvedValue({
      githubInstallationId: 123,
      githubAccountLogin: "acme",
      githubAccountType: "Organization",
    });
    githubRepository.findGitHubInstallationByExternalId.mockResolvedValue(null);
    githubRepository.consumeGitHubInstallationState.mockResolvedValue(null);

    await expect(completeGitHubInstallation(userId, 123, state)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(githubRepository.upsertGitHubInstallation).not.toHaveBeenCalled();
  });

  it("rejects an installation already owned by another Rudo user", async () => {
    githubApp.verifyGitHubInstallationState.mockReturnValue({
      userId,
      nonce: "nonce",
      v: 1,
      exp: 4_000_000_000,
    });
    githubRepository.findGitHubInstallationState.mockResolvedValue({
      encryptedUserToken: "encrypted",
      consumedAt: null,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    githubApp.decryptGitHubUserToken.mockReturnValue("user-token");
    githubApp.listUserInstallationIds.mockResolvedValue([123]);
    githubApp.getGitHubInstallationInfo.mockResolvedValue({
      githubInstallationId: 123,
      githubAccountLogin: "acme",
      githubAccountType: "Organization",
    });
    githubRepository.findGitHubInstallationByExternalId.mockResolvedValue({
      installedBy: otherUserId,
    });

    await expect(
      completeGitHubInstallation(userId, 123, "signed-state"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(githubRepository.consumeGitHubInstallationState).not.toHaveBeenCalled();
  });

  it("rejects repository listing for installations not owned by the actor", async () => {
    githubRepository.findGitHubInstallationForUser.mockResolvedValue(null);

    await expect(
      listGitHubRepositories(userId, projectId, installationRowId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(githubApp.listInstallationRepositories).not.toHaveBeenCalled();
  });

  it("uses GitHub-verified repository metadata when connecting a repository", async () => {
    githubRepository.findGitHubInstallationForUser.mockResolvedValue({
      id: installationRowId,
      githubInstallationId: 123,
      installedBy: userId,
    });
    githubApp.findInstallationRepository.mockResolvedValue({
      id: 987,
      fullName: "acme/private-repo",
      htmlUrl: "https://github.com/acme/private-repo",
      defaultBranch: "main",
    });
    githubRepository.connectProjectRepository.mockResolvedValue({ id: "connection" });

    await expect(
      connectRepository(userId, projectId, {
        githubInstallationId: installationRowId,
        repositoryId: 987,
      }),
    ).resolves.toEqual({ id: "connection" });

    expect(githubRepository.connectProjectRepository).toHaveBeenCalledWith({
      projectId,
      githubInstallationId: installationRowId,
      repositoryId: 987,
      repositoryFullName: "acme/private-repo",
      repositoryUrl: "https://github.com/acme/private-repo",
      defaultBranch: "main",
    });
  });
});
