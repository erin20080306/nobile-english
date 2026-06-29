// iOS/Android SQLite Schema for Offline Dictionary Cache
// 使用 Capacitor SQLite Plugin

export const SQLITE_SCHEMA = {
  // Cached Dictionary Entries
  cached_dictionary_entries: `
    CREATE TABLE IF NOT EXISTS cached_dictionary_entries (
      id TEXT PRIMARY KEY,
      language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
      lemma TEXT NOT NULL,
      display_word TEXT NOT NULL,
      reading TEXT,
      romanization TEXT,
      ipa TEXT,
      part_of_speech TEXT,
      definitions_json TEXT,
      definitions_zh_tw_json TEXT,
      examples_json TEXT,
      collocations_json TEXT,
      synonyms_json TEXT,
      antonyms_json TEXT,
      word_family_json TEXT,
      cefr_level TEXT CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
      frequency_rank INTEGER,
      topic_tags_json TEXT,
      source_name TEXT,
      source_license TEXT,
      source_attribution TEXT,
      is_ai_enriched INTEGER DEFAULT 0,
      content_version INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );
  `,

  // Cached Surface Forms
  cached_surface_forms: `
    CREATE TABLE IF NOT EXISTS cached_surface_forms (
      id TEXT PRIMARY KEY,
      language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
      surface_form TEXT NOT NULL,
      normalized_form TEXT NOT NULL,
      lemma TEXT NOT NULL,
      dictionary_entry_id TEXT,
      form_type TEXT CHECK (form_type IN ('inflection', 'conjugation', 'declension', 'variant')),
      created_at TEXT,
      updated_at TEXT
    );
  `,

  // Cached Scene Lexeme Links
  cached_scene_lexeme_links: `
    CREATE TABLE IF NOT EXISTS cached_scene_lexeme_links (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL,
      scene_version INTEGER DEFAULT 1,
      language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
      sentence_id TEXT NOT NULL,
      start_index INTEGER NOT NULL,
      end_index INTEGER NOT NULL,
      display_text TEXT NOT NULL,
      dictionary_entry_id TEXT,
      phrase_priority INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `,

  // Cached Word Audio Assets
  cached_word_audio_assets: `
    CREATE TABLE IF NOT EXISTS cached_word_audio_assets (
      id TEXT PRIMARY KEY,
      dictionary_entry_id TEXT,
      language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
      voice_profile_id TEXT NOT NULL,
      audio_path TEXT NOT NULL,
      text_hash TEXT NOT NULL,
      audio_version INTEGER DEFAULT 1,
      status TEXT CHECK (status IN ('pending', 'ready', 'failed')) DEFAULT 'pending',
      created_at TEXT,
      updated_at TEXT
    );
  `,

  // Cached Language Packs
  cached_language_packs: `
    CREATE TABLE IF NOT EXISTS cached_language_packs (
      id TEXT PRIMARY KEY,
      language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
      pack_version INTEGER NOT NULL,
      pack_type TEXT CHECK (pack_type IN ('basic', 'intermediate', 'advanced', 'premium')),
      scene_ids TEXT,
      dictionary_entry_count INTEGER,
      audio_manifest TEXT,
      download_url TEXT,
      file_size_bytes INTEGER,
      is_required INTEGER DEFAULT 0,
      released_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `,

  // Cached User Vocabulary Cards
  cached_user_vocabulary_cards: `
    CREATE TABLE IF NOT EXISTS cached_user_vocabulary_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      dictionary_entry_id TEXT,
      language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
      is_saved INTEGER DEFAULT 0,
      is_learned INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      first_seen_at TEXT,
      last_seen_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `,

  // Cached User Reviews
  cached_user_reviews: `
    CREATE TABLE IF NOT EXISTS cached_user_reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      dictionary_entry_id TEXT,
      next_review_at TEXT,
      review_count INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      incorrect_count INTEGER DEFAULT 0,
      ease_factor REAL DEFAULT 2.5,
      last_reviewed_at TEXT,
      updated_at TEXT
    );
  `,

  // Pending Sync Queue
  pending_sync_queue: `
    CREATE TABLE IF NOT EXISTS pending_sync_queue (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      operation_type TEXT CHECK (operation_type IN ('save_card', 'unsave_card', 'mark_learned', 'mark_review', 'update_progress')),
      entity_type TEXT CHECK (entity_type IN ('vocabulary_card', 'review', 'scene_progress', 'farm_data')),
      entity_id TEXT,
      payload TEXT,
      created_at TEXT,
      retry_count INTEGER DEFAULT 0,
      last_retry_at TEXT,
      status TEXT CHECK (status IN ('pending', 'syncing', 'failed', 'completed')) DEFAULT 'pending'
    );
  `,

  // Cache Metadata
  cache_metadata: `
    CREATE TABLE IF NOT EXISTS cache_metadata (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
  `,

  // Indexes
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_cached_dict_language_lemma ON cached_dictionary_entries(language_code, lemma);',
    'CREATE INDEX IF NOT EXISTS idx_cached_dict_display_word ON cached_dictionary_entries(display_word);',
    'CREATE INDEX IF NOT EXISTS idx_cached_surface_surface ON cached_surface_forms(surface_form);',
    'CREATE INDEX IF NOT EXISTS idx_cached_surface_normalized ON cached_surface_forms(normalized_form);',
    'CREATE INDEX IF NOT EXISTS idx_cached_scene_scene ON cached_scene_lexeme_links(scene_id, language_code);',
    'CREATE INDEX IF NOT EXISTS idx_cached_scene_sentence ON cached_scene_lexeme_links(sentence_id);',
    'CREATE INDEX IF NOT EXISTS idx_cached_audio_entry ON cached_word_audio_assets(dictionary_entry_id);',
    'CREATE INDEX IF NOT EXISTS idx_cached_lang_pack_language ON cached_language_packs(language_code);',
    'CREATE INDEX IF NOT EXISTS idx_cached_user_cards_user ON cached_user_vocabulary_cards(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_cached_user_cards_entry ON cached_user_vocabulary_cards(dictionary_entry_id);',
    'CREATE INDEX IF NOT EXISTS idx_cached_user_reviews_user ON cached_user_reviews(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_cached_user_reviews_next ON cached_user_reviews(next_review_at);',
    'CREATE INDEX IF NOT EXISTS idx_pending_sync_user ON pending_sync_queue(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_pending_sync_status ON pending_sync_queue(status);',
  ],
};

export const SQLITE_INITIAL_DATA = {
  // Cache metadata initial values
  cache_metadata: [
    { key: 'schema_version', value: '1', updated_at: new Date().toISOString() },
    { key: 'last_sync_at', value: '', updated_at: new Date().toISOString() },
    { key: 'current_language', value: 'en', updated_at: new Date().toISOString() },
  ],
};
