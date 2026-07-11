export const queryKeys = {
  me: ["me"] as const,
  projects: ["projects"] as const,
  project: (projectId: string) => ["project", projectId] as const,
  projectMembers: (projectId: string) => ["project-members", projectId] as const,
  projectInvitations: (projectId: string) => ["project-invitations", projectId] as const,
  projectGithubRepo: (projectId: string) => ["project-github-repo", projectId] as const,
  tasksWeek: (weekStart: string) => ["tasks-week", weekStart] as const,
  task: (taskId: string) => ["task", taskId] as const,
  dashboard: (from: string, to: string) => ["dashboard", from, to] as const,
  notifications: ["notifications"] as const,
  activity: (cursor?: string) => ["activity", cursor ?? "first"] as const,
};
