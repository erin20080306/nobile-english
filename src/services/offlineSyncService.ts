import { sqliteService } from './sqliteService';

export interface VocabularyCard {
  id: string;
  user_id: string;
  dictionary_entry_id: string;
  language_code: string;
  is_saved: boolean;
  is_learned: boolean;
  is_hidden: boolean;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface VocabularyReview {
  id: string;
  user_id: string;
  dictionary_entry_id: string;
  next_review_at: string;
  review_count: number;
  correct_count: number;
  incorrect_count: number;
  ease_factor: number;
  last_reviewed_at: string;
  updated_at: string;
}

export class OfflineSyncService {
  private isOnline = true;
  private syncInProgress = false;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * 設定線上狀態
   */
  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
    if (online && !this.syncInProgress) {
      this.syncPendingItems();
    }
  }

  /**
   * 開始自動同步
   */
  startAutoSync(intervalMs: number = 60000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncPendingItems();
      }
    }, intervalMs);
  }

  /**
   * 停止自動同步
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 離線收藏單字
   */
  async saveVocabularyCard(
    userId: string,
    dictionaryEntryId: string,
    languageCode: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const id = `card_${userId}_${dictionaryEntryId}`;

      // 更新 SQLite
      await sqliteService.cacheSceneLexemeLinks([
        {
          id,
          scene_id: 'vocabulary_card',
          scene_version: 1,
          language_code: languageCode,
          sentence_id: userId,
          start_index: 0,
          end_index: 0,
          display_text: dictionaryEntryId,
          dictionary_entry_id: dictionaryEntryId,
          phrase_priority: 0,
          created_at: now,
          updated_at: now,
        },
      ]);

      // 加入同步佇列
      await sqliteService.addToSyncQueue({
        user_id: userId,
        operation_type: 'save_card',
        entity_type: 'vocabulary_card',
        entity_id: id,
        payload: {
          dictionary_entry_id: dictionaryEntryId,
          language_code: languageCode,
          is_saved: true,
        },
      });

      // 若線上，立即同步
      if (this.isOnline) {
        await this.syncPendingItems();
      }
    } catch (error) {
      console.error('Failed to save vocabulary card:', error);
    }
  }

  /**
   * 離線取消收藏單字
   */
  async unsaveVocabularyCard(
    userId: string,
    dictionaryEntryId: string
  ): Promise<void> {
    try {
      const id = `card_${userId}_${dictionaryEntryId}`;

      // 加入同步佇列
      await sqliteService.addToSyncQueue({
        user_id: userId,
        operation_type: 'unsave_card',
        entity_type: 'vocabulary_card',
        entity_id: id,
        payload: {
          dictionary_entry_id: dictionaryEntryId,
          is_saved: false,
        },
      });

      // 若線上，立即同步
      if (this.isOnline) {
        await this.syncPendingItems();
      }
    } catch (error) {
      console.error('Failed to unsave vocabulary card:', error);
    }
  }

  /**
   * 離線標記單字為已學習
   */
  async markAsLearned(
    userId: string,
    dictionaryEntryId: string
  ): Promise<void> {
    try {
      const id = `card_${userId}_${dictionaryEntryId}`;

      // 加入同步佇列
      await sqliteService.addToSyncQueue({
        user_id: userId,
        operation_type: 'mark_learned',
        entity_type: 'vocabulary_card',
        entity_id: id,
        payload: {
          dictionary_entry_id: dictionaryEntryId,
          is_learned: true,
        },
      });

      // 若線上，立即同步
      if (this.isOnline) {
        await this.syncPendingItems();
      }
    } catch (error) {
      console.error('Failed to mark as learned:', error);
    }
  }

  /**
   * 離線記錄複習結果
   */
  async recordReview(
    userId: string,
    dictionaryEntryId: string,
    isCorrect: boolean
  ): Promise<void> {
    try {
      const id = `review_${userId}_${dictionaryEntryId}`;
      const now = new Date().toISOString();

      // 加入同步佇列
      await sqliteService.addToSyncQueue({
        user_id: userId,
        operation_type: 'mark_review',
        entity_type: 'vocabulary_review',
        entity_id: id,
        payload: {
          dictionary_entry_id: dictionaryEntryId,
          is_correct: isCorrect,
          reviewed_at: now,
        },
      });

      // 若線上，立即同步
      if (this.isOnline) {
        await this.syncPendingItems();
      }
    } catch (error) {
      console.error('Failed to record review:', error);
    }
  }

  /**
   * 同步待處理項目
   */
  private async syncPendingItems(): Promise<void> {
    if (this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;

    try {
      // 獲取當前使用者 ID（從 auth service 或 context）
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return;
      }

      // 獲取待同步項目
      const pendingItems = await sqliteService.getPendingSyncItems(userId);

      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          await sqliteService.markSyncItemCompleted(item.id);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          // 標記為失敗，稍後重試
          await this.markSyncItemFailed(item.id);
        }
      }
    } catch (error) {
      console.error('Failed to sync pending items:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 同步單個項目
   */
  private async syncItem(item: any): Promise<void> {
    const payload = JSON.parse(item.payload);

    switch (item.operation_type) {
      case 'save_card':
        await this.syncSaveCard(item.user_id, payload);
        break;
      case 'unsave_card':
        await this.syncUnsaveCard(item.user_id, payload);
        break;
      case 'mark_learned':
        await this.syncMarkLearned(item.user_id, payload);
        break;
      case 'mark_review':
        await this.syncMarkReview(item.user_id, payload);
        break;
      default:
        console.warn(`Unknown operation type: ${item.operation_type}`);
    }
  }

  /**
   * 同步收藏單字
   */
  private async syncSaveCard(userId: string, payload: any): Promise<void> {
    const response = await fetch('/api/vocabulary/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        dictionary_entry_id: payload.dictionary_entry_id,
        language_code: payload.language_code,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync save card');
    }
  }

  /**
   * 同步取消收藏單字
   */
  private async syncUnsaveCard(userId: string, payload: any): Promise<void> {
    const response = await fetch('/api/vocabulary/unsave', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        dictionary_entry_id: payload.dictionary_entry_id,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync unsave card');
    }
  }

  /**
   * 同步標記為已學習
   */
  private async syncMarkLearned(userId: string, payload: any): Promise<void> {
    const response = await fetch('/api/vocabulary/mark-learned', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        dictionary_entry_id: payload.dictionary_entry_id,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync mark learned');
    }
  }

  /**
   * 同步複習結果
   */
  private async syncMarkReview(userId: string, payload: any): Promise<void> {
    const response = await fetch('/api/vocabulary/record-review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        dictionary_entry_id: payload.dictionary_entry_id,
        is_correct: payload.is_correct,
        reviewed_at: payload.reviewed_at,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync review');
    }
  }

  /**
   * 標記同步項目為失敗
   */
  private async markSyncItemFailed(itemId: string): Promise<void> {
    // 更新 retry_count 和 last_retry_at
    // 暫時不實作
  }

  /**
   * 獲取當前使用者 ID
   */
  private async getCurrentUserId(): Promise<string | null> {
    // 從 auth service 或 localStorage 獲取
    // 暫時返回 null
    return null;
  }

  /**
   * 獲取離線收藏的單字
   */
  async getSavedVocabularyCards(userId: string): Promise<VocabularyCard[]> {
    try {
      // 從 SQLite 查詢
      const result = await sqliteService.querySceneLexemeLinks('vocabulary_card', 'en');
      
      return result
        .filter(link => link.sentence_id === userId)
        .map(link => ({
          id: link.id,
          user_id: link.sentence_id,
          dictionary_entry_id: link.dictionary_entry_id || '',
          language_code: link.language_code,
          is_saved: true,
          is_learned: false,
          is_hidden: false,
          first_seen_at: link.created_at,
          last_seen_at: link.updated_at,
          created_at: link.created_at,
          updated_at: link.updated_at,
        }));
    } catch (error) {
      console.error('Failed to get saved vocabulary cards:', error);
      return [];
    }
  }

  /**
   * 獲取離線複習紀錄
   */
  async getVocabularyReviews(userId: string): Promise<VocabularyReview[]> {
    try {
      // 從 SQLite 查詢
      const result = await sqliteService.querySceneLexemeLinks('vocabulary_review', 'en');
      
      return result
        .filter(link => link.sentence_id === userId)
        .map(link => ({
          id: link.id,
          user_id: link.sentence_id,
          dictionary_entry_id: link.dictionary_entry_id || '',
          next_review_at: link.updated_at,
          review_count: 0,
          correct_count: 0,
          incorrect_count: 0,
          ease_factor: 2.5,
          last_reviewed_at: link.updated_at,
          updated_at: link.updated_at,
        }));
    } catch (error) {
      console.error('Failed to get vocabulary reviews:', error);
      return [];
    }
  }

  /**
   * 從 Supabase 同步收藏到 SQLite
   */
  async syncFromSupabase(userId: string): Promise<void> {
    try {
      if (!this.isOnline) {
        return;
      }

      const response = await fetch('/api/vocabulary/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync from Supabase');
      }

      const data = await response.json();

      // 同步收藏單字
      if (data.cards && data.cards.length > 0) {
        for (const card of data.cards) {
          await sqliteService.cacheSceneLexemeLinks([
            {
              id: card.id,
              scene_id: 'vocabulary_card',
              scene_version: 1,
              language_code: card.language_code,
              sentence_id: userId,
              start_index: 0,
              end_index: 0,
              display_text: card.dictionary_entry_id,
              dictionary_entry_id: card.dictionary_entry_id,
              phrase_priority: 0,
              created_at: card.created_at,
              updated_at: card.updated_at,
            },
          ]);
        }
      }

      // 同步複習紀錄
      if (data.reviews && data.reviews.length > 0) {
        for (const review of data.reviews) {
          await sqliteService.cacheSceneLexemeLinks([
            {
              id: review.id,
              scene_id: 'vocabulary_review',
              scene_version: 1,
              language_code: 'en',
              sentence_id: userId,
              start_index: 0,
              end_index: 0,
              display_text: review.dictionary_entry_id,
              dictionary_entry_id: review.dictionary_entry_id,
              phrase_priority: 0,
              created_at: review.created_at,
              updated_at: review.updated_at,
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to sync from Supabase:', error);
    }
  }
}

export const offlineSyncService = new OfflineSyncService();
