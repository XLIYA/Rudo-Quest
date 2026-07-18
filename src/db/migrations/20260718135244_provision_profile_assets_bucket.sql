-- Provision the private bucket used by signed avatar and banner uploads.
-- Direct browser access remains denied; the app server issues short-lived
-- upload and download URLs through the Supabase admin client.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-assets',
  'profile-assets',
  false,
  4000000,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
