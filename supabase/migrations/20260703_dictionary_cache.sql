-- Dictionary Cache Table for Public Dictionary API
-- Caches results from external dictionary APIs to reduce API calls

CREATE TABLE IF NOT EXISTS dictionary_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL CHECK (language IN ('en', 'ja', 'ko', 'it', 'es', 'zh')),
  normalized_word TEXT NOT NULL,
  entry_json JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('free_dictionary', 'jmdict', 'urimal_saem', 'wiktionary', 'merriam_webster', 'local')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(language, normalized_word)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_language_word ON dictionary_cache(language, normalized_word);
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_expires_at ON dictionary_cache(expires_at);

-- RLS Policy
ALTER TABLE dictionary_cache ENABLE ROW LEVEL SECURITY;

-- Service role can manage cache (for API routes)
CREATE POLICY "Service role can manage dictionary cache" ON dictionary_cache
  FOR ALL USING (true)
  WITH CHECK (true);

-- Public read access for cache entries
CREATE POLICY "Dictionary cache is publicly readable" ON dictionary_cache
  FOR SELECT USING (true);

-- Updated at trigger
CREATE TRIGGER update_dictionary_cache_updated_at BEFORE UPDATE ON dictionary_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_dictionary_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM dictionary_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to service role
GRANT ALL ON dictionary_cache TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant read permissions to anon role (public access)
GRANT SELECT ON dictionary_cache TO anon;
