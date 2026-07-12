-- Rudo Quest audit hardening migration.
-- This migration is deliberately additive and keeps the original migration immutable.

alter table profiles
  add column if not exists banner_preset_key text,
  add column if not exists quiet_hours_start time not null default '22:00:00',
  add column if not exists quiet_hours_end time not null default '07:00:00';
alter table profiles
  drop constraint if exists profiles_banner_preset_key,
  add constraint profiles_banner_preset_key
    check (banner_preset_key is null or banner_preset_key in ('sunrise', 'trail', 'night')) not valid;

alter table notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_dedupe_key_uidx
  on notifications(dedupe_key)
  where dedupe_key is not null;

alter table notification_deliveries add column if not exists next_retry_at timestamptz;
delete from notification_deliveries duplicate
using (
  select id,
         row_number() over (partition by notification_id, subscription_id order by created_at, id) as duplicate_rank
  from notification_deliveries
) ranked
where duplicate.id = ranked.id
  and ranked.duplicate_rank > 1;
create unique index if not exists notification_deliveries_notification_subscription_uidx
  on notification_deliveries(notification_id, subscription_id);
alter table notification_deliveries
  drop constraint if exists notification_deliveries_status_check,
  add constraint notification_deliveries_status_check
    check (status in ('PENDING', 'SENT', 'FAILED', 'RETRYING')) not valid,
  add constraint notification_deliveries_attempt_count_check
    check (attempt_count >= 0) not valid;

create table if not exists github_installation_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  nonce text not null unique,
  encrypted_user_token text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists github_installation_states_user_idx
  on github_installation_states(user_id);

alter table tasks drop constraint if exists tasks_personal_assignee;
alter table tasks
  add constraint tasks_personal_assignee_strict
    check (project_id is not null or (assignee_id is not null and assignee_id = created_by)) not valid,
  add constraint tasks_version_positive check (version > 0) not valid,
  add constraint tasks_status_completion_consistency
    check ((status = 'DONE' and completed_at is not null) or (status <> 'DONE' and completed_at is null)) not valid;

create index if not exists activity_events_created_id_idx
  on activity_events(created_at desc, id desc);

create schema if not exists private;

create or replace function private.current_project_role(target_project_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pm.role
  from public.project_memberships pm
  where pm.project_id = target_project_id
    and pm.user_id = (select auth.uid())
  limit 1
$$;

create or replace function private.is_project_member(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.project_memberships pm
    where pm.project_id = target_project_id
      and pm.user_id = (select auth.uid())
  )
$$;

create or replace function private.validate_task_integrity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.version <> old.version + 1 then
    raise exception 'Task version must increase by one';
  end if;

  if new.project_id is null then
    if new.assignee_id is distinct from new.created_by then
      raise exception 'Personal tasks must be assigned to their creator';
    end if;
  elsif new.assignee_id is not null and not exists (
    select 1
    from public.project_memberships pm
    where pm.project_id = new.project_id
      and pm.user_id = new.assignee_id
  ) then
    raise exception 'Project task assignee must be an active project member';
  end if;

  if new.status = 'DONE' then
    new.completed_at := coalesce(new.completed_at, now());
    if new.previous_status is null then
      if tg_op = 'UPDATE' and old.status <> 'DONE' then
        new.previous_status := old.status;
      else
        new.previous_status := 'TODO';
      end if;
    end if;
  else
    new.completed_at := null;
    new.previous_status := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_integrity_trigger on tasks;
create trigger tasks_integrity_trigger
before insert or update on tasks
for each row execute function private.validate_task_integrity();

create or replace function private.validate_project_owner_membership()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_project_id uuid;
  owner_user_id uuid;
begin
  target_project_id := case when tg_table_name = 'projects' then new.id else coalesce(new.project_id, old.project_id) end;
  select p.owner_id into owner_user_id from public.projects p where p.id = target_project_id;
  if owner_user_id is null or not exists (
    select 1
    from public.project_memberships pm
    where pm.project_id = target_project_id
      and pm.user_id = owner_user_id
      and pm.role = 'OWNER'
  ) then
    raise exception 'Every project must have an owner membership';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_owner_membership_integrity on projects;
create constraint trigger projects_owner_membership_integrity
after insert or update of owner_id on projects
deferrable initially deferred
for each row execute function private.validate_project_owner_membership();

drop trigger if exists memberships_owner_membership_integrity on project_memberships;
create constraint trigger memberships_owner_membership_integrity
after insert or update or delete on project_memberships
deferrable initially deferred
for each row execute function private.validate_project_owner_membership();

revoke all on function private.current_project_role(uuid) from public;
revoke all on function private.is_project_member(uuid) from public;
grant execute on function private.current_project_role(uuid) to authenticated, service_role;
grant execute on function private.is_project_member(uuid) to authenticated, service_role;

alter table github_installations enable row level security;
alter table project_repositories enable row level security;
alter table notification_deliveries enable row level security;
alter table github_installation_states enable row level security;

drop policy if exists profiles_self_select on profiles;
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_select on profiles
  for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_self_update on profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists members_view_projects on projects;
drop policy if exists members_update_projects on projects;
create policy members_view_projects on projects
  for select to authenticated
  using ((select private.is_project_member(id)));
create policy members_update_projects on projects
  for update to authenticated
  using ((select private.current_project_role(id)) in ('OWNER', 'ADMIN'))
  with check ((select private.current_project_role(id)) in ('OWNER', 'ADMIN'));

drop policy if exists members_view_memberships on project_memberships;
create policy members_view_memberships on project_memberships
  for select to authenticated
  using ((select private.is_project_member(project_id)));

drop policy if exists invited_users_view_invitations on project_invitations;
drop policy if exists project_admins_manage_invitations on project_invitations;
create policy invited_users_view_invitations on project_invitations
  for select to authenticated
  using (
    invited_user_id = (select auth.uid())
    or (select private.is_project_member(project_id))
  );
create policy project_admins_manage_invitations on project_invitations
  for insert to authenticated
  with check ((select private.current_project_role(project_id)) in ('OWNER', 'ADMIN'));

drop policy if exists members_view_tasks on tasks;
drop policy if exists members_insert_tasks on tasks;
drop policy if exists members_update_tasks on tasks;
drop policy if exists members_delete_tasks on tasks;
create policy members_view_tasks on tasks
  for select to authenticated
  using (
    (project_id is null and (created_by = (select auth.uid()) or assignee_id = (select auth.uid())))
    or (project_id is not null and (select private.is_project_member(project_id)))
  );
create policy members_insert_tasks on tasks
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      project_id is null
      or (select private.current_project_role(project_id)) in ('OWNER', 'ADMIN', 'MEMBER')
    )
  );
create policy members_update_tasks on tasks
  for update to authenticated
  using (
    (project_id is null and created_by = (select auth.uid()))
    or (project_id is not null and (select private.current_project_role(project_id)) in ('OWNER', 'ADMIN') )
    or (project_id is not null and (select private.current_project_role(project_id)) = 'MEMBER' and assignee_id = (select auth.uid()))
  )
  with check (
    project_id is null and created_by = (select auth.uid())
    or project_id is not null and (select private.is_project_member(project_id))
  );
create policy members_delete_tasks on tasks
  for delete to authenticated
  using (
    (project_id is null and created_by = (select auth.uid()))
    or (project_id is not null and (select private.current_project_role(project_id)) in ('OWNER', 'ADMIN'))
  );

drop policy if exists members_view_activity on activity_events;
create policy members_view_activity on activity_events
  for select to authenticated
  using (
    (project_id is not null and (select private.is_project_member(project_id)))
    or (project_id is null and actor_id = (select auth.uid()))
    or (task_id is not null and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and t.project_id is null
        and (t.created_by = (select auth.uid()) or t.assignee_id = (select auth.uid()))
    ))
  );

drop policy if exists users_view_notifications on notifications;
drop policy if exists users_update_notifications on notifications;
create policy users_view_notifications on notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy users_update_notifications on notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

drop policy if exists users_view_push_subscriptions on push_subscriptions;
drop policy if exists users_manage_push_subscriptions on push_subscriptions;
create policy users_view_push_subscriptions on push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy users_manage_push_subscriptions on push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists users_view_github_installations on github_installations;
create policy users_view_github_installations on github_installations
  for select to authenticated
  using (installed_by = (select auth.uid()));

drop policy if exists members_view_project_repositories on project_repositories;
drop policy if exists project_admins_manage_repositories on project_repositories;
create policy members_view_project_repositories on project_repositories
  for select to authenticated
  using ((select private.is_project_member(project_id)));
create policy project_admins_manage_repositories on project_repositories
  for all to authenticated
  using ((select private.current_project_role(project_id)) in ('OWNER', 'ADMIN'))
  with check ((select private.current_project_role(project_id)) in ('OWNER', 'ADMIN'));

drop policy if exists users_view_notification_deliveries on notification_deliveries;
drop policy if exists users_view_github_installation_states on github_installation_states;

grant usage on schema private to authenticated, service_role;
