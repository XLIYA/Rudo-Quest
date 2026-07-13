import { AppError } from "@/lib/api/errors";
import { runDbTransaction } from "@/lib/db/client";
import {
  createGitHubInstallationState,
  decryptGitHubUserToken,
  encryptGitHubUserToken,
  exchangeGitHubUserCode,
  getGitHubAuthorizationUrl,
  findInstallationRepository,
  getGitHubInstallationInfo,
  getGitHubInstallUrl,
  listInstallationRepositories,
  verifyGitHubInstallationState,
  listUserInstallationIds,
  verifyGitHubWebhookSignature,
} from "@/lib/github/app";
import { assertProjectRole } from "@/server/policies/project-policy";
import { createActivityEvent } from "@/server/repositories/activity-repository";
import {
  findProjectAccess,
  findProjectRole,
} from "@/server/repositories/project-repository";
import {
  connectProjectRepository,
  disconnectProjectRepository,
  findGitHubInstallationForUser,
  consumeGitHubInstallationState,
  findGitHubInstallationByExternalId,
  findGitHubInstallationState,
  saveGitHubInstallationUserToken,
  insertGitHubInstallationState,
  findProjectRepository,
  listGitHubInstallationsForUser,
  upsertGitHubInstallation,
} from "@/server/repositories/github-repository";

/**
 * Purpose: Start a GitHub App installation flow.
 * Inputs: Actor ID.
 * Output: Redirect URL and state.
 * Side effects: None.
 */
export async function startGitHubInstallation(userId: string, projectId?: string) {
  if (projectId) await requireActiveProjectAdmin(userId, projectId);
  const state = createGitHubInstallationState(userId, projectId);
  const parsed = verifyGitHubInstallationState(state, userId);
  await insertGitHubInstallationState({
    userId,
    nonce: parsed.nonce,
    expiresAt: new Date(parsed.exp * 1000),
  });
  return { url: getGitHubAuthorizationUrl(state), state };
}

/**
 * Purpose: Complete a GitHub App installation callback.
 * Inputs: Actor ID, numeric GitHub installation ID, and signed state.
 * Output: Stored installation row.
 * Side effects: Calls GitHub to verify installation metadata and persists ownership.
 */
export async function completeGitHubInstallation(
  userId: string,
  githubInstallationId: number,
  state: string | undefined,
  code?: string,
) {
  const parsedState = verifyGitHubInstallationState(state, userId);
  const pending = await findGitHubInstallationState(userId, parsedState.nonce);
  if (!pending || pending.expiresAt < new Date() || pending.consumedAt) {
    throw new AppError(
      "FORBIDDEN",
      403,
      "GitHub installation state is invalid or expired.",
    );
  }
  if (code) {
    const userToken = await exchangeGitHubUserCode(code);
    const saved = await saveGitHubInstallationUserToken(
      userId,
      parsedState.nonce,
      encryptGitHubUserToken(userToken),
    );
    if (!saved)
      throw new AppError(
        "CONFLICT",
        409,
        "GitHub authorization callback was already used.",
      );
    return { authorized: true, redirectToInstall: getGitHubInstallUrl(state ?? "") };
  }
  if (!pending.encryptedUserToken) {
    throw new AppError(
      "FORBIDDEN",
      403,
      "GitHub authorization is required before installation.",
    );
  }
  const userToken = decryptGitHubUserToken(pending.encryptedUserToken);
  const authorizedInstallations = await listUserInstallationIds(userToken);
  if (!authorizedInstallations.includes(githubInstallationId)) {
    throw new AppError(
      "FORBIDDEN",
      403,
      "This GitHub installation is not owned by the current user.",
    );
  }
  const installation = await getGitHubInstallationInfo(githubInstallationId);
  const existing = await findGitHubInstallationByExternalId(githubInstallationId);
  if (existing && existing.installedBy !== userId) {
    throw new AppError(
      "FORBIDDEN",
      403,
      "This GitHub installation belongs to another Rudo user.",
    );
  }
  const consumed = await consumeGitHubInstallationState(userId, parsedState.nonce);
  if (!consumed)
    throw new AppError("CONFLICT", 409, "GitHub installation callback was already used.");
  return {
    installation: await upsertGitHubInstallation({
      ...installation,
      installedBy: userId,
    }),
    projectId: parsedState.projectId,
  };
}

/**
 * Purpose: List repositories available for project connection.
 * Inputs: Actor ID, project ID, and installation ID.
 * Output: Repository metadata.
 * Side effects: Calls GitHub API when configured.
 */
export async function listGitHubRepositories(
  userId: string,
  projectId: string,
  installationId: string,
) {
  await requireActiveProjectAdmin(userId, projectId);
  const installation = await findGitHubInstallationForUser(installationId, userId);
  if (!installation)
    throw new AppError("NOT_FOUND", 404, "GitHub installation not found.");
  return listInstallationRepositories(installation.githubInstallationId);
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
  },
) {
  await requireActiveProjectAdmin(userId, projectId);
  const installation = await findGitHubInstallationForUser(
    payload.githubInstallationId,
    userId,
  );
  if (!installation)
    throw new AppError("NOT_FOUND", 404, "GitHub installation not found.");
  const repository = await findInstallationRepository(
    installation.githubInstallationId,
    payload.repositoryId,
  );
  if (!repository) {
    throw new AppError(
      "BAD_REQUEST",
      400,
      "Repository is not available to this installation.",
    );
  }
  return runDbTransaction(async (tx) => {
    const row = await connectProjectRepository(
      {
        projectId,
        githubInstallationId: installation.id,
        repositoryId: repository.id,
        repositoryFullName: repository.fullName,
        repositoryUrl: repository.htmlUrl,
        defaultBranch: repository.defaultBranch,
      },
      tx,
    );
    await createActivityEvent(
      { actorId: userId, projectId, eventType: "GITHUB_CONNECTED" },
      tx,
    );
    return row;
  });
}

/**
 * Purpose: Disconnect a GitHub repository from a project.
 * Inputs: Actor ID, project ID, repository ID.
 * Output: Deleted connection row.
 * Side effects: Deletes connection and writes activity.
 */
export async function disconnectRepository(
  userId: string,
  projectId: string,
  repositoryId: number,
) {
  await requireActiveProjectAdmin(userId, projectId);
  return runDbTransaction(async (tx) => {
    const row = await disconnectProjectRepository(projectId, repositoryId, tx);
    if (!row) throw new AppError("NOT_FOUND", 404, "Repository connection not found.");
    await createActivityEvent(
      { actorId: userId, projectId, eventType: "GITHUB_DISCONNECTED" },
      tx,
    );
    return row;
  });
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

/**
 * Purpose: List GitHub App installations for the current user.
 * Inputs: User ID.
 * Output: Installation list.
 * Side effects: Reads database.
 */
export async function listGitHubInstallations(userId: string) {
  return listGitHubInstallationsForUser(userId);
}

async function requireActiveProjectAdmin(
  userId: string,
  projectId: string,
): Promise<void> {
  const access = await findProjectAccess(projectId, userId);
  assertProjectRole(access?.role ?? null, "ADMIN");
  if (access?.archivedAt) {
    throw new AppError("CONFLICT", 409, "Archived projects are read-only.");
  }
}
