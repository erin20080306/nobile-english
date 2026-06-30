-- Dictionary review pool lookup support.
-- Idempotent and safe for existing dictionary/user review data.

CREATE INDEX IF NOT EXISTS idx_dictionary_entries_language_rank
  ON dictionary_entries(language_code, frequency_rank)
  WHERE frequency_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dictionary_entries_language_cefr_rank
  ON dictionary_entries(language_code, cefr_level, frequency_rank)
  WHERE frequency_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dictionary_entries_language_display
  ON dictionary_entries(language_code, display_word);
