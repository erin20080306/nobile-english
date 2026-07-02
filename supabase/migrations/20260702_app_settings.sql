-- Generic key-value app settings table so admins can toggle runtime
-- configuration (e.g. which TTS provider to use) without a redeploy.

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- Only the service role (server-side) reads/writes this table; no public
-- policies are defined so anon/authenticated clients have no direct access.
grant all on app_settings to service_role;
