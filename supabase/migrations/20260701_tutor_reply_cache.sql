-- Cache Gemini-generated tutor replies by scene, language, persona, turn, user
-- input, and recent transcript hash. The app still works if this migration has
-- not been applied; the API simply skips cache reads/writes on table errors.

create table if not exists tutor_reply_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  scene_id text not null,
  language_code text not null,
  persona text not null,
  turn integer not null,
  user_input text not null,
  history_hash text not null,
  model text not null,
  feedback jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tutor_reply_cache_scene_idx
  on tutor_reply_cache (scene_id, language_code, turn);

create index if not exists tutor_reply_cache_updated_idx
  on tutor_reply_cache (updated_at desc);

drop trigger if exists tutor_reply_cache_set_updated_at on tutor_reply_cache;
create trigger tutor_reply_cache_set_updated_at
  before update on tutor_reply_cache
  for each row execute function set_updated_at();

alter table tutor_reply_cache enable row level security;

grant all on tutor_reply_cache to service_role;
