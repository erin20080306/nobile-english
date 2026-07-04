-- Cloud snapshot for local-first app data.
-- Keeps Android PWA reinstall / home-screen removal from looking like a fresh app.

create table if not exists user_app_state_snapshots (
  user_id text primary key,
  email text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_app_state_snapshots_email_idx
  on user_app_state_snapshots (lower(email))
  where email is not null;

create or replace function update_user_app_state_snapshots_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_app_state_snapshots_updated_at on user_app_state_snapshots;
create trigger user_app_state_snapshots_updated_at
  before update on user_app_state_snapshots
  for each row execute function update_user_app_state_snapshots_updated_at();

alter table user_app_state_snapshots enable row level security;

drop policy if exists user_app_state_snapshots_service_role on user_app_state_snapshots;
create policy user_app_state_snapshots_service_role
  on user_app_state_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant all on user_app_state_snapshots to service_role;
