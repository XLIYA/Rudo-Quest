-- Track signed profile uploads so abandoned private objects can be removed.

create table if not exists profile_asset_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  path text not null unique,
  kind text not null,
  expires_at timestamptz not null,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profile_asset_uploads_kind check (kind in ('avatar', 'banner'))
);

create index if not exists profile_asset_uploads_pending_expiry_idx
  on profile_asset_uploads(expires_at)
  where committed_at is null;

alter table profile_asset_uploads enable row level security;
revoke all privileges on table profile_asset_uploads from anon, authenticated;

