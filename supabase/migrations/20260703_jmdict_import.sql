-- JMdict (Japanese-English Dictionary) Import Table
-- Based on the JMdict/EDICT project from the Electronic Dictionary Research and Development Group
-- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
-- Source: https://www.edrdg.org/jmdict/j_jmdict.html

CREATE TABLE IF NOT EXISTS jmdict_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_seq INTEGER NOT NULL UNIQUE, -- JMdict entry sequence number
  kanji_elements TEXT[], -- Array of kanji representations (e.g., ["日本", "日"])
  reading_elements TEXT[], -- Array of kana readings (e.g., ["にほん", "にっぽん"])
  readings_json JSONB, -- Detailed reading information with type (kun/on/nanori)
  pos_tags TEXT[], -- Part of speech tags (e.g., ["n", "vs", "adj"])
  fields TEXT[], -- Field of application (e.g., ["Buddhism", "linguistics"])
  misc_info TEXT[], -- Miscellaneous information (e.g., ["uk", "io"])
  senses_json JSONB, -- Array of sense objects with glosses and language info
  priority INTEGER, -- Priority score (higher = more common word)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jmdict_entries_kanji ON jmdict_entries USING GIN(kanji_elements);
CREATE INDEX IF NOT EXISTS idx_jmdict_entries_reading ON jmdict_entries USING GIN(reading_elements);
CREATE INDEX IF NOT EXISTS idx_jmdict_entries_priority ON jmdict_entries(priority DESC);
CREATE INDEX IF NOT EXISTS idx_jmdict_entries_seq ON jmdict_entries(entry_seq);

-- RLS Policy
ALTER TABLE jmdict_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "JMdict entries are publicly readable" ON jmdict_entries;
DROP POLICY IF EXISTS "Service role can manage JMdict entries" ON jmdict_entries;

-- Public read access for JMdict data
CREATE POLICY "JMdict entries are publicly readable" ON jmdict_entries
  FOR SELECT USING (true);

-- Service role can manage JMdict entries (bypasses RLS)
CREATE POLICY "Service role can manage JMdict entries" ON jmdict_entries
  FOR ALL USING (true)
  WITH CHECK (true);

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_jmdict_entries_updated_at ON jmdict_entries;

-- Updated at trigger
CREATE TRIGGER update_jmdict_entries_updated_at BEFORE UPDATE ON jmdict_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to search JMdict by kanji or reading
CREATE OR REPLACE FUNCTION search_jmdict(
  search_term TEXT,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  entry_seq INTEGER,
  kanji_elements TEXT[],
  reading_elements TEXT[],
  pos_tags TEXT[],
  senses_json JSONB,
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    je.id,
    je.entry_seq,
    je.kanji_elements,
    je.reading_elements,
    je.pos_tags,
    je.senses_json,
    je.priority
  FROM jmdict_entries je
  WHERE 
    search_term = ANY(je.kanji_elements) OR
    search_term = ANY(je.reading_elements) OR
    search_term = ANY(je.reading_elements) -- Fuzzy match could be added here
  ORDER BY je.priority DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Comment on table
COMMENT ON TABLE jmdict_entries IS 'JMdict Japanese-English dictionary entries from EDICT project (CC BY-SA 4.0)';

-- Grant permissions to service role
GRANT ALL ON jmdict_entries TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant read permissions to anon role (public access)
GRANT SELECT ON jmdict_entries TO anon;
