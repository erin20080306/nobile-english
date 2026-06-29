-- 每日五語閱讀文章功能
-- Migration: 20240629_daily_reading_articles

-- 1. 文章主題表
CREATE TABLE IF NOT EXISTS reading_article_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_date DATE NOT NULL UNIQUE,
  topic_key TEXT NOT NULL UNIQUE,
  topic_title_zh_tw TEXT NOT NULL,
  topic_category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, ready, published, cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 文章表
CREATE TABLE IF NOT EXISTS reading_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES reading_article_topics(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'ja', 'ko', 'it', 'es')),
  title TEXT NOT NULL,
  title_zh_tw TEXT NOT NULL,
  article_text TEXT NOT NULL,
  difficulty_level TEXT NOT NULL CHECK (difficulty_level IN ('A1', 'A2', 'B1')),
  estimated_reading_seconds INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('original_ai', 'editor_written', 'licensed_external', 'public_domain')),
  source_name TEXT,
  source_url TEXT,
  source_license TEXT,
  source_attribution TEXT,
  content_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, ready, published, archived
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(topic_id, language_code)
);

-- 3. 文章句子表
CREATE TABLE IF NOT EXISTS reading_article_sentences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES reading_articles(id) ON DELETE CASCADE,
  sentence_order INTEGER NOT NULL,
  sentence_text TEXT NOT NULL,
  sentence_zh_tw TEXT NOT NULL,
  sentence_type TEXT NOT NULL DEFAULT 'body' CHECK (sentence_type IN ('title', 'body', 'summary', 'tip')),
  estimated_duration_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_id, sentence_order)
);

-- 4. 文章詞形連結表
CREATE TABLE IF NOT EXISTS reading_article_lexeme_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES reading_articles(id) ON DELETE CASCADE,
  sentence_id UUID NOT NULL REFERENCES reading_article_sentences(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  start_index INTEGER NOT NULL,
  end_index INTEGER NOT NULL,
  display_text TEXT NOT NULL,
  dictionary_entry_id UUID REFERENCES dictionary_entries(id) ON DELETE SET NULL,
  phrase_priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 文章音檔資產表
CREATE TABLE IF NOT EXISTS reading_article_audio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES reading_articles(id) ON DELETE CASCADE,
  sentence_id UUID REFERENCES reading_article_sentences(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  tts_asset_id UUID REFERENCES tts_audio_assets(id) ON DELETE SET NULL,
  audio_path TEXT,
  duration_ms INTEGER,
  audio_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, ready, failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_id, sentence_id, language_code)
);

-- 6. 文章問題表
CREATE TABLE IF NOT EXISTS reading_article_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES reading_articles(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'sentence_order', 'word_match', 'true_false', 'fill_in_blank')),
  question_text TEXT NOT NULL,
  options_json JSONB NOT NULL,
  correct_answer_json JSONB NOT NULL,
  explanation_zh_tw TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_id, question_order)
);

-- 7. 文章閱讀進度表
CREATE TABLE IF NOT EXISTS reading_article_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES reading_articles(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_sentence_order INTEGER NOT NULL DEFAULT 0,
  reading_speed INTEGER, -- 字元/分鐘
  quiz_score INTEGER,
  is_reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, article_id, language_code)
);

-- 8. 文章獎勵表
CREATE TABLE IF NOT EXISTS reading_article_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES reading_articles(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('coins', 'seeds', 'water', 'crop')),
  reward_amount INTEGER NOT NULL,
  crop_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. 每日文章生成成本記錄表
CREATE TABLE IF NOT EXISTS daily_article_generation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_date DATE NOT NULL,
  language_code TEXT NOT NULL,
  article_id UUID REFERENCES reading_articles(id) ON DELETE SET NULL,
  gemini_input_tokens INTEGER NOT NULL DEFAULT 0,
  gemini_output_tokens INTEGER NOT NULL DEFAULT 0,
  tts_character_count INTEGER NOT NULL DEFAULT 0,
  tts_cache_hit_count INTEGER NOT NULL DEFAULT 0,
  tts_cache_miss_count INTEGER NOT NULL DEFAULT 0,
  word_audio_cache_miss_count INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(publish_date, language_code)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_reading_article_topics_publish_date ON reading_article_topics(publish_date);
CREATE INDEX IF NOT EXISTS idx_reading_article_topics_status ON reading_article_topics(status);
CREATE INDEX IF NOT EXISTS idx_reading_articles_topic_id ON reading_articles(topic_id);
CREATE INDEX IF NOT EXISTS idx_reading_articles_language_code ON reading_articles(language_code);
CREATE INDEX IF NOT EXISTS idx_reading_articles_status ON reading_articles(status);
CREATE INDEX IF NOT EXISTS idx_reading_articles_published_at ON reading_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_reading_article_sentences_article_id ON reading_article_sentences(article_id);
CREATE INDEX IF NOT EXISTS idx_reading_article_lexeme_links_article_id ON reading_article_lexeme_links(article_id);
CREATE INDEX IF NOT EXISTS idx_reading_article_lexeme_links_sentence_id ON reading_article_lexeme_links(sentence_id);
CREATE INDEX IF NOT EXISTS idx_reading_article_lexeme_links_dictionary_entry_id ON reading_article_lexeme_links(dictionary_entry_id);
CREATE INDEX IF NOT EXISTS idx_reading_article_audio_assets_article_id ON reading_article_audio_assets(article_id);
CREATE INDEX IF NOT EXISTS idx_reading_article_audio_assets_sentence_id ON reading_article_audio_assets(sentence_id);
CREATE INDEX IF NOT EXISTS idx_reading_article_questions_article_id ON reading_article_questions(article_id);
CREATE INDEX IF NOT EXISTS idx_reading_article_progress_user_id ON reading_article_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_article_progress_article_id ON reading_article_progress(article_id);
CREATE INDEX IF NOT EXISTS idx_reading_article_rewards_article_id ON reading_article_rewards(article_id);
CREATE INDEX IF NOT EXISTS idx_daily_article_generation_log_publish_date ON daily_article_generation_log(publish_date);
CREATE INDEX IF NOT EXISTS idx_daily_article_generation_log_language_code ON daily_article_generation_log(language_code);

-- Row Level Security (RLS)
ALTER TABLE reading_article_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_article_sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_article_lexeme_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_article_audio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_article_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_article_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_article_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_article_generation_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- reading_article_topics: 只有服務角色和管理者可以讀寫
CREATE POLICY "Service role can manage reading_article_topics" ON reading_article_topics
  FOR ALL USING (auth.role() = 'service_role');

-- reading_articles: 只有服務角色和管理者可以讀寫，已發布的文章所有人可讀
CREATE POLICY "Service role can manage reading_articles" ON reading_articles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Published articles are readable by everyone" ON reading_articles
  FOR SELECT USING (status = 'published');

-- reading_article_sentences: 只有服務角色和管理者可以讀寫，已發布文章的句子所有人可讀
CREATE POLICY "Service role can manage reading_article_sentences" ON reading_article_sentences
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Sentences from published articles are readable by everyone" ON reading_article_sentences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reading_articles 
      WHERE reading_articles.id = reading_article_sentences.article_id 
      AND reading_articles.status = 'published'
    )
  );

-- reading_article_lexeme_links: 只有服務角色和管理者可以讀寫，已發布文章的連結所有人可讀
CREATE POLICY "Service role can manage reading_article_lexeme_links" ON reading_article_lexeme_links
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Lexeme links from published articles are readable by everyone" ON reading_article_lexeme_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reading_articles 
      WHERE reading_articles.id = reading_article_lexeme_links.article_id 
      AND reading_articles.status = 'published'
    )
  );

-- reading_article_audio_assets: 只有服務角色和管理者可以讀寫，已發布文章的音檔所有人可讀
CREATE POLICY "Service role can manage reading_article_audio_assets" ON reading_article_audio_assets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Audio assets from published articles are readable by everyone" ON reading_article_audio_assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reading_articles 
      WHERE reading_articles.id = reading_article_audio_assets.article_id 
      AND reading_articles.status = 'published'
    )
  );

-- reading_article_questions: 只有服務角色和管理者可以讀寫，已發布文章的問題所有人可讀
CREATE POLICY "Service role can manage reading_article_questions" ON reading_article_questions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Questions from published articles are readable by everyone" ON reading_article_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reading_articles 
      WHERE reading_articles.id = reading_article_questions.article_id 
      AND reading_articles.status = 'published'
    )
  );

-- reading_article_progress: 使用者只能讀寫自己的進度
CREATE POLICY "Users can read their own reading progress" ON reading_article_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reading progress" ON reading_article_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading progress" ON reading_article_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- reading_article_rewards: 只有服務角色和管理者可以讀寫
CREATE POLICY "Service role can manage reading_article_rewards" ON reading_article_rewards
  FOR ALL USING (auth.role() = 'service_role');

-- daily_article_generation_log: 只有服務角色和管理者可以讀寫
CREATE POLICY "Service role can manage daily_article_generation_log" ON daily_article_generation_log
  FOR ALL USING (auth.role() = 'service_role');

-- 更新時間戳觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reading_article_topics_updated_at BEFORE UPDATE ON reading_article_topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_articles_updated_at BEFORE UPDATE ON reading_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_article_sentences_updated_at BEFORE UPDATE ON reading_article_sentences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_article_lexeme_links_updated_at BEFORE UPDATE ON reading_article_lexeme_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_article_audio_assets_updated_at BEFORE UPDATE ON reading_article_audio_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_article_questions_updated_at BEFORE UPDATE ON reading_article_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_article_progress_updated_at BEFORE UPDATE ON reading_article_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
