-- Site-wide TTS audio cache. Any fixed or dynamic tutor text must look up this
-- table BEFORE calling Chirp 3 HD. Cache reuse is cross-scene, cross-user, cross-course.

do $$ begin
  create type tts_asset_type as enum (
    'practice_sentence',
    'tutor_reply',
    'tutor_pass',
    'tutor_minor_correction',
    'tutor_retry',
    'tutor_hint',
    'tutor_complete',
    'word_pronunciation',
    'dynamic_tutor_reply'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type tts_asset_status as enum ('generating', 'ready', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists tts_audio_assets (
  id uuid primary key default gen_random_uuid(),
  language_code text not null,
  voice_profile_id uuid not null references voice_profiles (id),
  provider text not null default 'google-chirp3hd',
  provider_model text not null default 'chirp-3-hd',
  normalized_text text not null,
  text_hash text not null,
  audio_format text not null default 'm4a',
  audio_path text,
  duration_ms integer,
  audio_version integer not null default 1,
  asset_type tts_asset_type not null,
  scene_id text,
  scene_version integer,
  status tts_asset_status not null default 'generating',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One audio per (provider, model, language, voice, text_hash, format, audio_version).
-- This guarantees identical text is generated/paid for only once, site-wide.
create unique index if not exists tts_audio_assets_uidx
  on tts_audio_assets (
    provider,
    provider_model,
    language_code,
    voice_profile_id,
    text_hash,
    audio_format,
    audio_version
  );

create index if not exists tts_audio_assets_scene_idx
  on tts_audio_assets (scene_id, scene_version);

create index if not exists tts_audio_assets_status_idx
  on tts_audio_assets (status);

drop trigger if exists tts_audio_assets_set_updated_at on tts_audio_assets;
create trigger tts_audio_assets_set_updated_at
  before update on tts_audio_assets
  for each row execute function set_updated_at();

-- Server-only access; audio is served via short-lived signed URLs from a private bucket.
alter table tts_audio_assets enable row level security;
