import { and, eq } from "drizzle-orm";
import { githubInstallations, projectRepositories } from "@/db/schema";
import { getDb } from "@/lib/db/client";

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
        installedBy: input.installedBy,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
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
    .where(and(eq(githubInstallations.id, id), eq(githubInstallations.installedBy, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Purpose: Link one GitHub repository to one project.
 * Inputs: Project ID, installation row ID, repository metadata.
 * Output: Project repository row.
 * Side effects: Writes project_repositories.
 */
export async function connectProjectRepository(input: {
  projectId: string;
  githubInstallationId: string;
  repositoryId: number;
  repositoryFullName: string;
  repositoryUrl: string;
  defaultBranch?: string | null;
}) {
  const [row] = await getDb()
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
export async function disconnectProjectRepository(projectId: string, repositoryId: number) {
  const [row] = await getDb()
    .delete(projectRepositories)
    .where(and(eq(projectRepositories.projectId, projectId), eq(projectRepositories.repositoryId, repositoryId)))
    .returning();
  return row ?? null;
}
