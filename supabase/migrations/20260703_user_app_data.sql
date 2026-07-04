-- Generic per-user key-value store so a real Supabase Auth account (e.g.
-- Google login) can restore its learning data (saved words, stats, garden
-- progress, settings, custom scenes, exam results, etc.) on any device or
-- after a PWA reinstall, instead of relying only on localStorage.

create table if not exists user_app_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  data_key text not null,
  data_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, data_key)
);

alter table user_app_data enable row level security;

-- Each authenticated user can only read/write their own rows. This lets the
-- browser sync directly with the anon key + user's JWT, no service role
-- needed for this table.
drop policy if exists "Users manage their own app data" on user_app_data;
create policy "Users manage their own app data"
  on user_app_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_app_data_user_id_idx on user_app_data (user_id);
create index if not exists user_app_data_updated_at_idx on user_app_data (updated_at desc);

grant select, insert, update, delete on user_app_data to authenticated;
grant all on user_app_data to service_role;
