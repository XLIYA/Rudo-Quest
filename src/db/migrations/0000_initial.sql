create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  handle text unique not null,
  display_name text not null,
  avatar_path text,
  banner_path text,
  theme_preference text not null default 'system',
  time_zone text not null,
  notifications_enabled boolean not null default true,
  daily_reminder_enabled boolean not null default true,
  daily_reminder_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format check (handle = lower(handle) and length(handle) between 3 and 30 and handle ~ '^[a-z0-9_-]+$'),
  constraint profiles_display_name_length check (length(display_name) between 2 and 60),
  constraint profiles_theme_preference check (theme_preference in ('system', 'light', 'dark'))
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  title text not null,
  description text,
  icon_key text not null,
  color_key text not null,
  time_zone text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_title_length check (length(title) between 2 and 60),
  constraint projects_description_length check (description is null or length(description) <= 500),
  constraint projects_color_key check (color_key in ('orange','red','rose','violet','blue','cyan','green','yellow'))
);

create table if not exists project_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint project_memberships_role check (role in ('OWNER','ADMIN','MEMBER','VIEWER')),
  constraint project_memberships_unique unique (project_id, user_id)
);

create unique index if not exists project_one_owner_uidx on project_memberships(project_id) where role = 'OWNER';

create table if not exists project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  invited_user_id uuid not null references profiles(id) on delete cascade,
  role text not null,
  status text not null,
  invited_by uuid not null references profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint project_invitations_role check (role in ('ADMIN','MEMBER','VIEWER')),
  constraint project_invitations_status check (status in ('PENDING','ACCEPTED','DECLINED','REVOKED','EXPIRED'))
);

create unique index if not exists project_invitations_one_pending_uidx on project_invitations(project_id, invited_user_id) where status = 'PENDING';

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  created_by uuid not null references profiles(id),
  assignee_id uuid references profiles(id),
  title text not null,
  description text,
  icon_key text,
  status text not null default 'TODO',
  previous_status text,
  scheduled_date date not null,
  scheduled_time time,
  scheduled_time_zone text not null,
  completed_at timestamptz,
  archived_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_length check (length(title) between 1 and 140),
  constraint tasks_description_length check (description is null or length(description) <= 5000),
  constraint tasks_status check (status in ('TODO','IN_PROGRESS','DONE')),
  constraint tasks_previous_status check (previous_status is null or previous_status in ('TODO','IN_PROGRESS')),
  constraint tasks_personal_assignee check ((project_id is not null) or (assignee_id = created_by))
);

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  subscription_id uuid not null references push_subscriptions(id) on delete cascade,
  status text not null,
  attempt_count integer not null default 0,
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table if not exists github_installations (
  id uuid primary key default gen_random_uuid(),
  github_installation_id bigint not null unique,
  github_account_login text not null,
  github_account_type text not null,
  installed_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_repositories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  github_installation_id uuid not null references github_installations(id),
  repository_id bigint not null,
  repository_full_name text not null,
  repository_url text not null,
  default_branch text,
  created_at timestamptz not null default now(),
  constraint project_repositories_one_project unique(project_id),
  constraint project_repositories_one_repo unique(repository_id),
  constraint project_repositories_installation_repo unique(github_installation_id, repository_id)
);

create index if not exists profiles_handle_idx on profiles(handle);
create index if not exists profiles_lower_email_idx on profiles(lower(email));
create index if not exists project_memberships_project_user_idx on project_memberships(project_id, user_id);
create index if not exists project_invitations_project_user_status_idx on project_invitations(project_id, invited_user_id, status);
create index if not exists tasks_assignee_date_status_idx on tasks(assignee_id, scheduled_date, status);
create index if not exists tasks_project_date_status_idx on tasks(project_id, scheduled_date, status);
create index if not exists tasks_created_by_date_idx on tasks(created_by, scheduled_date);
create index if not exists tasks_archived_at_idx on tasks(archived_at);
create index if not exists activity_events_actor_created_idx on activity_events(actor_id, created_at desc);
create index if not exists activity_events_project_created_idx on activity_events(project_id, created_at desc);
create index if not exists activity_events_task_created_idx on activity_events(task_id, created_at asc);
create index if not exists notifications_recipient_read_created_idx on notifications(recipient_id, read_at, created_at desc);
create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);
create index if not exists project_repositories_repository_idx on project_repositories(repository_id);

alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_memberships enable row level security;
alter table project_invitations enable row level security;
alter table tasks enable row level security;
alter table activity_events enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;

create policy "profiles_self_select" on profiles for select using (auth.uid() = id);
create policy "profiles_self_update" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "members_view_projects" on projects for select using (
  exists (select 1 from project_memberships pm where pm.project_id = id and pm.user_id = auth.uid())
);
create policy "members_view_memberships" on project_memberships for select using (
  exists (select 1 from project_memberships pm where pm.project_id = project_id and pm.user_id = auth.uid())
);
create policy "members_view_tasks" on tasks for select using (
  (project_id is null and (created_by = auth.uid() or assignee_id = auth.uid()))
  or exists (select 1 from project_memberships pm where pm.project_id = project_id and pm.user_id = auth.uid())
);
create policy "users_view_notifications" on notifications for select using (recipient_id = auth.uid());
create policy "users_view_push_subscriptions" on push_subscriptions for select using (user_id = auth.uid());
