-- Resolve the deferred integrity trigger's project ID without referencing
-- fields that do not exist on the active trigger table. A removed project has
-- no owner invariant left to enforce, while membership changes on an existing
-- project must still preserve exactly one matching OWNER membership.
create or replace function private.validate_project_owner_membership()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_project_id uuid;
  owner_user_id uuid;
begin
  if tg_table_name = 'projects' then
    if tg_op = 'DELETE' then
      target_project_id := old.id;
    else
      target_project_id := new.id;
    end if;
  else
    if tg_op = 'DELETE' then
      target_project_id := old.project_id;
    else
      target_project_id := new.project_id;
    end if;
  end if;

  select p.owner_id
  into owner_user_id
  from public.projects p
  where p.id = target_project_id;

  if owner_user_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if not exists (
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
