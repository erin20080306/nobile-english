-- Lightweight per-day API call counters so the admin panel can show how
-- many times each external API (Gemini models, TTS providers, etc.) has
-- been called, to help decide when to switch to a fallback model/provider
-- before hitting a paid quota limit.

create table if not exists api_usage_counters (
  id bigserial primary key,
  api_name text not null,
  usage_date date not null default current_date,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (api_name, usage_date)
);

create index if not exists api_usage_counters_date_idx on api_usage_counters (usage_date);

alter table api_usage_counters enable row level security;

-- Only the service role (server-side) reads/writes this table; no public
-- policies are defined so anon/authenticated clients have no direct access.
grant all on api_usage_counters to service_role;
grant usage, select on sequence api_usage_counters_id_seq to service_role;

-- Atomic increment so concurrent requests never lose a count under a race.
create or replace function increment_api_usage(p_api_name text, p_amount integer default 1)
returns void as $$
begin
  insert into api_usage_counters (api_name, usage_date, count)
  values (p_api_name, current_date, p_amount)
  on conflict (api_name, usage_date)
  do update set count = api_usage_counters.count + excluded.count, updated_at = now();
end;
$$ language plpgsql security definer;

grant execute on function increment_api_usage(text, integer) to service_role;
