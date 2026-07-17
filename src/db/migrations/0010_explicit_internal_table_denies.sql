-- These tables are intentionally server-only. Explicit restrictive policies
-- document the boundary and keep direct PostgREST access denied even if a
-- future grant is added accidentally.
drop policy if exists deny_direct_access on __app_migrations;
create policy deny_direct_access on __app_migrations
  as restrictive for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists deny_direct_access on github_installation_states;
create policy deny_direct_access on github_installation_states
  as restrictive for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists deny_direct_access on notification_deliveries;
create policy deny_direct_access on notification_deliveries
  as restrictive for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists deny_direct_access on profile_asset_uploads;
create policy deny_direct_access on profile_asset_uploads
  as restrictive for all to anon, authenticated
  using (false)
  with check (false);
