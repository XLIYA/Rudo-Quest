import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectRepository, listGitHubRepositories } from "./github-service";

const githubApp = vi.hoisted(() => ({
  createGitHubInstallationState: vi.fn(),
  findInstallationRepository: vi.fn(),
  getGitHubInstallationInfo: vi.fn(),
  getGitHubInstallUrl: vi.fn(),
  listInstallationRepositories: vi.fn(),
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
const projectId = "00000000-0000-4000-8000-000000000002";
const installationRowId = "00000000-0000-4000-8000-000000000003";

beforeEach(() => {
  vi.clearAllMocks();
  projectRepository.findProjectRole.mockResolvedValue("ADMIN");
});

describe("GitHub installation ownership", () => {
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
