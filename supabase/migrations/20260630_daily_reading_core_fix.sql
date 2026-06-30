-- Daily reading core fixes. This is additive / non-destructive and is safe to
-- apply after 20240629_daily_reading_articles.sql.

-- topic_key is a reusable topic label (for example ordering_coffee), not a
-- global unique identifier. The date remains the one-topic-per-day constraint.
ALTER TABLE reading_article_topics
  DROP CONSTRAINT IF EXISTS reading_article_topics_topic_key_key;

CREATE INDEX IF NOT EXISTS idx_reading_article_topics_publish_status
  ON reading_article_topics (publish_date, status);

-- A lexeme link is rebuilt during prewarm. The unique index makes reruns safe
-- without manually inventing non-UUID ids in application code.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reading_article_lexeme_range
  ON reading_article_lexeme_links (article_id, sentence_id, start_index, end_index, display_text);

CREATE INDEX IF NOT EXISTS idx_reading_article_audio_sentence_language
  ON reading_article_audio_assets (article_id, sentence_id, language_code, status);

-- Publishing can be retried; each published article must only define each reward
-- once. This lets the API use upsert instead of creating duplicate reward rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reading_article_reward_kind
  ON reading_article_rewards (article_id, language_code, reward_type);

COMMENT ON COLUMN reading_article_audio_assets.audio_path IS
  'Stable provider/storage object path only. Never persist a short-lived signed URL here.';
