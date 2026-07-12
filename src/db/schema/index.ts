import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull().unique(),
    handle: text("handle").notNull().unique(),
    displayName: text("display_name").notNull(),
    avatarPath: text("avatar_path"),
    bannerPath: text("banner_path"),
    bannerPresetKey: text("banner_preset_key"),
    themePreference: text("theme_preference").notNull().default("system"),
    timeZone: text("time_zone").notNull(),
    notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
    dailyReminderEnabled: boolean("daily_reminder_enabled").notNull().default(true),
    dailyReminderTime: time("daily_reminder_time"),
    quietHoursStart: time("quiet_hours_start").notNull().default("22:00:00"),
    quietHoursEnd: time("quiet_hours_end").notNull().default("07:00:00"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("profiles_handle_idx").on(table.handle),
    index("profiles_lower_email_idx").on(sql`lower(${table.email})`),
  ],
);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id),
  title: text("title").notNull(),
  description: text("description"),
  iconKey: text("icon_key").notNull(),
  colorKey: text("color_key").notNull(),
  timeZone: text("time_zone").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectMemberships = pgTable(
  "project_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    role: text("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_memberships_project_user_uidx").on(
      table.projectId,
      table.userId,
    ),
    index("project_memberships_project_user_idx").on(table.projectId, table.userId),
  ],
);

export const projectInvitations = pgTable(
  "project_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    invitedUserId: uuid("invited_user_id")
      .notNull()
      .references(() => profiles.id),
    role: text("role").notNull(),
    status: text("status").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => profiles.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("project_invitations_project_user_status_idx").on(
      table.projectId,
      table.invitedUserId,
      table.status,
    ),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    assigneeId: uuid("assignee_id").references(() => profiles.id),
    title: text("title").notNull(),
    description: text("description"),
    iconKey: text("icon_key"),
    status: text("status").notNull(),
    previousStatus: text("previous_status"),
    scheduledDate: date("scheduled_date").notNull(),
    scheduledTime: time("scheduled_time"),
    scheduledTimeZone: text("scheduled_time_zone").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tasks_assignee_date_status_idx").on(
      table.assigneeId,
      table.scheduledDate,
      table.status,
    ),
    index("tasks_project_date_status_idx").on(
      table.projectId,
      table.scheduledDate,
      table.status,
    ),
    index("tasks_created_by_date_idx").on(table.createdBy, table.scheduledDate),
    index("tasks_archived_at_idx").on(table.archivedAt),
  ],
);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => profiles.id),
    projectId: uuid("project_id").references(() => projects.id),
    taskId: uuid("task_id").references(() => tasks.id),
    eventType: text("event_type").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("activity_events_actor_created_idx").on(table.actorId, table.createdAt),
    index("activity_events_project_created_idx").on(table.projectId, table.createdAt),
    index("activity_events_task_created_idx").on(table.taskId, table.createdAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => profiles.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    dedupeKey: text("dedupe_key").unique(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_recipient_read_created_idx").on(
      table.recipientId,
      table.readAt,
      table.createdAt,
    ),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  },
  (table) => [index("push_subscriptions_user_idx").on(table.userId)],
);

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  notificationId: uuid("notification_id")
    .notNull()
    .references(() => notifications.id),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => pushSubscriptions.id),
  status: text("status").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const githubInstallationStates = pgTable(
  "github_installation_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    nonce: text("nonce").notNull().unique(),
    encryptedUserToken: text("encrypted_user_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("github_installation_states_user_idx").on(table.userId)],
);

export const githubInstallations = pgTable("github_installations", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubInstallationId: bigint("github_installation_id", { mode: "number" })
    .notNull()
    .unique(),
  githubAccountLogin: text("github_account_login").notNull(),
  githubAccountType: text("github_account_type").notNull(),
  installedBy: uuid("installed_by")
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectRepositories = pgTable(
  "project_repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    githubInstallationId: uuid("github_installation_id")
      .notNull()
      .references(() => githubInstallations.id),
    repositoryId: bigint("repository_id", { mode: "number" }).notNull(),
    repositoryFullName: text("repository_full_name").notNull(),
    repositoryUrl: text("repository_url").notNull(),
    defaultBranch: text("default_branch"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_repositories_project_uidx").on(table.projectId),
    uniqueIndex("project_repositories_installation_repo_uidx").on(
      table.githubInstallationId,
      table.repositoryId,
    ),
    uniqueIndex("project_repositories_repository_uidx").on(table.repositoryId),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectMembership = typeof projectMemberships.$inferSelect;
export type ProjectInvitation = typeof projectInvitations.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type GitHubInstallationState = typeof githubInstallationStates.$inferSelect;
