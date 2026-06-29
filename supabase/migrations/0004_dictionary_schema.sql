-- 五語單字卡資料庫 Schema
-- 支援英文、日文、韓文、義大利文、西班牙文

-- Dictionary Entries (主字典表)
CREATE TABLE IF NOT EXISTS dictionary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
  lemma TEXT NOT NULL,
  display_word TEXT NOT NULL,
  reading TEXT,
  romanization TEXT,
  ipa TEXT,
  part_of_speech TEXT,
  definitions_json JSONB,
  definitions_zh_tw_json JSONB,
  examples_json JSONB,
  collocations_json JSONB,
  synonyms_json JSONB,
  antonyms_json JSONB,
  word_family_json JSONB,
  cefr_level TEXT CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  frequency_rank INTEGER,
  topic_tags_json JSONB,
  source_name TEXT,
  source_license TEXT,
  source_attribution TEXT,
  is_ai_enriched BOOLEAN DEFAULT FALSE,
  content_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dictionary Surface Forms (詞形變化表)
CREATE TABLE IF NOT EXISTS dictionary_surface_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
  surface_form TEXT NOT NULL,
  normalized_form TEXT NOT NULL,
  lemma TEXT NOT NULL,
  dictionary_entry_id UUID REFERENCES dictionary_entries(id) ON DELETE CASCADE,
  form_type TEXT CHECK (form_type IN ('inflection', 'conjugation', 'declension', 'variant')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scene Lexeme Links (場景單字片語索引)
CREATE TABLE IF NOT EXISTS scene_lexeme_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id TEXT NOT NULL,
  scene_version INTEGER DEFAULT 1,
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
  sentence_id TEXT NOT NULL,
  start_index INTEGER NOT NULL,
  end_index INTEGER NOT NULL,
  display_text TEXT NOT NULL,
  dictionary_entry_id UUID REFERENCES dictionary_entries(id) ON DELETE SET NULL,
  phrase_priority INTEGER DEFAULT 0, -- 越高優先級越高 (片語優先)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Vocabulary Cards (使用者單字卡)
CREATE TABLE IF NOT EXISTS user_vocabulary_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dictionary_entry_id UUID REFERENCES dictionary_entries(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
  is_saved BOOLEAN DEFAULT FALSE,
  is_learned BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dictionary_entry_id)
);

-- User Vocabulary Reviews (使用者複習紀錄)
CREATE TABLE IF NOT EXISTS user_vocabulary_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dictionary_entry_id UUID REFERENCES dictionary_entries(id) ON DELETE CASCADE,
  next_review_at TIMESTAMPTZ,
  review_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,
  ease_factor FLOAT DEFAULT 2.5,
  last_reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dictionary_entry_id)
);

-- Word Audio Assets (單字音檔資產)
CREATE TABLE IF NOT EXISTS word_audio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dictionary_entry_id UUID REFERENCES dictionary_entries(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
  voice_profile_id TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  audio_version INTEGER DEFAULT 1,
  status TEXT CHECK (status IN ('pending', 'ready', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dictionary Sources (字典來源)
CREATE TABLE IF NOT EXISTS dictionary_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
  source_type TEXT CHECK (source_type IN ('wordnet', 'jmdict', 'kanjidic', 'wiktextract', 'custom')),
  license TEXT,
  attribution TEXT,
  version TEXT,
  last_imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Language Content Packs (語言內容包)
CREATE TABLE IF NOT EXISTS language_content_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
  pack_version INTEGER NOT NULL,
  pack_type TEXT CHECK (pack_type IN ('basic', 'intermediate', 'advanced', 'premium')),
  scene_ids JSONB,
  dictionary_entry_count INTEGER,
  audio_manifest JSONB,
  download_url TEXT,
  file_size_bytes BIGINT,
  is_required BOOLEAN DEFAULT FALSE,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device Sync Metadata (裝置同步元資料)
CREATE TABLE IF NOT EXISTS device_sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')),
  last_sync_at TIMESTAMPTZ,
  sync_version INTEGER DEFAULT 1,
  language_packs_downloaded JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dictionary_entries_language_lemma ON dictionary_entries(language_code, lemma);
CREATE INDEX IF NOT EXISTS idx_dictionary_entries_display_word ON dictionary_entries(display_word);
CREATE INDEX IF NOT EXISTS idx_dictionary_surface_forms_surface ON dictionary_surface_forms(surface_form);
CREATE INDEX IF NOT EXISTS idx_dictionary_surface_forms_normalized ON dictionary_surface_forms(normalized_form);
CREATE INDEX IF NOT EXISTS idx_scene_lexeme_links_scene ON scene_lexeme_links(scene_id, language_code);
CREATE INDEX IF NOT EXISTS idx_scene_lexeme_links_sentence ON scene_lexeme_links(sentence_id);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_cards_user ON user_vocabulary_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_cards_entry ON user_vocabulary_cards(dictionary_entry_id);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_reviews_user ON user_vocabulary_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_reviews_next ON user_vocabulary_reviews(next_review_at);
CREATE INDEX IF NOT EXISTS idx_word_audio_assets_entry ON word_audio_assets(dictionary_entry_id);
CREATE INDEX IF NOT EXISTS idx_language_content_packs_language ON language_content_packs(language_code);
CREATE INDEX IF NOT EXISTS idx_device_sync_metadata_user ON device_sync_metadata(user_id);

-- RLS Policies
ALTER TABLE dictionary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictionary_surface_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_lexeme_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vocabulary_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vocabulary_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_audio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE language_content_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sync_metadata ENABLE ROW LEVEL SECURITY;

-- Public read access for dictionary data
CREATE POLICY "Dictionary entries are publicly readable" ON dictionary_entries
  FOR SELECT USING (true);

CREATE POLICY "Dictionary surface forms are publicly readable" ON dictionary_surface_forms
  FOR SELECT USING (true);

CREATE POLICY "Scene lexeme links are publicly readable" ON scene_lexeme_links
  FOR SELECT USING (true);

CREATE POLICY "Word audio assets are publicly readable" ON word_audio_assets
  FOR SELECT USING (true);

CREATE POLICY "Language content packs are publicly readable" ON language_content_packs
  FOR SELECT USING (true);

-- User-specific policies
CREATE POLICY "Users can view their own vocabulary cards" ON user_vocabulary_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vocabulary cards" ON user_vocabulary_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vocabulary cards" ON user_vocabulary_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vocabulary cards" ON user_vocabulary_cards
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own vocabulary reviews" ON user_vocabulary_reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vocabulary reviews" ON user_vocabulary_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vocabulary reviews" ON user_vocabulary_reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vocabulary reviews" ON user_vocabulary_reviews
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own device sync metadata" ON device_sync_metadata
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own device sync metadata" ON device_sync_metadata
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device sync metadata" ON device_sync_metadata
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device sync metadata" ON device_sync_metadata
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all data (for admin operations)
CREATE POLICY "Service role can manage dictionary entries" ON dictionary_entries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage dictionary surface forms" ON dictionary_surface_forms
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage scene lexeme links" ON scene_lexeme_links
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage word audio assets" ON word_audio_assets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage language content packs" ON language_content_packs
  FOR ALL USING (auth.role() = 'service_role');

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dictionary_entries_updated_at BEFORE UPDATE ON dictionary_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dictionary_surface_forms_updated_at BEFORE UPDATE ON dictionary_surface_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scene_lexeme_links_updated_at BEFORE UPDATE ON scene_lexeme_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_vocabulary_cards_updated_at BEFORE UPDATE ON user_vocabulary_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_vocabulary_reviews_updated_at BEFORE UPDATE ON user_vocabulary_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_word_audio_assets_updated_at BEFORE UPDATE ON word_audio_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_language_content_packs_updated_at BEFORE UPDATE ON language_content_packs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_sync_metadata_updated_at BEFORE UPDATE ON device_sync_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
