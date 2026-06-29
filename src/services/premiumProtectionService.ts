import { subscriptionService } from './subscriptionService';
import { sqliteService } from './sqliteService';
import type { PremiumEntitlement as SubscriptionPremiumEntitlement } from '@/types/subscription';

export interface PremiumEntitlement {
  isActive: boolean;
  expiresAt: string | null;
  platform: 'ios' | 'android' | 'web';
  productId: string;
  willRenew: boolean;
}

// 轉換函數
function convertEntitlement(entitlement: SubscriptionPremiumEntitlement): PremiumEntitlement {
  return {
    isActive: entitlement.isActive,
    expiresAt: entitlement.expiresAt,
    platform: entitlement.platform === 'stripe' ? 'web' : entitlement.platform,
    productId: entitlement.productId,
    willRenew: entitlement.willRenew,
  };
}

export class PremiumProtectionService {
  private currentEntitlement: PremiumEntitlement | null = null;
  private lastSyncTime: number = 0;
  private syncIntervalMs = 300000; // 5 minutes
  private offlineGracePeriodMs = 86400000; // 24 hours

  /**
   * 檢查 Premium 權限
   */
  async checkPremiumAccess(): Promise<boolean> {
    try {
      const entitlement = await subscriptionService.getEntitlement();
      this.currentEntitlement = convertEntitlement(entitlement);
      this.lastSyncTime = Date.now();

      // 檢查是否在寬限期內
      if (!entitlement.isActive && this.isInGracePeriod()) {
        return true;
      }

      return entitlement.isActive;
    } catch (error) {
      console.error('Failed to check premium access:', error);
      // 錯誤時保守處理，假設沒有權限
      return false;
    }
  }

  /**
   * 檢查是否可以開啟 Premium 場景
   */
  async canAccessPremiumScene(sceneId: string): Promise<boolean> {
    const hasPremium = await this.checkPremiumAccess();

    if (!hasPremium) {
      return false;
    }

    // 檢查場景是否為 Premium
    const isPremiumScene = await this.isPremiumScene(sceneId);
    if (!isPremiumScene) {
      return true; // 非 Premium 場景，所有人可存取
    }

    return hasPremium;
  }

  /**
   * 檢查場景是否為 Premium
   */
  private async isPremiumScene(sceneId: string): Promise<boolean> {
    try {
      // 從 SQLite 或 API 查詢場景類型
      // 暫時返回 false
      return false;
    } catch (error) {
      console.error('Failed to check if scene is premium:', error);
      return false;
    }
  }

  /**
   * 檢查是否在寬限期內
   */
  private isInGracePeriod(): boolean {
    if (!this.currentEntitlement || !this.currentEntitlement.expiresAt) {
      return false;
    }

    const expiresAt = new Date(this.currentEntitlement.expiresAt).getTime();
    const now = Date.now();
    const timeSinceExpiry = now - expiresAt;

    return timeSinceExpiry < this.offlineGracePeriodMs;
  }

  /**
   * 定期同步 entitlement
   */
  startPeriodicSync(): void {
    setInterval(async () => {
      if (navigator.onLine) {
        await this.syncEntitlement();
      }
    }, this.syncIntervalMs);
  }

  /**
   * 同步 entitlement
   */
  private async syncEntitlement(): Promise<void> {
    try {
      const entitlement = await subscriptionService.getEntitlement();
      this.currentEntitlement = convertEntitlement(entitlement);
      this.lastSyncTime = Date.now();

      // 保存到 SQLite
      await this.cacheEntitlement(this.currentEntitlement);
    } catch (error) {
      console.error('Failed to sync entitlement:', error);
    }
  }

  /**
   * 快取 entitlement 到 SQLite
   */
  private async cacheEntitlement(entitlement: PremiumEntitlement): Promise<void> {
    try {
      const now = new Date().toISOString();
      await sqliteService.cacheSceneLexemeLinks([
        {
          id: 'premium_entitlement',
          scene_id: 'premium_entitlement',
          scene_version: 1,
          language_code: 'en',
          sentence_id: 'entitlement',
          start_index: 0,
          end_index: 0,
          display_text: JSON.stringify(entitlement),
          dictionary_entry_id: null,
          phrase_priority: 0,
          created_at: now,
          updated_at: now,
        },
      ]);
    } catch (error) {
      console.error('Failed to cache entitlement:', error);
    }
  }

  /**
   * 從 SQLite 讀取快取的 entitlement
   */
  private async getCachedEntitlement(): Promise<PremiumEntitlement | null> {
    try {
      const result = await sqliteService.querySceneLexemeLinks('premium_entitlement', 'en');
      if (result.length > 0) {
        return JSON.parse(result[0].display_text);
      }
      return null;
    } catch (error) {
      console.error('Failed to get cached entitlement:', error);
      return null;
    }
  }

  /**
   * 獲取離線 entitlement（從快取）
   */
  async getOfflineEntitlement(): Promise<PremiumEntitlement | null> {
    const cached = await this.getCachedEntitlement();
    if (cached) {
      // 檢查快取是否過期
      const timeSinceSync = Date.now() - this.lastSyncTime;
      if (timeSinceSync < this.offlineGracePeriodMs) {
        return cached;
      }
    }
    return null;
  }

  /**
   * 保護使用者資料（訂閱過期時保留）
   */
  async protectUserData(userId: string): Promise<void> {
    try {
      // 這些資料在訂閱過期時必須保留
      const protectedData = {
        // 收藏單字
        savedVocabulary: await this.getSavedVocabulary(userId),
        // 複習紀錄
        vocabularyReviews: await this.getVocabularyReviews(userId),
        // 農場資料
        farmData: await this.getFarmData(userId),
        // 金幣、種子、水滴
        gameCurrency: await this.getGameCurrency(userId),
        // 收成
        harvests: await this.getHarvests(userId),
        // 已獲得物品
        items: await this.getItems(userId),
        // 已完成場景紀錄
        completedScenes: await this.getCompletedScenes(userId),
      };

      // 確保這些資料不被刪除
      await this.markDataAsProtected(userId, protectedData);
    } catch (error) {
      console.error('Failed to protect user data:', error);
    }
  }

  /**
   * 獲取收藏單字
   */
  private async getSavedVocabulary(userId: string): Promise<any[]> {
    try {
      const result = await sqliteService.querySceneLexemeLinks('vocabulary_card', 'en');
      return result.filter(link => link.sentence_id === userId);
    } catch (error) {
      console.error('Failed to get saved vocabulary:', error);
      return [];
    }
  }

  /**
   * 獲取複習紀錄
   */
  private async getVocabularyReviews(userId: string): Promise<any[]> {
    try {
      const result = await sqliteService.querySceneLexemeLinks('vocabulary_review', 'en');
      return result.filter(link => link.sentence_id === userId);
    } catch (error) {
      console.error('Failed to get vocabulary reviews:', error);
      return [];
    }
  }

  /**
   * 獲取農場資料
   */
  private async getFarmData(userId: string): Promise<any> {
    try {
      const result = await sqliteService.querySceneLexemeLinks('farm_data', 'en');
      return result.find(link => link.sentence_id === userId);
    } catch (error) {
      console.error('Failed to get farm data:', error);
      return null;
    }
  }

  /**
   * 獲取遊戲貨幣
   */
  private async getGameCurrency(userId: string): Promise<any> {
    try {
      const result = await sqliteService.querySceneLexemeLinks('game_currency', 'en');
      return result.find(link => link.sentence_id === userId);
    } catch (error) {
      console.error('Failed to get game currency:', error);
      return null;
    }
  }

  /**
   * 獲取收成
   */
  private async getHarvests(userId: string): Promise<any[]> {
    try {
      const result = await sqliteService.querySceneLexemeLinks('harvests', 'en');
      return result.filter(link => link.sentence_id === userId);
    } catch (error) {
      console.error('Failed to get harvests:', error);
      return [];
    }
  }

  /**
   * 獲取物品
   */
  private async getItems(userId: string): Promise<any[]> {
    try {
      const result = await sqliteService.querySceneLexemeLinks('items', 'en');
      return result.filter(link => link.sentence_id === userId);
    } catch (error) {
      console.error('Failed to get items:', error);
      return [];
    }
  }

  /**
   * 獲取已完成場景
   */
  private async getCompletedScenes(userId: string): Promise<any[]> {
    try {
      const result = await sqliteService.querySceneLexemeLinks('completed_scenes', 'en');
      return result.filter(link => link.sentence_id === userId);
    } catch (error) {
      console.error('Failed to get completed scenes:', error);
      return [];
    }
  }

  /**
   * 標記資料為受保護
   */
  private async markDataAsProtected(userId: string, data: any): Promise<void> {
    try {
      const now = new Date().toISOString();
      await sqliteService.cacheSceneLexemeLinks([
        {
          id: `protected_data_${userId}`,
          scene_id: 'protected_data',
          scene_version: 1,
          language_code: 'en',
          sentence_id: userId,
          start_index: 0,
          end_index: 0,
          display_text: JSON.stringify(data),
          dictionary_entry_id: null,
          phrase_priority: 0,
          created_at: now,
          updated_at: now,
        },
      ]);
    } catch (error) {
      console.error('Failed to mark data as protected:', error);
    }
  }

  /**
   * 阻止繞過訂閱過期限制
   */
  async preventBypass(sceneId: string): Promise<boolean> {
    const hasPremium = await this.checkPremiumAccess();
    const isPremiumScene = await this.isPremiumScene(sceneId);

    if (isPremiumScene && !hasPremium) {
      // Premium 場景且沒有權限，阻止存取
      return false;
    }

    return true;
  }

  /**
   * 恢復 Premium 權限（重新訂閱或恢復購買後）
   */
  async restorePremiumAccess(): Promise<void> {
    try {
      // 恢復購買
      await subscriptionService.restorePurchases();

      // 重新同步 entitlement
      await this.syncEntitlement();

      // 解鎖 Premium 內容
      await this.unlockPremiumContent();
    } catch (error) {
      console.error('Failed to restore premium access:', error);
    }
  }

  /**
   * 解鎖 Premium 內容
   */
  private async unlockPremiumContent(): Promise<void> {
    try {
      // 移除任何暫時的鎖定
      console.log('Unlocking premium content');
    } catch (error) {
      console.error('Failed to unlock premium content:', error);
    }
  }

  /**
   * 獲取當前 entitlement
   */
  getCurrentEntitlement(): PremiumEntitlement | null {
    return this.currentEntitlement;
  }

  /**
   * 設定寬限期時間
   */
  setGracePeriodMs(ms: number): void {
    this.offlineGracePeriodMs = ms;
  }

  /**
   * 設定同步間隔
   */
  setSyncIntervalMs(ms: number): void {
    this.syncIntervalMs = ms;
  }
}

export const premiumProtectionService = new PremiumProtectionService();
