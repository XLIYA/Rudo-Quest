import { ProjectSettingsScreen } from "@/features/projects/project-settings-screen";
import { getServerEnv, hasGitHubEnv } from "@/lib/env/server";

/**
 * Purpose: Render project settings route.
 * Inputs: Dynamic project ID consumed by client screen.
 * Output: Project settings feature screen.
 * Side effects: None.
 */
export default function ProjectSettingsPage() {
  return <ProjectSettingsScreen githubConfigured={hasGitHubEnv(getServerEnv())} />;
}
