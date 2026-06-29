import { sqliteService } from './sqliteService';

export interface SyncQueueItem {
  id: string;
  user_id: string;
  operation_type: string;
  entity_type: string;
  entity_id: string;
  payload: any;
  created_at: string;
  retry_count: number;
  last_retry_at: string;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
}

export class SyncQueueService {
  private maxRetries = 5;
  private retryDelayMs = 60000; // 1 minute
  private isProcessing = false;

  /**
   * 處理失敗的同步項目
   */
  async processFailedItems(userId: string): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const failedItems = await this.getFailedItems(userId);

      for (const item of failedItems) {
        if (item.retry_count >= this.maxRetries) {
          // 超過最大重試次數，標記為永久失敗
          await this.markAsPermanentlyFailed(item.id);
          continue;
        }

        // 檢查是否可以重試
        const lastRetry = new Date(item.last_retry_at);
        const now = new Date();
        const timeSinceRetry = now.getTime() - lastRetry.getTime();

        if (timeSinceRetry >= this.retryDelayMs) {
          // 重試
          await this.retryItem(item);
        }
      }
    } catch (error) {
      console.error('Failed to process failed items:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 獲取失敗的同步項目
   */
  private async getFailedItems(userId: string): Promise<SyncQueueItem[]> {
    try {
      const items = await sqliteService.getPendingSyncItems(userId);
      return items.filter(item => item.status === 'failed');
    } catch (error) {
      console.error('Failed to get failed items:', error);
      return [];
    }
  }

  /**
   * 重試同步項目
   */
  private async retryItem(item: SyncQueueItem): Promise<void> {
    try {
      // 更新狀態為 syncing
      await this.updateItemStatus(item.id, 'syncing');
      await this.incrementRetryCount(item.id);

      // 執行同步
      const success = await this.executeSync(item);

      if (success) {
        await sqliteService.markSyncItemCompleted(item.id);
      } else {
        await this.updateItemStatus(item.id, 'failed');
      }
    } catch (error) {
      console.error(`Failed to retry item ${item.id}:`, error);
      await this.updateItemStatus(item.id, 'failed');
    }
  }

  /**
   * 執行同步操作
   */
  private async executeSync(item: SyncQueueItem): Promise<boolean> {
    const payload = JSON.parse(item.payload);

    try {
      switch (item.operation_type) {
        case 'save_card':
          return await this.syncSaveCard(item.user_id, payload);
        case 'unsave_card':
          return await this.syncUnsaveCard(item.user_id, payload);
        case 'mark_learned':
          return await this.syncMarkLearned(item.user_id, payload);
        case 'mark_review':
          return await this.syncMarkReview(item.user_id, payload);
        case 'update_progress':
          return await this.syncUpdateProgress(item.user_id, payload);
        default:
          console.warn(`Unknown operation type: ${item.operation_type}`);
          return false;
      }
    } catch (error) {
      console.error(`Failed to execute sync for item ${item.id}:`, error);
      return false;
    }
  }

  /**
   * 同步收藏單字
   */
  private async syncSaveCard(userId: string, payload: any): Promise<boolean> {
    try {
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

      return response.ok;
    } catch (error) {
      console.error('Failed to sync save card:', error);
      return false;
    }
  }

  /**
   * 同步取消收藏單字
   */
  private async syncUnsaveCard(userId: string, payload: any): Promise<boolean> {
    try {
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

      return response.ok;
    } catch (error) {
      console.error('Failed to sync unsave card:', error);
      return false;
    }
  }

  /**
   * 同步標記為已學習
   */
  private async syncMarkLearned(userId: string, payload: any): Promise<boolean> {
    try {
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

      return response.ok;
    } catch (error) {
      console.error('Failed to sync mark learned:', error);
      return false;
    }
  }

  /**
   * 同步複習結果
   */
  private async syncMarkReview(userId: string, payload: any): Promise<boolean> {
    try {
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

      return response.ok;
    } catch (error) {
      console.error('Failed to sync review:', error);
      return false;
    }
  }

  /**
   * 同步進度更新
   */
  private async syncUpdateProgress(userId: string, payload: any): Promise<boolean> {
    try {
      const response = await fetch('/api/progress/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          scene_id: payload.scene_id,
          progress: payload.progress,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to sync progress:', error);
      return false;
    }
  }

  /**
   * 更新項目狀態
   */
  private async updateItemStatus(itemId: string, status: string): Promise<void> {
    try {
      // 使用 SQLite 更新狀態
      // 暫時不實作，因為需要 SQLite 的 update 方法
      console.log(`Updating item ${itemId} status to ${status}`);
    } catch (error) {
      console.error('Failed to update item status:', error);
    }
  }

  /**
   * 增加重試次數
   */
  private async incrementRetryCount(itemId: string): Promise<void> {
    try {
      // 使用 SQLite 增加重試次數
      // 暫時不實作
      console.log(`Incrementing retry count for item ${itemId}`);
    } catch (error) {
      console.error('Failed to increment retry count:', error);
    }
  }

  /**
   * 標記為永久失敗
   */
  private async markAsPermanentlyFailed(itemId: string): Promise<void> {
    try {
      // 使用 SQLite 標記為永久失敗
      // 暫時不實作
      console.log(`Marking item ${itemId} as permanently failed`);
    } catch (error) {
      console.error('Failed to mark as permanently failed:', error);
    }
  }

  /**
   * 處理資料衝突
   */
  async resolveConflict(
    localData: any,
    remoteData: any,
    entityType: string
  ): Promise<any> {
    // 根據 updated_at 決定使用哪個版本
    const localUpdated = new Date(localData.updated_at);
    const remoteUpdated = new Date(remoteData.updated_at);

    if (remoteUpdated > localUpdated) {
      // 遠端較新，使用遠端資料
      return remoteData;
    } else if (localUpdated > remoteUpdated) {
      // 本地較新，使用本地資料
      return localData;
    } else {
      // 時間相同，使用 merge 規則
      return this.mergeData(localData, remoteData, entityType);
    }
  }

  /**
   * 合併資料
   */
  private mergeData(localData: any, remoteData: any, entityType: string): any {
    switch (entityType) {
      case 'vocabulary_card':
        return {
          ...remoteData,
          is_saved: localData.is_saved || remoteData.is_saved,
          is_learned: localData.is_learned || remoteData.is_learned,
          last_seen_at: localData.last_seen_at || remoteData.last_seen_at,
        };
      case 'vocabulary_review':
        return {
          ...remoteData,
          review_count: Math.max(localData.review_count, remoteData.review_count),
          correct_count: localData.correct_count + remoteData.correct_count,
          incorrect_count: localData.incorrect_count + remoteData.incorrect_count,
          last_reviewed_at: localData.last_reviewed_at || remoteData.last_reviewed_at,
        };
      default:
        return remoteData;
    }
  }

  /**
   * 清理過期的同步項目
   */
  async cleanupOldItems(daysThreshold: number = 30): Promise<void> {
    try {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - daysThreshold);

      // 從 SQLite 刪除過期的已完成項目
      // 暫時不實作
      console.log(`Cleaning up sync items older than ${daysThreshold} days`);
    } catch (error) {
      console.error('Failed to cleanup old items:', error);
    }
  }

  /**
   * 獲取同步統計
   */
  async getSyncStats(userId: string): Promise<{
    pending: number;
    syncing: number;
    failed: number;
    completed: number;
  }> {
    try {
      const items = await sqliteService.getPendingSyncItems(userId);

      return {
        pending: items.filter(item => item.status === 'pending').length,
        syncing: items.filter(item => item.status === 'syncing').length,
        failed: items.filter(item => item.status === 'failed').length,
        completed: items.filter(item => item.status === 'completed').length,
      };
    } catch (error) {
      console.error('Failed to get sync stats:', error);
      return {
        pending: 0,
        syncing: 0,
        failed: 0,
        completed: 0,
      };
    }
  }

  /**
   * 設定最大重試次數
   */
  setMaxRetries(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }

  /**
   * 設定重試延遲
   */
  setRetryDelay(delayMs: number): void {
    this.retryDelayMs = delayMs;
  }
}

export const syncQueueService = new SyncQueueService();
