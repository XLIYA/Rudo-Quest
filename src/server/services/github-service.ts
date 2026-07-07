import { AppError } from "@/lib/api/errors";
import { getGitHubInstallUrl, listInstallationRepositories, verifyGitHubWebhookSignature } from "@/lib/github/app";
import { assertProjectRole } from "@/server/policies/project-policy";
import { createActivityEvent } from "@/server/repositories/activity-repository";
import { findProjectRole } from "@/server/repositories/project-repository";
import {
  connectProjectRepository,
  disconnectProjectRepository,
  findProjectRepository,
} from "@/server/repositories/github-repository";

/**
 * Purpose: Start a GitHub App installation flow.
 * Inputs: Actor ID.
 * Output: Redirect URL and state.
 * Side effects: None.
 */
export async function startGitHubInstallation(userId: string) {
  const state = Buffer.from(JSON.stringify({ userId, nonce: crypto.randomUUID() })).toString("base64url");
  return { url: getGitHubInstallUrl(state), state };
}

/**
 * Purpose: List repositories available for project connection.
 * Inputs: Actor ID, project ID, and installation ID.
 * Output: Repository metadata.
 * Side effects: Calls GitHub API when configured.
 */
export async function listGitHubRepositories(userId: string, projectId: string, installationId: string) {
  const role = await findProjectRole(projectId, userId);
  assertProjectRole(role, "ADMIN");
  return listInstallationRepositories(installationId);
}

/**
 * Purpose: Connect one GitHub repository to one project.
 * Inputs: Actor ID, project ID, installation row ID, and repository metadata.
 * Output: Connection row.
 * Side effects: Writes repository connection and activity.
 */
export async function connectRepository(
  userId: string,
  projectId: string,
  payload: {
    githubInstallationId: string;
    repositoryId: number;
    repositoryFullName: string;
    repositoryUrl: string;
    defaultBranch?: string | null;
  },
) {
  const role = await findProjectRole(projectId, userId);
  assertProjectRole(role, "ADMIN");
  const row = await connectProjectRepository({ projectId, ...payload });
  await createActivityEvent({ actorId: userId, projectId, eventType: "GITHUB_CONNECTED" });
  return row;
}

/**
 * Purpose: Disconnect a GitHub repository from a project.
 * Inputs: Actor ID, project ID, repository ID.
 * Output: Deleted connection row.
 * Side effects: Deletes connection and writes activity.
 */
export async function disconnectRepository(userId: string, projectId: string, repositoryId: number) {
  const role = await findProjectRole(projectId, userId);
  assertProjectRole(role, "ADMIN");
  const row = await disconnectProjectRepository(projectId, repositoryId);
  if (!row) throw new AppError("NOT_FOUND", 404, "Repository connection not found.");
  await createActivityEvent({ actorId: userId, projectId, eventType: "GITHUB_DISCONNECTED" });
  return row;
}

/**
 * Purpose: Read a project's GitHub repository connection.
 * Inputs: Actor ID and project ID.
 * Output: Connection row or null.
 * Side effects: Reads repository metadata.
 */
export async function getProjectRepository(userId: string, projectId: string) {
  const role = await findProjectRole(projectId, userId);
  assertProjectRole(role, "VIEWER");
  return findProjectRepository(projectId);
}

/**
 * Purpose: Validate and accept a GitHub webhook request.
 * Inputs: Raw body and GitHub signature.
 * Output: Accepted flag.
 * Side effects: None in V1 because repository metadata only is supported.
 */
export async function handleGitHubWebhook(body: string, signature: string | null) {
  if (!verifyGitHubWebhookSignature(body, signature)) {
    throw new AppError("FORBIDDEN", 403, "Invalid GitHub webhook signature.");
  }
  return { accepted: true };
}
