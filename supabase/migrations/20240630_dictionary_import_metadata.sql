-- Dictionary import metadata and lookup safety.
-- This migration is idempotent and does not touch user vocabulary or review records.

ALTER TABLE dictionary_entries
  ADD COLUMN IF NOT EXISTS source_version TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dictionary_entries_source_name
  ON dictionary_entries(source_name);

CREATE INDEX IF NOT EXISTS idx_dictionary_entries_imported_at
  ON dictionary_entries(imported_at);

CREATE INDEX IF NOT EXISTS idx_dictionary_surface_forms_language_lookup
  ON dictionary_surface_forms(language_code, normalized_form, lemma);
