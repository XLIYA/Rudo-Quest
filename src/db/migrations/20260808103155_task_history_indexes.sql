create index if not exists tasks_missed_history_idx
  on public.tasks (scheduled_date desc, id desc)
  where archived_at is null and status <> 'DONE';

create index if not exists tasks_archived_history_idx
  on public.tasks (archived_at desc, id desc)
  where archived_at is not null;
