-- Rudo Quest RLS coverage for membership and invitation state transitions.

drop policy if exists project_members_manage_memberships on project_memberships;
create policy project_members_manage_memberships on project_memberships
  for all to authenticated
  using ((select private.current_project_role(project_id)) in ('OWNER', 'ADMIN') and role <> 'OWNER')
  with check ((select private.current_project_role(project_id)) in ('OWNER', 'ADMIN') and role <> 'OWNER');

drop policy if exists invitation_recipients_and_admins_update on project_invitations;
create policy invitation_recipients_and_admins_update on project_invitations
  for update to authenticated
  using (
    invited_user_id = (select auth.uid())
    or (select private.current_project_role(project_id)) in ('OWNER', 'ADMIN')
  )
  with check (
    invited_user_id = (select auth.uid())
    or (select private.current_project_role(project_id)) in ('OWNER', 'ADMIN')
  );
