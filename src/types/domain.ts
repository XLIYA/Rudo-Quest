export const taskStatuses = ["TODO", "IN_PROGRESS", "PENDING_REVIEW", "DONE"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const taskTypes = ["TASK", "STORY", "FEATURE", "BUG", "TEST"] as const;
export type TaskType = (typeof taskTypes)[number];

export const taskPriorities = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof taskPriorities)[number];

export const taskAttachmentKinds = ["FILE", "LINK"] as const;
export type TaskAttachmentKind = (typeof taskAttachmentKinds)[number];

export const projectRoles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type ProjectRole = (typeof projectRoles)[number];

export const invitationStatuses = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "REVOKED",
  "EXPIRED",
] as const;
export type InvitationStatus = (typeof invitationStatuses)[number];

export const activityEventTypes = [
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_ARCHIVED",
  "MEMBER_INVITED",
  "MEMBER_JOINED",
  "MEMBER_REMOVED",
  "TASK_CREATED",
  "TASK_UPDATED",
  "TASK_ASSIGNED",
  "TASK_STARTED",
  "TASK_COMPLETED",
  "TASK_REOPENED",
  "TASK_ARCHIVED",
  "TASK_RESTORED",
  "GITHUB_CONNECTED",
  "GITHUB_DISCONNECTED",
] as const;
export type ActivityEventType = (typeof activityEventTypes)[number];

export const notificationTypes = [
  "PROJECT_INVITATION",
  "INVITATION_ACCEPTED",
  "TASK_ASSIGNED",
  "TASK_DUE_TODAY",
  "DAILY_DIGEST",
] as const;
export type NotificationType = (typeof notificationTypes)[number];

export const projectColorKeys = [
  "orange",
  "coral",
  "red",
  "ruby",
  "rose",
  "pink",
  "magenta",
  "plum",
  "violet",
  "indigo",
  "blue",
  "sky",
  "cyan",
  "teal",
  "emerald",
  "green",
  "lime",
  "yellow",
  "amber",
  "terracotta",
  "brown",
  "sand",
  "slate",
  "gray",
] as const;
export type ProjectColorKey = (typeof projectColorKeys)[number];

export const projectIconKeys = [
  "Compass",
  "CheckCircle2",
  "Rocket",
  "BookOpen",
  "Code2",
  "Palette",
  "BriefcaseBusiness",
  "Megaphone",
  "Wrench",
  "FlaskConical",
  "HeartHandshake",
  "Map",
  "Target",
  "CalendarCheck",
  "FileText",
  "Bug",
  "ShieldCheck",
  "Lightbulb",
  "Hammer",
  "Users",
  "GraduationCap",
  "BarChart3",
  "Database",
  "PackageCheck",
] as const;
export type ProjectIconKey = (typeof projectIconKeys)[number];

export type ThemePreference = "system" | "light" | "dark";

export const bannerPresetKeys = ["sunrise", "trail", "night"] as const;
export type BannerPresetKey = (typeof bannerPresetKeys)[number];

export type ApiSuccess<T> = {
  data: T;
  meta?: {
    cursor?: string;
    total?: number;
  };
};

export type ApiFailure = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
  requestId: string;
};

export type ProfileSummary = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ProfileDto = {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
  bannerPath: string | null;
  bannerPresetKey: BannerPresetKey | null;
  themePreference: ThemePreference;
  timeZone: string;
  notificationsEnabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string | null;
  quietHoursStart: string;
  quietHoursEnd: string;
};

export type ProjectSummary = {
  id: string;
  title: string;
  description: string | null;
  iconKey: ProjectIconKey;
  colorKey: ProjectColorKey;
  timeZone: string;
  role: ProjectRole;
  openTaskCount: number;
  completedThisWeek: number;
  weeklyCompletionPercent: number;
  githubRepositoryFullName: string | null;
  members: ProfileSummary[];
  archivedAt: string | null;
  createdAt: string;
};

export type TaskDto = {
  id: string;
  projectId: string | null;
  createdBy: ProfileSummary;
  assignee: ProfileSummary | null;
  title: string;
  description: string | null;
  iconKey: ProjectIconKey | null;
  taskType: TaskType;
  priority: TaskPriority;
  parentTaskId: string | null;
  subtaskTotal: number;
  subtaskCompleted: number;
  subtaskProgressPercent: number;
  status: TaskStatus;
  previousStatus: Exclude<TaskStatus, "DONE"> | null;
  scheduledDate: string;
  scheduledTime: string | null;
  scheduledTimeZone: string;
  completedAt: string | null;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  permissions: {
    canEditDetails: boolean;
    canCreateSubtasks: boolean;
    canTransition: boolean;
    canArchive: boolean;
  };
  project: {
    id: string;
    title: string;
    colorKey: ProjectColorKey;
    iconKey: ProjectIconKey;
  } | null;
};

export type TaskAttachmentDto = {
  id: string;
  taskId: string;
  kind: TaskAttachmentKind;
  label: string;
  url: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  downloadUrl: string | null;
  createdBy: ProfileSummary;
  createdAt: string;
};

export type ActivityEventDto = {
  id: string;
  actor: ProfileSummary | null;
  projectId: string | null;
  taskId: string | null;
  task: {
    id: string;
    title: string;
    scheduledDate: string;
    archivedAt: string | null;
  } | null;
  eventType: ActivityEventType;
  label: string;
  createdAt: string;
};

export type ActivityPageDto = {
  items: ActivityEventDto[];
  cursor?: string;
};

export const taskHistoryViews = ["missed", "archived"] as const;
export type TaskHistoryView = (typeof taskHistoryViews)[number];

export type TaskHistoryPageDto = {
  items: TaskDto[];
  cursor?: string;
};

export interface ArchivedTaskFilters {
  priority?: string;
  assigneeId?: string;
  completedFrom?: string;
  completedTo?: string;
  archivedFrom?: string;
  archivedTo?: string;
  status?: string;
}

export type NotificationDto = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPageDto = {
  items: NotificationDto[];
  unreadCount: number;
  cursor?: string;
};

export type TaskActivityDto = {
  id: string;
  actor: ProfileSummary | null;
  eventType: ActivityEventType;
  label: string;
  createdAt: string;
};

export type GitHubRepository = {
  id: string;
  githubInstallationId: string;
  repositoryId: number;
  repositoryFullName: string;
  repositoryUrl: string;
  defaultBranch: string | null;
};
