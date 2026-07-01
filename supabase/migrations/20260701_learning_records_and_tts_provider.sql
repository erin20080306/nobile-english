-- Persist learning records and make TTS cache usable with app-level tutor profiles.

create extension if not exists "pgcrypto";

do $$ begin
  create type learning_record_type as enum (
    'scene',
    'dialogue',
    'exam',
    'custom',
    'word',
    'reading_article'
  );
exception when duplicate_object then null; end $$;

create table if not exists learning_records (
  user_id text not null,
  id text not null,
  type learning_record_type not null,
  target_language text,
  title text not null,
  scene_name text,
  en_content text,
  zh_content text,
  user_answer text,
  suggestion text,
  conversation_words jsonb not null default '[]'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  completed boolean not null default true,
  minutes integer not null default 0,
  date timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists learning_records_user_date_idx
  on learning_records (user_id, date desc);

create index if not exists learning_records_user_type_idx
  on learning_records (user_id, type, date desc);

drop trigger if exists learning_records_set_updated_at on learning_records;
create trigger learning_records_set_updated_at
  before update on learning_records
  for each row execute function set_updated_at();

alter table learning_records enable row level security;

drop policy if exists "Users can read their own learning records" on learning_records;
create policy "Users can read their own learning records" on learning_records
  for select using (auth.uid()::text = user_id);

drop policy if exists "Users can insert their own learning records" on learning_records;
create policy "Users can insert their own learning records" on learning_records
  for insert with check (auth.uid()::text = user_id);

drop policy if exists "Users can update their own learning records" on learning_records;
create policy "Users can update their own learning records" on learning_records
  for update using (auth.uid()::text = user_id);

grant select, insert, update on learning_records to authenticated;
grant all on learning_records to service_role;

-- Existing TTS migrations used voice_profiles.id (uuid). The app now keeps
-- tutor-specific stable ids such as vp-en-jake, because English has six tutors
-- and the other languages have one male and one female tutor.
alter table voice_profiles
  add column if not exists profile_key text,
  add column if not exists provider_voice_config jsonb not null default '{}'::jsonb;

create unique index if not exists voice_profiles_profile_key_uidx
  on voice_profiles (profile_key)
  where profile_key is not null;

update voice_profiles
set is_default = false
where profile_key is null;

insert into voice_profiles (profile_key, language_code, voice_name, voice_gender, is_default, is_active) values
  ('vp-en-jake', 'en-US', 'en-US-Neural2-D', 'male', true, true),
  ('vp-en-william', 'en-GB', 'en-GB-Neural2-B', 'male', false, true),
  ('vp-en-emma', 'en-US', 'en-US-Neural2-F', 'female', true, true),
  ('vp-en-amy', 'en-US', 'en-US-Neural2-E', 'female', false, true),
  ('vp-en-sophie', 'en-GB', 'en-GB-Neural2-A', 'female', false, true),
  ('vp-en-lily', 'cmn-CN', 'cmn-CN-Wavenet-A', 'female', false, true),
  ('vp-ja-haruto', 'ja-JP', 'ja-JP-Neural2-C', 'male', true, true),
  ('vp-ja-yui', 'ja-JP', 'ja-JP-Neural2-B', 'female', true, true),
  ('vp-ko-minjun', 'ko-KR', 'ko-KR-Neural2-C', 'male', true, true),
  ('vp-ko-seoyeon', 'ko-KR', 'ko-KR-Neural2-A', 'female', true, true),
  ('vp-it-marco', 'it-IT', 'it-IT-Neural2-C', 'male', true, true),
  ('vp-it-giulia', 'it-IT', 'it-IT-Neural2-A', 'female', true, true),
  ('vp-es-carlos', 'es-ES', 'es-ES-Neural2-B', 'male', true, true),
  ('vp-es-sofia', 'es-ES', 'es-ES-Neural2-A', 'female', true, true)
on conflict (profile_key) where profile_key is not null do update set
  language_code = excluded.language_code,
  voice_name = excluded.voice_name,
  voice_gender = excluded.voice_gender,
  is_default = excluded.is_default,
  is_active = excluded.is_active,
  updated_at = now();

alter table tts_audio_assets
  add column if not exists voice_profile_key text;

alter table tts_audio_assets
  alter column voice_profile_id drop not null;

drop index if exists tts_audio_assets_uidx;
create unique index if not exists tts_audio_assets_uidx
  on tts_audio_assets (
    provider,
    provider_model,
    language_code,
    coalesce(voice_profile_key, voice_profile_id::text),
    text_hash,
    audio_format,
    audio_version_string
  );

create index if not exists tts_audio_assets_voice_profile_key_idx
  on tts_audio_assets (voice_profile_key);

-- Private bucket for generated/cacheable TTS files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tts-audio-assets',
  'tts-audio-assets',
  false,
  10485760,
  array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a']::text[]
)
on conflict (id) do nothing;
