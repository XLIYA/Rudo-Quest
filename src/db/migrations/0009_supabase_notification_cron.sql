-- Supabase Cron provides minute-level scheduling without depending on the
-- Vercel project's plan. Secrets remain encrypted in Vault and are resolved
-- only inside this SECURITY DEFINER function at invocation time.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function private.invoke_notification_cron()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  app_url text;
  cron_secret text;
begin
  select decrypted_secret
  into app_url
  from vault.decrypted_secrets
  where name = 'rudo_quest_app_url'
  order by updated_at desc
  limit 1;

  select decrypted_secret
  into cron_secret
  from vault.decrypted_secrets
  where name = 'rudo_quest_cron_secret'
  order by updated_at desc
  limit 1;

  if app_url is null or cron_secret is null then
    raise warning 'Rudo Quest Cron Vault settings are missing';
    return null;
  end if;

  return net.http_post(
    url := rtrim(app_url, '/') || '/api/cron/notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
end;
$$;

revoke all on function private.invoke_notification_cron() from public, anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'rudo-quest-notifications'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'rudo-quest-notifications',
    '*/15 * * * *',
    'select private.invoke_notification_cron();'
  );
end;
$$;
