-- Cache Gemini-generated shadowing sentences ("keyPatterns") for the app's
-- built-in (non-custom) scenes, keyed by scene id + language. The first
-- learner to open a given scene triggers Gemini generation and the result is
-- stored here; every learner after that reads the cached sentences instead
-- of calling the API again. The app still works if this migration has not
-- been applied, or the table is unreachable: the API route simply falls back
-- to the scene's static local sentences on any cache/generation error.

create table if not exists scene_pattern_cache (
  id uuid primary key default gen_random_uuid(),
  scene_id text not null,
  language_code text not null default 'en',
  patterns jsonb not null,
  source text not null default 'gemini',
  model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scene_id, language_code)
);

create index if not exists scene_pattern_cache_scene_idx
  on scene_pattern_cache (scene_id, language_code);

drop trigger if exists scene_pattern_cache_set_updated_at on scene_pattern_cache;
create trigger scene_pattern_cache_set_updated_at
  before update on scene_pattern_cache
  for each row execute function set_updated_at();

alter table scene_pattern_cache enable row level security;

grant all on scene_pattern_cache to service_role;
