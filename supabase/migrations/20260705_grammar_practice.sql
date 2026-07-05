-- Grammar practice (drag-to-order sentence builder).
--
-- Sentences are sourced from the app's existing dictionary example sentences
-- and scene dialogue lines. For non-English target languages, English scene
-- sentences are translated once via Gemini and the result is cached here
-- forever, so repeat requests from any learner reuse the cached row instead
-- of calling Gemini again (this is the "reduce API calls" caching layer).

create table if not exists grammar_exercise_cache (
  id uuid primary key default gen_random_uuid(),
  language_code text not null,
  level text not null,
  source text not null default 'dictionary',
  sentence_key text not null,
  text_target text not null,
  text_zh text not null,
  tokens jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists grammar_exercise_cache_uidx
  on grammar_exercise_cache (language_code, sentence_key);

create index if not exists grammar_exercise_cache_lookup_idx
  on grammar_exercise_cache (language_code, level);

drop trigger if exists grammar_exercise_cache_set_updated_at on grammar_exercise_cache;
create trigger grammar_exercise_cache_set_updated_at
  before update on grammar_exercise_cache
  for each row execute function set_updated_at();

alter table grammar_exercise_cache enable row level security;

grant select on grammar_exercise_cache to anon, authenticated;
grant all on grammar_exercise_cache to service_role;

drop policy if exists "Anyone can read grammar exercises" on grammar_exercise_cache;
create policy "Anyone can read grammar exercises" on grammar_exercise_cache
  for select using (true);

-- Allow the existing learning_records sync route to accept grammar practice
-- sessions alongside scene/dialogue/word review records.
do $$ begin
  alter type learning_record_type add value if not exists 'grammar';
exception when duplicate_object then null; end $$;
