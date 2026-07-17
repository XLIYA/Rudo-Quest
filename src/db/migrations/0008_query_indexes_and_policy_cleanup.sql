-- Add indexes for foreign-key maintenance and the authenticated read paths
-- that are not covered by the leading columns of existing indexes.
create index if not exists profile_asset_uploads_user_idx
  on profile_asset_uploads(user_id);
create index if not exists projects_owner_idx
  on projects(owner_id);
create index if not exists project_memberships_user_idx
  on project_memberships(user_id);
create index if not exists project_invitations_invited_user_idx
  on project_invitations(invited_user_id);
create index if not exists project_invitations_invited_by_idx
  on project_invitations(invited_by);
create index if not exists tasks_project_assignee_idx
  on tasks(project_id, assignee_id);
create index if not exists tasks_assignee_completed_at_idx
  on tasks(assignee_id, completed_at)
  where status = 'DONE' and archived_at is null;
create index if not exists notifications_recipient_created_idx
  on notifications(recipient_id, created_at, id);
create index if not exists notification_deliveries_subscription_idx
  on notification_deliveries(subscription_id);
create index if not exists github_installations_installed_by_idx
  on github_installations(installed_by);

-- FOR ALL overlaps separate SELECT policies and makes the RLS policy planner
-- evaluate two permissive policies for reads. Keep one policy per operation.
drop policy if exists project_members_manage_memberships on project_memberships;
drop policy if exists project_members_insert_memberships on project_memberships;
drop policy if exists project_members_update_memberships on project_memberships;
drop policy if exists project_members_delete_memberships on project_memberships;
create policy project_members_insert_memberships on project_memberships
  for insert to authenticated
  with check (
    (select private.current_project_role(project_id)) in ('OWNER', 'ADMIN')
    and role <> 'OWNER'
  );
create policy project_members_update_memberships on project_memberships
  for update to authenticated
  using (
    (select private.current_project_role(project_id)) in ('OWNER', 'ADMIN')
    and role <> 'OWNER'
  )
  with check (
    (select private.current_project_role(project_id)) in ('OWNER', 'ADMIN')
    and role <> 'OWNER'
  );
create policy project_members_delete_memberships on project_memberships
  for delete to authenticated
  using (
    (select private.current_project_role(project_id)) in ('OWNER', 'ADMIN')
    and role <> 'OWNER'
  );

drop policy if exists project_admins_manage_repositories on project_repositories;
drop policy if exists project_admins_insert_repositories on project_repositories;
drop policy if exists project_admins_update_repositories on project_repositories;
drop policy if exists project_admins_delete_repositories on project_repositories;
create policy project_admins_insert_repositories on project_repositories
  for insert to authenticated
  with check ((select private.current_project_role(project_id)) in ('OWNER', 'ADMIN'));
create policy project_admins_update_repositories on project_repositories
  for update to authenticated
  using ((select private.current_project_role(project_id)) in ('OWNER', 'ADMIN'))
  with check ((select private.current_project_role(project_id)) in ('OWNER', 'ADMIN'));
create policy project_admins_delete_repositories on project_repositories
  for delete to authenticated
  using ((select private.current_project_role(project_id)) in ('OWNER', 'ADMIN'));

drop policy if exists users_manage_push_subscriptions on push_subscriptions;
drop policy if exists users_insert_push_subscriptions on push_subscriptions;
drop policy if exists users_update_push_subscriptions on push_subscriptions;
drop policy if exists users_delete_push_subscriptions on push_subscriptions;
create policy users_insert_push_subscriptions on push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy users_update_push_subscriptions on push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy users_delete_push_subscriptions on push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));
