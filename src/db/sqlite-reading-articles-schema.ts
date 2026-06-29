/**
 * SQLite 離線閱讀文章資料表 Schema
 * 
 * 用於離線快取每日閱讀文章內容
 */

export const READING_ARTICLES_SQL_SCHEMA = `
-- 快取文章表
CREATE TABLE IF NOT EXISTS cached_reading_articles (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  title TEXT NOT NULL,
  title_zh_tw TEXT NOT NULL,
  article_text TEXT NOT NULL,
  difficulty_level TEXT NOT NULL,
  estimated_reading_seconds INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  content_version INTEGER NOT NULL,
  status TEXT NOT NULL,
  published_at TEXT,
  cached_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- 快取文章句子表
CREATE TABLE IF NOT EXISTS cached_reading_article_sentences (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  sentence_order INTEGER NOT NULL,
  sentence_text TEXT NOT NULL,
  sentence_zh_tw TEXT NOT NULL,
  sentence_type TEXT NOT NULL,
  estimated_duration_ms INTEGER NOT NULL,
  cached_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES cached_reading_articles(id) ON DELETE CASCADE
);

-- 快取文章詞形連結表
CREATE TABLE IF NOT EXISTS cached_reading_article_lexeme_links (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  sentence_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  start_index INTEGER NOT NULL,
  end_index INTEGER NOT NULL,
  display_text TEXT NOT NULL,
  dictionary_entry_id TEXT,
  phrase_priority INTEGER NOT NULL,
  cached_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES cached_reading_articles(id) ON DELETE CASCADE,
  FOREIGN KEY (sentence_id) REFERENCES cached_reading_article_sentences(id) ON DELETE CASCADE
);

-- 快取文章問題表
CREATE TABLE IF NOT EXISTS cached_reading_article_questions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_answer_json TEXT NOT NULL,
  explanation_zh_tw TEXT NOT NULL,
  cached_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES cached_reading_articles(id) ON DELETE CASCADE
);

-- 快取文章音檔 manifest 表
CREATE TABLE IF NOT EXISTS cached_reading_article_audio_manifest (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  audio_manifest_json TEXT NOT NULL,
  cached_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES cached_reading_articles(id) ON DELETE CASCADE
);

-- 快取文章閱讀進度表
CREATE TABLE IF NOT EXISTS cached_reading_article_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  last_sentence_order INTEGER NOT NULL,
  reading_speed INTEGER,
  quiz_score INTEGER,
  is_reward_claimed INTEGER NOT NULL DEFAULT 0,
  is_synced INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES cached_reading_articles(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cached_reading_articles_language_code ON cached_reading_articles(language_code);
CREATE INDEX IF NOT EXISTS idx_cached_reading_articles_status ON cached_reading_articles(status);
CREATE INDEX IF NOT EXISTS idx_cached_reading_articles_cached_at ON cached_reading_articles(cached_at);
CREATE INDEX IF NOT EXISTS idx_cached_reading_articles_expires_at ON cached_reading_articles(expires_at);

CREATE INDEX IF NOT EXISTS idx_cached_reading_article_sentences_article_id ON cached_reading_article_sentences(article_id);
CREATE INDEX IF NOT EXISTS idx_cached_reading_article_sentences_sentence_order ON cached_reading_article_sentences(sentence_order);

CREATE INDEX IF NOT EXISTS idx_cached_reading_article_lexeme_links_article_id ON cached_reading_article_lexeme_links(article_id);
CREATE INDEX IF NOT EXISTS idx_cached_reading_article_lexeme_links_sentence_id ON cached_reading_article_lexeme_links(sentence_id);
CREATE INDEX IF NOT EXISTS idx_cached_reading_article_lexeme_links_dictionary_entry_id ON cached_reading_article_lexeme_links(dictionary_entry_id);

CREATE INDEX IF NOT EXISTS idx_cached_reading_article_questions_article_id ON cached_reading_article_questions(article_id);
CREATE INDEX IF NOT EXISTS idx_cached_reading_article_questions_question_order ON cached_reading_article_questions(question_order);

CREATE INDEX IF NOT EXISTS idx_cached_reading_article_audio_manifest_article_id ON cached_reading_article_audio_manifest(article_id);
CREATE INDEX IF NOT EXISTS idx_cached_reading_article_audio_manifest_expires_at ON cached_reading_article_audio_manifest(expires_at);

CREATE INDEX IF NOT EXISTS idx_cached_reading_article_progress_user_id ON cached_reading_article_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_cached_reading_article_progress_article_id ON cached_reading_article_progress(article_id);
CREATE INDEX IF NOT EXISTS idx_cached_reading_article_progress_is_synced ON cached_reading_article_progress(is_synced);
`;

export const READING_ARTICLES_CLEANUP_SQL = `
-- 清理過期的快取
DELETE FROM cached_reading_articles WHERE expires_at < datetime('now');
DELETE FROM cached_reading_article_audio_manifest WHERE expires_at < datetime('now');
`;

export const READING_ARTICLES_SYNC_SQL = `
-- 同步未同步的進度到 Supabase
SELECT * FROM cached_reading_article_progress WHERE is_synced = 0;
`;
