export const taskStatuses = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

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
  "red",
  "rose",
  "violet",
  "blue",
  "cyan",
  "green",
  "yellow",
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
] as const;
export type ProjectIconKey = (typeof projectIconKeys)[number];

export type ThemePreference = "system" | "light" | "dark";

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

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type ProfileSummary = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ProjectSummary = {
  id: string;
  title: string;
  description: string | null;
  iconKey: ProjectIconKey;
  colorKey: ProjectColorKey;
  role: ProjectRole;
  openTaskCount: number;
  weeklyCompletionPercent: number;
  githubRepositoryFullName: string | null;
  members: ProfileSummary[];
  archivedAt: string | null;
};

export type TaskDto = {
  id: string;
  projectId: string | null;
  createdBy: ProfileSummary;
  assignee: ProfileSummary | null;
  title: string;
  description: string | null;
  iconKey: ProjectIconKey | null;
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
  project:
    | {
        id: string;
        title: string;
        colorKey: ProjectColorKey;
        iconKey: ProjectIconKey;
      }
    | null;
};

export type ActivityEventDto = {
  id: string;
  actor: ProfileSummary | null;
  projectId: string | null;
  taskId: string | null;
  eventType: ActivityEventType;
  label: string;
  createdAt: string;
};

export type NotificationDto = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};
