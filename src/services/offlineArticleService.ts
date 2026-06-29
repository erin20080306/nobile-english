/**
 * 離線文章下載與同步服務
 * 
 * 處理：
 * - 文章內容離線快取
 * - 音檔 manifest 下載
 * - 單字卡與片語卡快取
 * - 閱讀進度同步
 * - 離線狀態管理
 */

import { READING_ARTICLES_SQL_SCHEMA, READING_ARTICLES_CLEANUP_SQL } from '@/db/sqlite-reading-articles-schema';
import type { ReadingArticle, LearningLanguageCode } from '@/types';

interface OfflineReadingArticle extends ReadingArticle {
  sentences: {
    id: string;
    sentence_order: number;
    sentence_text: string;
    sentence_zh_tw: string;
    estimated_duration_ms?: number;
    audio_url?: string;
  }[];
}

class OfflineArticleService {
  private db: any = null;
  private isInitialized = false;

  /**
   * 初始化 SQLite 資料庫
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // TODO: 初始化 SQLite 資料庫連線
      // const { open } = await import('better-sqlite3');
      // this.db = open('offline-articles.db');
      
      // 執行 schema
      // this.db.exec(READING_ARTICLES_SQL_SCHEMA);
      
      this.isInitialized = true;
      console.log('[OfflineArticleService] Initialized');
    } catch (error) {
      console.error('[OfflineArticleService] Initialization failed:', error);
    }
  }

  /**
   * 下載今日文章到離線
   */
  async downloadTodayArticle(languageCode: LearningLanguageCode): Promise<void> {
    await this.initialize();

    try {
      const response = await fetch(`/api/articles/today?language=${languageCode}`);
      if (!response.ok) {
        throw new Error('Failed to fetch today article');
      }

      const article: OfflineReadingArticle = await response.json();
      await this.cacheArticle(article, languageCode);
      
      console.log('[OfflineArticleService] Downloaded today article:', article.id);
    } catch (error) {
      console.error('[OfflineArticleService] Download failed:', error);
    }
  }

  /**
   * 快取文章到 SQLite
   */
  private async cacheArticle(article: OfflineReadingArticle, languageCode: LearningLanguageCode): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 天

    // 快取文章主資料
    this.db.prepare(`
      INSERT OR REPLACE INTO cached_reading_articles 
      (id, topic_id, language_code, title, title_zh_tw, article_text, difficulty_level, 
       estimated_reading_seconds, source_type, content_version, status, published_at, 
       cached_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      article.id,
      article.topic_id,
      languageCode,
      article.title,
      article.title_zh_tw,
      article.article_text,
      article.difficulty_level,
      article.estimated_reading_seconds,
      article.source_type,
      article.content_version,
      article.status,
      article.published_at || null,
      now,
      expiresAt
    );

    // 快取句子
    for (const sentence of article.sentences) {
      this.db.prepare(`
        INSERT OR REPLACE INTO cached_reading_article_sentences
        (id, article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms, cached_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sentence.id,
        article.id,
        sentence.sentence_order,
        sentence.sentence_text,
        sentence.sentence_zh_tw,
        'body',
        sentence.estimated_duration_ms || 0,
        now
      );
    }

    // 快取音檔 manifest
    const audioManifest = {
      sentences: article.sentences.map(s => ({
        id: s.id,
        audio_url: (s as any).audio_url || null,
      })),
    };

    this.db.prepare(`
      INSERT OR REPLACE INTO cached_reading_article_audio_manifest
      (id, article_id, language_code, audio_manifest_json, cached_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `manifest-${article.id}`,
      article.id,
      languageCode,
      JSON.stringify(audioManifest),
      now,
      expiresAt
    );
  }

  /**
   * 從離線快取取得文章
   */
  async getOfflineArticle(articleId: string): Promise<OfflineReadingArticle | null> {
    await this.initialize();

    if (!this.db) return null;

    try {
      // 檢查是否過期
      const article = this.db.prepare(`
        SELECT * FROM cached_reading_articles 
        WHERE id = ? AND expires_at > datetime('now')
      `).get(articleId);

      if (!article) return null;

      // 取得句子
      const sentences = this.db.prepare(`
        SELECT * FROM cached_reading_article_sentences
        WHERE article_id = ?
        ORDER BY sentence_order
      `).all(articleId);

      // 取得音檔 manifest
      const manifest = this.db.prepare(`
        SELECT audio_manifest_json FROM cached_reading_article_audio_manifest
        WHERE article_id = ? AND expires_at > datetime('now')
      `).get(articleId);

      const audioManifest = manifest ? JSON.parse(manifest.audio_manifest_json) : null;

      // 組合音檔 URL
      const sentencesWithAudio = sentences.map((s: any) => ({
        ...s,
        audio_url: audioManifest?.sentences.find((a: any) => a.id === s.id)?.audio_url || null,
      }));

      return {
        ...article,
        sentences: sentencesWithAudio,
      } as OfflineReadingArticle;
    } catch (error) {
      console.error('[OfflineArticleService] Get offline article failed:', error);
      return null;
    }
  }

  /**
   * 同步閱讀進度到 Supabase
   */
  async syncProgress(): Promise<void> {
    await this.initialize();

    if (!this.db) return;

    try {
      // 取得未同步的進度
      const pendingProgress = this.db.prepare(`
        SELECT * FROM cached_reading_article_progress
        WHERE is_synced = 0
      `).all();

      for (const progress of pendingProgress) {
        try {
          const response = await fetch('/api/articles/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('supabase_token') || ''}`,
            },
            body: JSON.stringify({
              articleId: progress.article_id,
              languageCode: progress.language_code,
              quizScore: progress.quiz_score,
            }),
          });

          if (response.ok) {
            // 標記為已同步
            this.db.prepare(`
              UPDATE cached_reading_article_progress
              SET is_synced = 1
              WHERE id = ?
            `).run(progress.id);
          }
        } catch (error) {
          console.error('[OfflineArticleService] Sync progress failed:', error);
        }
      }
    } catch (error) {
      console.error('[OfflineArticleService] Sync progress failed:', error);
    }
  }

  /**
   * 清理過期的快取
   */
  async cleanupExpiredCache(): Promise<void> {
    await this.initialize();

    if (!this.db) return;

    try {
      this.db.exec(READING_ARTICLES_CLEANUP_SQL);
      console.log('[OfflineArticleService] Cleaned expired cache');
    } catch (error) {
      console.error('[OfflineArticleService] Cleanup failed:', error);
    }
  }

  /**
   * 檢查是否有離線版本
   */
  async hasOfflineVersion(articleId: string): Promise<boolean> {
    await this.initialize();

    if (!this.db) return false;

    try {
      const article = this.db.prepare(`
        SELECT id FROM cached_reading_articles
        WHERE id = ? AND expires_at > datetime('now')
      `).get(articleId);

      return !!article;
    } catch (error) {
      return false;
    }
  }

  /**
   * 取得快取大小
   */
  async getCacheSize(): Promise<number> {
    await this.initialize();

    if (!this.db) return 0;

    try {
      const result = this.db.prepare(`
        SELECT COUNT(*) as count FROM cached_reading_articles
        WHERE expires_at > datetime('now')
      `).get();

      return result?.count || 0;
    } catch (error) {
      return 0;
    }
  }
}

// 單例
export const offlineArticleService = new OfflineArticleService();
