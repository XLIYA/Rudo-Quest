import { and, eq, isNull } from "drizzle-orm";
import {
  githubInstallationStates,
  githubInstallations,
  projectRepositories,
} from "@/db/schema";
import { getDb, type DbExecutor } from "@/lib/db/client";

/**
 * Purpose: Persist or update a GitHub App installation.
 * Inputs: GitHub installation account metadata and installing user.
 * Output: Installation row.
 * Side effects: Writes github_installations.
 */
export async function upsertGitHubInstallation(input: {
  githubInstallationId: number;
  githubAccountLogin: string;
  githubAccountType: string;
  installedBy: string;
}) {
  const [row] = await getDb()
    .insert(githubInstallations)
    .values(input)
    .onConflictDoUpdate({
      target: githubInstallations.githubInstallationId,
      set: {
        githubAccountLogin: input.githubAccountLogin,
        githubAccountType: input.githubAccountType,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error("GitHub installation upsert failed.");
  return row;
}

/**
 * Purpose: Find an installation by GitHub's immutable external installation ID.
 * Inputs: Numeric GitHub installation ID.
 * Output: Stored installation row or null.
 * Side effects: Reads the installation table.
 */
export async function findGitHubInstallationByExternalId(githubInstallationId: number) {
  const rows = await getDb()
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.githubInstallationId, githubInstallationId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Purpose: Persist a one-time GitHub installation state nonce.
 * Inputs: Rudo user ID, signed-state nonce, and expiry timestamp.
 * Output: Pending state row.
 * Side effects: Inserts github_installation_states.
 */
export async function insertGitHubInstallationState(input: {
  userId: string;
  nonce: string;
  expiresAt: Date;
}) {
  const [row] = await getDb().insert(githubInstallationStates).values(input).returning();
  if (!row) throw new Error("GitHub installation state insert failed.");
  return row;
}

/**
 * Purpose: Read an unexpired GitHub installation state for one user.
 * Inputs: Rudo user ID and signed-state nonce.
 * Output: State row or null.
 * Side effects: Reads github_installation_states.
 */
export async function findGitHubInstallationState(userId: string, nonce: string) {
  const rows = await getDb()
    .select()
    .from(githubInstallationStates)
    .where(
      and(
        eq(githubInstallationStates.userId, userId),
        eq(githubInstallationStates.nonce, nonce),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Purpose: Store the encrypted GitHub user token for the second installation-flow leg.
 * Inputs: Rudo user ID, nonce, and server-encrypted token.
 * Output: Updated state row or null.
 * Side effects: Writes a short-lived encrypted token.
 */
export async function saveGitHubInstallationUserToken(
  userId: string,
  nonce: string,
  encryptedUserToken: string,
) {
  const [row] = await getDb()
    .update(githubInstallationStates)
    .set({ encryptedUserToken })
    .where(
      and(
        eq(githubInstallationStates.userId, userId),
        eq(githubInstallationStates.nonce, nonce),
        isNull(githubInstallationStates.consumedAt),
        isNull(githubInstallationStates.encryptedUserToken),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Purpose: Atomically consume a GitHub installation state to prevent callback replay.
 * Inputs: Rudo user ID and nonce.
 * Output: Consumed state row or null when already consumed/expired.
 * Side effects: Sets consumed_at and removes the encrypted token.
 */
export async function consumeGitHubInstallationState(userId: string, nonce: string) {
  const [row] = await getDb()
    .update(githubInstallationStates)
    .set({ consumedAt: new Date(), encryptedUserToken: null })
    .where(
      and(
        eq(githubInstallationStates.userId, userId),
        eq(githubInstallationStates.nonce, nonce),
        isNull(githubInstallationStates.consumedAt),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Purpose: Find an installation row owned by a user.
 * Inputs: Installation row ID and user ID.
 * Output: Installation row or null.
 * Side effects: Reads github_installations.
 */
export async function findGitHubInstallationForUser(id: string, userId: string) {
  const rows = await getDb()
    .select()
    .from(githubInstallations)
    .where(
      and(eq(githubInstallations.id, id), eq(githubInstallations.installedBy, userId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Purpose: Link one GitHub repository to one project.
 * Inputs: Project ID, installation row ID, repository metadata.
 * Output: Project repository row.
 * Side effects: Writes project_repositories.
 */
export async function connectProjectRepository(
  input: {
    projectId: string;
    githubInstallationId: string;
    repositoryId: number;
    repositoryFullName: string;
    repositoryUrl: string;
    defaultBranch?: string | null;
  },
  db: DbExecutor = getDb(),
) {
  const [row] = await db
    .insert(projectRepositories)
    .values(input)
    .onConflictDoUpdate({
      target: projectRepositories.projectId,
      set: {
        githubInstallationId: input.githubInstallationId,
        repositoryId: input.repositoryId,
        repositoryFullName: input.repositoryFullName,
        repositoryUrl: input.repositoryUrl,
        defaultBranch: input.defaultBranch ?? null,
      },
    })
    .returning();
  return row;
}

/**
 * Purpose: Get the repository linked to a project.
 * Inputs: Project ID.
 * Output: Repository row or null.
 * Side effects: Reads project_repositories.
 */
export async function findProjectRepository(projectId: string) {
  const rows = await getDb()
    .select()
    .from(projectRepositories)
    .where(eq(projectRepositories.projectId, projectId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Purpose: Disconnect a repository from a project.
 * Inputs: Project ID and repository ID.
 * Output: Deleted row or null.
 * Side effects: Deletes project_repositories.
 */
export async function disconnectProjectRepository(
  projectId: string,
  repositoryId: number,
  db: DbExecutor = getDb(),
) {
  const [row] = await db
    .delete(projectRepositories)
    .where(
      and(
        eq(projectRepositories.projectId, projectId),
        eq(projectRepositories.repositoryId, repositoryId),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Purpose: List GitHub installations for a user.
 * Inputs: User ID.
 * Output: Installation rows.
 * Side effects: Reads github_installations.
 */
export async function listGitHubInstallationsForUser(userId: string) {
  const rows = await getDb()
    .select({
      id: githubInstallations.id,
      githubInstallationId: githubInstallations.githubInstallationId,
      githubAccountLogin: githubInstallations.githubAccountLogin,
      githubAccountType: githubInstallations.githubAccountType,
    })
    .from(githubInstallations)
    .where(eq(githubInstallations.installedBy, userId))
    .orderBy(githubInstallations.createdAt);
  return rows;
}
