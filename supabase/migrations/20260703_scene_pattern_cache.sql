-- Cache Gemini-generated shadowing sentences ("keyPatterns") for the app's
-- built-in (non-custom) scenes, keyed by scene id + language. Up to a few
-- distinct variants (sets of sentences) are cached per scene/language so
-- repeat visits can rotate between them instead of always showing the exact
-- same sentences; once MAX_VARIANTS (see the API route) have been generated,
-- no further Gemini calls are made for that scene/language and a variant is
-- picked at random from the cache on every request. The app still works if
-- this migration has not been applied, or the table is unreachable: the API
-- route simply falls back to the scene's static local sentences on any
-- cache/generation error.

create table if not exists scene_pattern_cache (
  id uuid primary key default gen_random_uuid(),
  scene_id text not null,
  language_code text not null default 'en',
  patterns jsonb not null,
  source text not null default 'gemini',
  model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added after the initial version of this migration (which had a single
-- patterns row per scene/language) to support multiple rotating variants.
alter table scene_pattern_cache
  add column if not exists variant_index integer not null default 0;

-- Replace the old single-variant unique constraint (scene_id, language_code)
-- with one that also includes variant_index, so several variants can coexist
-- per scene/language. Safe to run whether or not the old constraint exists.
alter table scene_pattern_cache
  drop constraint if exists scene_pattern_cache_scene_id_language_code_key;

create unique index if not exists scene_pattern_cache_variant_uidx
  on scene_pattern_cache (scene_id, language_code, variant_index);

create index if not exists scene_pattern_cache_scene_idx
  on scene_pattern_cache (scene_id, language_code);

drop trigger if exists scene_pattern_cache_set_updated_at on scene_pattern_cache;
create trigger scene_pattern_cache_set_updated_at
  before update on scene_pattern_cache
  for each row execute function set_updated_at();

alter table scene_pattern_cache enable row level security;

grant all on scene_pattern_cache to service_role;
