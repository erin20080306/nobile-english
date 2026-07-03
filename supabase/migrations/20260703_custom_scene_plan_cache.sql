-- Anonymous shared cache for AI-generated custom scene plans.
--
-- Built-in scenes use scene_pattern_cache as the official shared sentence bank.
-- Custom user topics use this separate cache so similar custom requests can
-- reuse a complete generated plan without tying it to a user account.

create table if not exists custom_scene_plan_cache (
  cache_key text primary key,
  language_code text not null,
  difficulty_level text not null,
  plan jsonb not null,
  source text not null default 'gemini',
  model text not null default '',
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_scene_plan_cache_language_idx
  on custom_scene_plan_cache (language_code, difficulty_level);

drop trigger if exists custom_scene_plan_cache_set_updated_at on custom_scene_plan_cache;
create trigger custom_scene_plan_cache_set_updated_at
  before update on custom_scene_plan_cache
  for each row execute function set_updated_at();

alter table custom_scene_plan_cache enable row level security;

grant all on custom_scene_plan_cache to service_role;
