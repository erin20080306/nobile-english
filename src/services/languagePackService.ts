import { sqliteService } from './sqliteService';

export interface LanguageContentPack {
  id: string;
  language_code: string;
  pack_version: number;
  pack_type: 'basic' | 'intermediate' | 'advanced' | 'premium';
  scene_ids: string[];
  dictionary_entry_count: number;
  audio_manifest: any;
  download_url: string;
  file_size_bytes: number;
  is_required: boolean;
  released_at: string;
  created_at: string;
  updated_at: string;
}

export interface DownloadProgress {
  packId: string;
  languageCode: string;
  progress: number; // 0-100
  status: 'pending' | 'downloading' | 'extracting' | 'completed' | 'failed';
  error?: string;
}

export class LanguagePackService {
  private downloadQueue: Map<string, DownloadProgress> = new Map();
  private isWifiOnly = false;
  private autoDownloadCommon = true;

  /**
   * 語言內容包下載規則
   */
  async downloadLanguagePack(
    languageCode: string,
    packType: 'basic' | 'intermediate' | 'advanced' | 'premium' = 'basic'
  ): Promise<DownloadProgress> {
    const packId = `${languageCode}_${packType}`;

    // 檢查是否已下載
    const existingPack = await this.getCachedLanguagePack(languageCode, packType);
    if (existingPack) {
      return {
        packId,
        languageCode,
        progress: 100,
        status: 'completed',
      };
    }

    // 檢查是否在下載中
    if (this.downloadQueue.has(packId)) {
      return this.downloadQueue.get(packId)!;
    }

    // 檢查 Wi-Fi 設定
    if (this.isWifiOnly && !await this.isOnWifi()) {
      return {
        packId,
        languageCode,
        progress: 0,
        status: 'failed',
        error: '請連接 Wi-Fi 下載語言內容',
      };
    }

    // 開始下載
    const progress: DownloadProgress = {
      packId,
      languageCode,
      progress: 0,
      status: 'downloading',
    };
    this.downloadQueue.set(packId, progress);

    try {
      // 從 Supabase 獲取語言包資訊
      const packInfo = await this.fetchLanguagePackInfo(languageCode, packType);
      if (!packInfo) {
        throw new Error('找不到語言內容包');
      }

      // 下載檔案
      await this.downloadPackFile(packInfo, progress);

      // 解壓縮並匯入到 SQLite
      await this.extractAndImportPack(packInfo, progress);

      // 更新狀態為完成
      progress.status = 'completed';
      progress.progress = 100;

      // 快取到 SQLite
      await this.cacheLanguagePack(packInfo);

    } catch (error) {
      progress.status = 'failed';
      progress.error = error instanceof Error ? error.message : '下載失敗';
      console.error('Failed to download language pack:', error);
    }

    return progress;
  }

  /**
   * 獲取語言包資訊
   */
  private async fetchLanguagePackInfo(
    languageCode: string,
    packType: string
  ): Promise<LanguageContentPack | null> {
    try {
      const response = await fetch('/api/language-packs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language_code: languageCode,
          pack_type: packType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch language pack info');
      }

      const data = await response.json();
      return data.pack || null;
    } catch (error) {
      console.error('Failed to fetch language pack info:', error);
      return null;
    }
  }

  /**
   * 下載語言包檔案
   */
  private async downloadPackFile(
    packInfo: LanguageContentPack,
    progress: DownloadProgress
  ): Promise<Blob> {
    try {
      const response = await fetch(packInfo.download_url);
      if (!response.ok) {
        throw new Error('Failed to download pack file');
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : packInfo.file_size_bytes;
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const chunks: BlobPart[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        // 更新進度
        progress.progress = Math.min(100, Math.floor((loaded / total) * 100));
      }

      // 合併 chunks
      const blob = new Blob(chunks);
      return blob;
    } catch (error) {
      console.error('Failed to download pack file:', error);
      throw error;
    }
  }

  /**
   * 解壓縮並匯入語言包
   */
  private async extractAndImportPack(
    packInfo: LanguageContentPack,
    progress: DownloadProgress
  ): Promise<void> {
    progress.status = 'extracting';
    progress.progress = 90;

    try {
      // 這裡需要實作解壓縮邏輯
      // 由於 Capacitor 環境限制，可能需要使用原生 plugin
      // 暫時模擬解壓縮過程

      // 匯入場景 lexeme links
      if (packInfo.scene_ids && packInfo.scene_ids.length > 0) {
        for (const sceneId of packInfo.scene_ids) {
          await this.importSceneLexemeLinks(sceneId, packInfo.language_code);
        }
      }

      // 匯入字典條目
      if (packInfo.dictionary_entry_count > 0) {
        await this.importDictionaryEntries(packInfo.language_code);
      }

      progress.progress = 100;
    } catch (error) {
      console.error('Failed to extract and import pack:', error);
      throw error;
    }
  }

  /**
   * 匯入場景 lexeme links
   */
  private async importSceneLexemeLinks(
    sceneId: string,
    languageCode: string
  ): Promise<void> {
    try {
      const response = await fetch('/api/dictionary/scene-lexeme-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scene_id: sceneId,
          language_code: languageCode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to import scene lexeme links');
      }

      const data = await response.json();
      if (data.links && data.links.length > 0) {
        await sqliteService.cacheSceneLexemeLinks(data.links);
      }
    } catch (error) {
      console.error('Failed to import scene lexeme links:', error);
    }
  }

  /**
   * 匯入字典條目
   */
  private async importDictionaryEntries(languageCode: string): Promise<void> {
    try {
      const response = await fetch('/api/dictionary/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language_code: languageCode,
          limit: 1000, // 分批匯入
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to import dictionary entries');
      }

      const data = await response.json();
      if (data.entries && data.entries.length > 0) {
        for (const entry of data.entries) {
          await sqliteService.cacheDictionaryEntry(entry);
        }
      }
    } catch (error) {
      console.error('Failed to import dictionary entries:', error);
    }
  }

  /**
   * 快取語言包到 SQLite
   */
  private async cacheLanguagePack(packInfo: LanguageContentPack): Promise<void> {
    try {
      const now = new Date().toISOString();
      await sqliteService.cacheSceneLexemeLinks([
        {
          id: packInfo.id,
          scene_id: packInfo.id,
          scene_version: packInfo.pack_version,
          language_code: packInfo.language_code,
          sentence_id: packInfo.id,
          start_index: 0,
          end_index: 0,
          display_text: packInfo.pack_type,
          phrase_priority: 0,
          created_at: packInfo.created_at,
          updated_at: now,
        },
      ]);
    } catch (error) {
      console.error('Failed to cache language pack:', error);
    }
  }

  /**
   * 獲取已快取的語言包
   */
  private async getCachedLanguagePack(
    languageCode: string,
    packType: string
  ): Promise<LanguageContentPack | null> {
    try {
      const result = await sqliteService.querySceneLexemeLinks(
        `${languageCode}_${packType}`,
        languageCode
      );

      if (result.length > 0) {
        return {
          id: result[0].id,
          language_code: result[0].language_code,
          pack_version: result[0].scene_version,
          pack_type: result[0].display_text as any,
          scene_ids: [],
          dictionary_entry_count: 0,
          audio_manifest: {},
          download_url: '',
          file_size_bytes: 0,
          is_required: false,
          released_at: result[0].created_at,
          created_at: result[0].created_at,
          updated_at: result[0].updated_at,
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get cached language pack:', error);
      return null;
    }
  }

  /**
   * 檢查是否在 Wi-Fi 上
   */
  private async isOnWifi(): Promise<boolean> {
    // 在 Capacitor 環境中，可以使用 @capacitor/network 插件
    // 暫時返回 true
    return true;
  }

  /**
   * 設定 Wi-Fi 下載限制
   */
  setWifiOnly(enabled: boolean): void {
    this.isWifiOnly = enabled;
  }

  /**
   * 設定自動下載常用語言
   */
  setAutoDownloadCommon(enabled: boolean): void {
    this.autoDownloadCommon = enabled;
  }

  /**
   * 獲取已下載的語言包列表
   */
  async getDownloadedPacks(): Promise<LanguageContentPack[]> {
    const packs: LanguageContentPack[] = [];

    // 從 SQLite 查詢已下載的語言包
    const languages = ['en', 'ja', 'ko', 'it', 'es'];
    const packTypes = ['basic', 'intermediate', 'advanced', 'premium'];

    for (const lang of languages) {
      for (const type of packTypes) {
        const pack = await this.getCachedLanguagePack(lang, type);
        if (pack) {
          packs.push(pack);
        }
      }
    }

    return packs;
  }

  /**
   * 清除近期未使用的語言內容
   */
  async clearUnusedPacks(daysThreshold: number = 30): Promise<void> {
    const packs = await this.getDownloadedPacks();
    const now = new Date();
    const threshold = new Date(now.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

    for (const pack of packs) {
      if (pack.is_required) {
        // 必要的語言包不清除
        continue;
      }

      const lastUsed = new Date(pack.updated_at);
      if (lastUsed < threshold) {
        await this.deleteLanguagePack(pack.id);
      }
    }
  }

  /**
   * 刪除語言包
   */
  async deleteLanguagePack(packId: string): Promise<void> {
    try {
      // 從 SQLite 刪除相關資料
      // 注意：不清除使用者收藏單字、複習紀錄、農場資料等個人資料
      console.log(`Deleting language pack: ${packId}`);
      // 實際實作需要從 SQLite 刪除相關條目
    } catch (error) {
      console.error('Failed to delete language pack:', error);
    }
  }

  /**
   * 獲取下載進度
   */
  getDownloadProgress(packId: string): DownloadProgress | undefined {
    return this.downloadQueue.get(packId);
  }

  /**
   * 取消下載
   */
  cancelDownload(packId: string): void {
    const progress = this.downloadQueue.get(packId);
    if (progress && progress.status === 'downloading') {
      progress.status = 'failed';
      progress.error = '下載已取消';
    }
  }
}

export const languagePackService = new LanguagePackService();
