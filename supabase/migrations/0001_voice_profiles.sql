-- Voice profiles for the fixed five-language AI tutor voices (Chirp 3 HD).
-- Voice ids are NEVER hard-coded in the frontend; they are resolved from this table.

create extension if not exists "pgcrypto";

do $$ begin
  create type voice_gender as enum ('female', 'male', 'neutral');
exception when duplicate_object then null; end $$;

create table if not exists voice_profiles (
  id uuid primary key default gen_random_uuid(),
  language_code text not null,
  voice_name text not null,
  voice_gender voice_gender not null default 'female',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one default voice per (language_code, gender).
create unique index if not exists voice_profiles_default_uidx
  on voice_profiles (language_code, voice_gender)
  where is_default;

create index if not exists voice_profiles_language_idx
  on voice_profiles (language_code, is_active);

-- Keep updated_at fresh.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists voice_profiles_set_updated_at on voice_profiles;
create trigger voice_profiles_set_updated_at
  before update on voice_profiles
  for each row execute function set_updated_at();

-- Server-only access. The service role bypasses RLS; no anon policies are added on purpose.
alter table voice_profiles enable row level security;

-- Seed candidate voices (admin can later flip is_default to pick the official voices).
insert into voice_profiles (language_code, voice_name, voice_gender, is_default, is_active) values
  ('en-US', 'en-US-Chirp3-HD-Aoede',  'female', true,  true),
  ('en-US', 'en-US-Chirp3-HD-Charon', 'male',   true,  true),
  ('ja-JP', 'ja-JP-Chirp3-HD-Aoede',  'female', true,  true),
  ('ja-JP', 'ja-JP-Chirp3-HD-Charon', 'male',   true,  true),
  ('it-IT', 'it-IT-Chirp3-HD-Aoede',  'female', true,  true),
  ('it-IT', 'it-IT-Chirp3-HD-Charon', 'male',   true,  true),
  ('ko-KR', 'ko-KR-Chirp3-HD-Aoede',  'female', true,  true),
  ('ko-KR', 'ko-KR-Chirp3-HD-Charon', 'male',   true,  true),
  ('es-ES', 'es-ES-Chirp3-HD-Aoede',  'female', true,  true),
  ('es-ES', 'es-ES-Chirp3-HD-Charon', 'male',   true,  true)
on conflict do nothing;
