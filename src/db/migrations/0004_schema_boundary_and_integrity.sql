-- Repair schema drift from the accidentally generated baseline, finish
-- validation of hardened constraints, and make the server API the only table
-- mutation boundary.

-- A generated Drizzle baseline briefly lived ahead of 0000_initial.sql. If it
-- was applied to an empty database, normalize its foreign keys to the intended
-- cascade behavior. Dropping both Postgres-default and Drizzle-generated names
-- keeps this migration safe for either history.
alter table profiles
  drop constraint if exists profiles_id_fkey;
alter table profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

alter table project_memberships
  drop constraint if exists project_memberships_project_id_fkey,
  drop constraint if exists project_memberships_project_id_projects_id_fk,
  drop constraint if exists project_memberships_user_id_fkey,
  drop constraint if exists project_memberships_user_id_profiles_id_fk;
alter table project_memberships
  add constraint project_memberships_project_id_fkey foreign key (project_id) references projects(id) on delete cascade,
  add constraint project_memberships_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;

alter table project_invitations
  drop constraint if exists project_invitations_project_id_fkey,
  drop constraint if exists project_invitations_project_id_projects_id_fk,
  drop constraint if exists project_invitations_invited_user_id_fkey,
  drop constraint if exists project_invitations_invited_user_id_profiles_id_fk,
  drop constraint if exists project_invitations_invited_by_fkey,
  drop constraint if exists project_invitations_invited_by_profiles_id_fk;
alter table project_invitations
  add constraint project_invitations_project_id_fkey foreign key (project_id) references projects(id) on delete cascade,
  add constraint project_invitations_invited_user_id_fkey foreign key (invited_user_id) references profiles(id) on delete cascade,
  add constraint project_invitations_invited_by_fkey foreign key (invited_by) references profiles(id);

alter table tasks
  drop constraint if exists tasks_project_id_fkey,
  drop constraint if exists tasks_project_id_projects_id_fk,
  drop constraint if exists tasks_created_by_fkey,
  drop constraint if exists tasks_created_by_profiles_id_fk,
  drop constraint if exists tasks_assignee_id_fkey,
  drop constraint if exists tasks_assignee_id_profiles_id_fk;
alter table tasks
  add constraint tasks_project_id_fkey foreign key (project_id) references projects(id) on delete cascade,
  add constraint tasks_created_by_fkey foreign key (created_by) references profiles(id),
  add constraint tasks_assignee_id_fkey foreign key (assignee_id) references profiles(id);

alter table activity_events
  drop constraint if exists activity_events_actor_id_fkey,
  drop constraint if exists activity_events_actor_id_profiles_id_fk,
  drop constraint if exists activity_events_project_id_fkey,
  drop constraint if exists activity_events_project_id_projects_id_fk,
  drop constraint if exists activity_events_task_id_fkey,
  drop constraint if exists activity_events_task_id_tasks_id_fk;
alter table activity_events
  add constraint activity_events_actor_id_fkey foreign key (actor_id) references profiles(id),
  add constraint activity_events_project_id_fkey foreign key (project_id) references projects(id) on delete cascade,
  add constraint activity_events_task_id_fkey foreign key (task_id) references tasks(id) on delete cascade;

alter table notifications
  drop constraint if exists notifications_recipient_id_fkey,
  drop constraint if exists notifications_recipient_id_profiles_id_fk,
  drop constraint if exists notifications_dedupe_key_unique;
alter table notifications
  add constraint notifications_recipient_id_fkey foreign key (recipient_id) references profiles(id) on delete cascade;

alter table push_subscriptions
  drop constraint if exists push_subscriptions_user_id_fkey,
  drop constraint if exists push_subscriptions_user_id_profiles_id_fk;
alter table push_subscriptions
  add constraint push_subscriptions_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;

alter table notification_deliveries
  drop constraint if exists notification_deliveries_notification_id_fkey,
  drop constraint if exists notification_deliveries_notification_id_notifications_id_fk,
  drop constraint if exists notification_deliveries_subscription_id_fkey,
  drop constraint if exists notification_deliveries_subscription_id_push_subscriptions_id_fk;
alter table notification_deliveries
  add constraint notification_deliveries_notification_id_fkey foreign key (notification_id) references notifications(id) on delete cascade,
  add constraint notification_deliveries_subscription_id_fkey foreign key (subscription_id) references push_subscriptions(id) on delete cascade;

alter table github_installation_states
  drop constraint if exists github_installation_states_user_id_fkey,
  drop constraint if exists github_installation_states_user_id_profiles_id_fk;
alter table github_installation_states
  add constraint github_installation_states_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;

alter table project_repositories
  drop constraint if exists project_repositories_project_id_fkey,
  drop constraint if exists project_repositories_project_id_projects_id_fk,
  drop constraint if exists project_repositories_github_installation_id_fkey,
  drop constraint if exists project_repositories_github_installation_id_github_installations_id_fk;
alter table project_repositories
  add constraint project_repositories_project_id_fkey foreign key (project_id) references projects(id) on delete cascade,
  add constraint project_repositories_github_installation_id_fkey foreign key (github_installation_id) references github_installations(id);

-- Restore checks that CREATE TABLE IF NOT EXISTS could not add after the
-- generated baseline, then validate the checks introduced as NOT VALID.
alter table profiles
  drop constraint if exists profiles_handle_format,
  drop constraint if exists profiles_display_name_length,
  drop constraint if exists profiles_theme_preference;
alter table profiles
  add constraint profiles_handle_format check (handle = lower(handle) and length(handle) between 3 and 30 and handle ~ '^[a-z0-9_-]+$'),
  add constraint profiles_display_name_length check (length(display_name) between 2 and 60),
  add constraint profiles_theme_preference check (theme_preference in ('system', 'light', 'dark'));

alter table projects
  drop constraint if exists projects_title_length,
  drop constraint if exists projects_description_length,
  drop constraint if exists projects_color_key;
alter table projects
  add constraint projects_title_length check (length(title) between 2 and 60),
  add constraint projects_description_length check (description is null or length(description) <= 500),
  add constraint projects_color_key check (color_key in ('orange','red','rose','violet','blue','cyan','green','yellow'));

alter table project_memberships
  drop constraint if exists project_memberships_role;
alter table project_memberships
  add constraint project_memberships_role check (role in ('OWNER','ADMIN','MEMBER','VIEWER'));

alter table project_invitations
  drop constraint if exists project_invitations_role,
  drop constraint if exists project_invitations_status;
alter table project_invitations
  add constraint project_invitations_role check (role in ('ADMIN','MEMBER','VIEWER')),
  add constraint project_invitations_status check (status in ('PENDING','ACCEPTED','DECLINED','REVOKED','EXPIRED'));

alter table tasks
  drop constraint if exists tasks_title_length,
  drop constraint if exists tasks_description_length,
  drop constraint if exists tasks_status,
  drop constraint if exists tasks_previous_status;
alter table tasks
  add constraint tasks_title_length check (length(title) between 1 and 140),
  add constraint tasks_description_length check (description is null or length(description) <= 5000),
  add constraint tasks_status check (status in ('TODO','IN_PROGRESS','DONE')),
  add constraint tasks_previous_status check (previous_status is null or previous_status in ('TODO','IN_PROGRESS'));

alter table profiles validate constraint profiles_banner_preset_key;
alter table tasks validate constraint tasks_personal_assignee_strict;
alter table tasks validate constraint tasks_version_positive;
alter table tasks validate constraint tasks_status_completion_consistency;
alter table notification_deliveries validate constraint notification_deliveries_status_check;
alter table notification_deliveries validate constraint notification_deliveries_attempt_count_check;

create unique index if not exists project_one_owner_uidx
  on project_memberships(project_id) where role = 'OWNER';
create unique index if not exists project_invitations_one_pending_uidx
  on project_invitations(project_id, invited_user_id) where status = 'PENDING';
create index if not exists project_invitations_pending_expires_idx
  on project_invitations(expires_at) where status = 'PENDING';
create index if not exists notification_deliveries_retry_idx
  on notification_deliveries(next_retry_at, created_at)
  where status in ('PENDING', 'RETRYING');

-- No browser code reads or writes application tables. Remove the implicit
-- PostgREST surface and prevent future migrations from recreating it. RLS stays
-- enabled as defense in depth.
revoke all privileges on table
  profiles,
  projects,
  project_memberships,
  project_invitations,
  tasks,
  activity_events,
  notifications,
  push_subscriptions,
  notification_deliveries,
  github_installation_states,
  github_installations,
  project_repositories,
  __app_migrations
from anon, authenticated;

revoke usage, select on all sequences in schema public from anon, authenticated;
alter default privileges in schema public
  revoke select, insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges in schema public
  revoke usage, select, update on sequences from anon, authenticated;

alter table __app_migrations enable row level security;

