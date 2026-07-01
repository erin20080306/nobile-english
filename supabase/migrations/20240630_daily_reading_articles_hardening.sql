-- Daily reading article hardening.
-- Non-destructive follow-up migration for the already-applied 20240629 schema.

ALTER TABLE reading_article_topics
  DROP CONSTRAINT IF EXISTS reading_article_topics_topic_key_key;

ALTER TABLE reading_article_topics
  ADD CONSTRAINT reading_article_topics_publish_date_topic_key_key
  UNIQUE (publish_date, topic_key);

ALTER TABLE reading_article_audio_assets
  ALTER COLUMN audio_version DROP DEFAULT;

ALTER TABLE reading_article_audio_assets
  ALTER COLUMN audio_version TYPE text USING audio_version::text;

ALTER TABLE reading_article_audio_assets
  ALTER COLUMN audio_version SET DEFAULT 'v2_loud';

COMMENT ON COLUMN reading_article_audio_assets.audio_path IS
  'Stable private storage object path copied from tts_audio_assets.audio_path. Never store short-lived signed URLs here.';

CREATE INDEX IF NOT EXISTS idx_reading_article_audio_article_sentence_lang
  ON reading_article_audio_assets(article_id, sentence_id, language_code);

CREATE INDEX IF NOT EXISTS idx_reading_articles_topic_language
  ON reading_articles(topic_id, language_code);

CREATE INDEX IF NOT EXISTS idx_reading_topics_publish_status
  ON reading_article_topics(publish_date, status);

CREATE UNIQUE INDEX IF NOT EXISTS reading_article_lexeme_sentence_span_uidx
  ON reading_article_lexeme_links(article_id, sentence_id, language_code, start_index, end_index, display_text);

CREATE UNIQUE INDEX IF NOT EXISTS reading_article_rewards_uidx
  ON reading_article_rewards(article_id, language_code, reward_type);

ALTER TABLE reading_article_progress
  ADD COLUMN IF NOT EXISTS completed_sentence_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiz_answered_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiz_total_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiz_correct_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_claimed_at timestamptz;

CREATE OR REPLACE FUNCTION claim_reading_article_reward(
  p_user_id uuid,
  p_article_id uuid,
  p_language_code text,
  p_last_sentence_order integer,
  p_completed_sentence_count integer,
  p_quiz_score integer,
  p_quiz_answered_count integer,
  p_quiz_total_count integer,
  p_quiz_correct_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_progress reading_article_progress%rowtype;
  reward_row reading_article_rewards%rowtype;
  garden_state_exists boolean := false;
  garden_row_exists boolean := false;
  now_value timestamptz := now();
BEGIN
  SELECT * INTO existing_progress
  FROM reading_article_progress
  WHERE user_id = p_user_id
    AND article_id = p_article_id
    AND language_code = p_language_code
  FOR UPDATE;

  IF existing_progress.id IS NOT NULL AND existing_progress.is_reward_claimed THEN
    RETURN jsonb_build_object('success', false, 'alreadyClaimed', true);
  END IF;

  IF existing_progress.id IS NULL THEN
    INSERT INTO reading_article_progress (
      user_id,
      article_id,
      language_code,
      started_at,
      completed_at,
      last_sentence_order,
      quiz_score,
      is_reward_claimed,
      reward_claimed_at,
      completed_sentence_count,
      quiz_answered_count,
      quiz_total_count,
      quiz_correct_count,
      updated_at
    )
    VALUES (
      p_user_id,
      p_article_id,
      p_language_code,
      now_value,
      now_value,
      p_last_sentence_order,
      p_quiz_score,
      false,
      null,
      p_completed_sentence_count,
      p_quiz_answered_count,
      p_quiz_total_count,
      p_quiz_correct_count,
      now_value
    )
    RETURNING * INTO existing_progress;
  ELSE
    UPDATE reading_article_progress
    SET completed_at = now_value,
        last_sentence_order = p_last_sentence_order,
        quiz_score = p_quiz_score,
        completed_sentence_count = p_completed_sentence_count,
        quiz_answered_count = p_quiz_answered_count,
        quiz_total_count = p_quiz_total_count,
        quiz_correct_count = p_quiz_correct_count,
        updated_at = now_value
    WHERE id = existing_progress.id
    RETURNING * INTO existing_progress;
  END IF;

  SELECT to_regclass('public.garden_state') IS NOT NULL INTO garden_state_exists;

  IF garden_state_exists THEN
    EXECUTE 'SELECT true FROM public.garden_state WHERE user_id = $1 FOR UPDATE'
      INTO garden_row_exists
      USING p_user_id;
  END IF;

  IF garden_row_exists THEN
    FOR reward_row IN
      SELECT * FROM reading_article_rewards
      WHERE article_id = p_article_id
        AND language_code = p_language_code
    LOOP
      IF reward_row.reward_type = 'coins' THEN
        EXECUTE 'UPDATE public.garden_state SET coins = coalesce(coins, 0) + $1 WHERE user_id = $2'
          USING reward_row.reward_amount, p_user_id;
      ELSIF reward_row.reward_type = 'seeds' THEN
        EXECUTE 'UPDATE public.garden_state SET seeds = coalesce(seeds, 0) + $1 WHERE user_id = $2'
          USING reward_row.reward_amount, p_user_id;
      ELSIF reward_row.reward_type = 'water' THEN
        EXECUTE 'UPDATE public.garden_state SET water = coalesce(water, 0) + $1 WHERE user_id = $2'
          USING reward_row.reward_amount, p_user_id;
      END IF;
    END LOOP;
  END IF;

  UPDATE reading_article_progress
  SET is_reward_claimed = true,
      reward_claimed_at = now_value,
      updated_at = now_value
  WHERE id = existing_progress.id
  RETURNING * INTO existing_progress;

  RETURN jsonb_build_object('success', true, 'alreadyClaimed', false, 'progressId', existing_progress.id);
END;
$$;
