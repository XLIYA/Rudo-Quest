-- Rudo Quest integrity and retry hardening.

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

drop trigger if exists tasks_integrity_trigger on tasks;
create trigger tasks_integrity_trigger
before insert or update on tasks
for each row execute function private.validate_task_integrity();

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
