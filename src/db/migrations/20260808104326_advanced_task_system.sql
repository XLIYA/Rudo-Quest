alter table public.tasks
  add column task_type text not null default 'TASK',
  add column priority text not null default 'NONE',
  add column parent_task_id uuid references public.tasks(id) on delete cascade;

alter table public.tasks
  add constraint tasks_task_type
    check (task_type in ('TASK', 'STORY', 'FEATURE', 'BUG', 'TEST')),
  add constraint tasks_priority
    check (priority in ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  add constraint tasks_parent_not_self
    check (parent_task_id is null or parent_task_id <> id),
  add constraint tasks_nested_story_forbidden
    check (parent_task_id is null or task_type <> 'STORY');

create or replace function public.enforce_task_parent_invariants()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_type text;
  parent_parent_id uuid;
  parent_project_id uuid;
  parent_archived_at timestamptz;
begin
  if new.parent_task_id is null then
    return new;
  end if;

  if new.parent_task_id = new.id then
    raise exception 'A task cannot be its own parent.' using errcode = '23514';
  end if;

  select task_type, parent_task_id, project_id, archived_at
  into parent_type, parent_parent_id, parent_project_id, parent_archived_at
  from public.tasks
  where id = new.parent_task_id
  for share;

  if not found then
    raise exception 'Parent task does not exist.' using errcode = '23503';
  end if;
  if parent_type <> 'STORY' or parent_parent_id is not null then
    raise exception 'Subtasks require a top-level Story parent.' using errcode = '23514';
  end if;
  if parent_archived_at is not null then
    raise exception 'Archived Stories cannot receive subtasks.' using errcode = '23514';
  end if;
  if parent_project_id is distinct from new.project_id then
    raise exception 'Story and subtask scope must match.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_task_parent_invariants on public.tasks;
create trigger enforce_task_parent_invariants
before insert or update of parent_task_id, project_id, task_type
on public.tasks
for each row execute function public.enforce_task_parent_invariants();

create index tasks_parent_status_idx
  on public.tasks (parent_task_id, archived_at, status)
  where parent_task_id is not null;

create index tasks_top_level_week_idx
  on public.tasks (scheduled_date, project_id, status)
  where parent_task_id is null and archived_at is null;

drop index if exists public.tasks_missed_history_idx;
create index tasks_missed_history_idx
  on public.tasks (scheduled_date desc, id desc)
  where parent_task_id is null and archived_at is null and status <> 'DONE';

drop index if exists public.tasks_archived_history_idx;
create index tasks_archived_history_idx
  on public.tasks (archived_at desc, id desc)
  where parent_task_id is null and archived_at is not null;

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  kind text not null,
  label text not null,
  url text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint task_attachments_kind check (kind in ('FILE', 'LINK')),
  constraint task_attachments_label_length check (length(label) between 1 and 140),
  constraint task_attachments_url_length check (url is null or length(url) <= 2048),
  constraint task_attachments_url_protocol check (url is null or url ~* '^https?://'),
  constraint task_attachments_file_name_length check (
    file_name is null or length(file_name) between 1 and 255
  ),
  constraint task_attachments_size check (
    size_bytes is null or size_bytes between 1 and 10485760
  ),
  constraint task_attachments_payload check (
    (
      kind = 'LINK'
      and url is not null
      and storage_path is null
      and file_name is null
      and mime_type is null
      and size_bytes is null
    )
    or
    (
      kind = 'FILE'
      and url is null
      and storage_path is not null
      and file_name is not null
      and mime_type is not null
      and size_bytes is not null
    )
  )
);

create index task_attachments_task_created_idx
  on public.task_attachments (task_id, created_at desc, id desc);
create unique index task_attachments_storage_path_uidx
  on public.task_attachments (storage_path)
  where storage_path is not null;

create table public.task_attachment_uploads (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  expires_at timestamptz not null,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint task_attachment_uploads_file_name_length
    check (length(file_name) between 1 and 255),
  constraint task_attachment_uploads_size
    check (size_bytes between 1 and 10485760),
  constraint task_attachment_uploads_mime check (
    mime_type in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
      'application/pdf',
      'text/plain',
      'text/csv',
      'text/markdown',
      'application/json',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'application/x-rar-compressed',
      'application/vnd.rar',
      'application/x-7z-compressed',
      'application/gzip',
      'application/x-tar'
    )
  )
);

create index task_attachment_uploads_task_user_idx
  on public.task_attachment_uploads (task_id, user_id);
create index task_attachment_uploads_pending_expiry_idx
  on public.task_attachment_uploads (expires_at)
  where committed_at is null;

alter table public.task_attachments enable row level security;
alter table public.task_attachment_uploads enable row level security;

revoke all on table public.task_attachments from anon, authenticated;
revoke all on table public.task_attachment_uploads from anon, authenticated;

drop policy if exists deny_direct_access on public.task_attachments;
create policy deny_direct_access on public.task_attachments
  as restrictive for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists deny_direct_access on public.task_attachment_uploads;
create policy deny_direct_access on public.task_attachment_uploads
  as restrictive for all to anon, authenticated
  using (false)
  with check (false);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'task-attachments',
  'task-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/json',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-rar-compressed',
    'application/vnd.rar',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-tar'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
