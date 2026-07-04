-- Aggregate page activity for real Google accounts so the admin panel can see
-- which non-admin accounts are using which pages, how often, and when.

create table if not exists app_user_page_activity (
  user_id text not null,
  email text not null,
  name text,
  provider text not null default 'google',
  path text not null,
  title text,
  visit_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text,
  primary key (user_id, path)
);

create index if not exists app_user_page_activity_email_idx
  on app_user_page_activity (lower(email));

create index if not exists app_user_page_activity_last_seen_idx
  on app_user_page_activity (last_seen_at desc);

create index if not exists app_user_page_activity_provider_idx
  on app_user_page_activity (provider);

alter table app_user_page_activity enable row level security;

drop policy if exists app_user_page_activity_service_role on app_user_page_activity;
create policy app_user_page_activity_service_role
  on app_user_page_activity
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant all on app_user_page_activity to service_role;
