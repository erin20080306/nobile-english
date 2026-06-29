import { sqliteService } from './sqliteService';
import type { Word } from '@/types';

export interface DictionaryEntry {
  id: string;
  language_code: string;
  lemma: string;
  display_word: string;
  reading?: string;
  romanization?: string;
  ipa?: string;
  part_of_speech?: string;
  definitions_json: any[];
  definitions_zh_tw_json: any[];
  examples_json: any[];
  collocations_json: any[];
  synonyms_json: any[];
  antonyms_json: any[];
  word_family_json: any[];
  cefr_level?: string;
  frequency_rank?: number;
  topic_tags_json: any[];
  source_name?: string;
  source_license?: string;
  source_attribution?: string;
  is_ai_enriched: boolean;
  content_version: number;
  created_at: string;
  updated_at: string;
}

export interface SceneLexemeLink {
  id: string;
  scene_id: string;
  scene_version: number;
  language_code: string;
  sentence_id: string;
  start_index: number;
  end_index: number;
  display_text: string;
  dictionary_entry_id?: string;
  phrase_priority: number;
  created_at: string;
  updated_at: string;
}

export class DictionaryQueryService {
  private isOnline = true;

  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
  }

  /**
   * 使用者點擊句子中的單字或片語時的查詢流程
   * 依照以下順序：
   * 1. 優先從本機 SQLite 查詢 scene_lexeme_links
   * 2. 若命中片語，優先顯示片語卡
   * 3. 若沒有符合片語，顯示單字卡
   * 4. 若 SQLite 已有資料，直接開啟單字卡
   * 5. 若 SQLite 沒有資料但使用者線上，呼叫 API
   * 6. 若使用者離線且 SQLite 沒有資料，顯示提示
   */
  async queryWordOrPhrase(
    sceneId: string,
    sentenceId: string,
    clickedText: string,
    startIndex: number,
    endIndex: number,
    languageCode: string = 'en'
  ): Promise<{ entry: DictionaryEntry | null; isPhrase: boolean; error?: string }> {
    try {
      // 1. 優先從本機 SQLite 查詢 scene_lexeme_links
      const lexemeLinks = await sqliteService.querySceneLexemeLinks(sceneId, languageCode);

      // 2. 尋找最長片語優先匹配
      const matchedPhrase = this.findLongestPhrase(
        lexemeLinks,
        sentenceId,
        startIndex,
        endIndex
      );

      if (matchedPhrase) {
        // 命中片語，優先顯示片語卡
        const entry = await this.getDictionaryEntryById(matchedPhrase.dictionary_entry_id);
        if (entry) {
          return { entry, isPhrase: true };
        }
      }

      // 3. 沒有符合片語，查詢單字
      const lemma = this.normalizeWord(clickedText);
      const entry = await this.getDictionaryEntry(lemma, languageCode);

      if (entry) {
        return { entry, isPhrase: false };
      }

      // 4. SQLite 沒有資料，但使用者線上
      if (this.isOnline) {
        const remoteEntry = await this.fetchFromSupabase(lemma, languageCode);
        if (remoteEntry) {
          // 寫入 SQLite
          await sqliteService.cacheDictionaryEntry(remoteEntry);
          return { entry: remoteEntry, isPhrase: false };
        }
      }

      // 5. 使用者離線且 SQLite 沒有資料
      return {
        entry: null,
        isPhrase: false,
        error: '此單字的完整資料需要連線後下載',
      };
    } catch (error) {
      console.error('Failed to query word or phrase:', error);
      return {
        entry: null,
        isPhrase: false,
        error: '查詢失敗，請稍後再試',
      };
    }
  }

  /**
   * 尋找最長片語優先匹配
   */
  private findLongestPhrase(
    lexemeLinks: SceneLexemeLink[],
    sentenceId: string,
    startIndex: number,
    endIndex: number
  ): SceneLexemeLink | null {
    // 過濾出同一句子的 lexeme links
    const sentenceLinks = lexemeLinks.filter(link => link.sentence_id === sentenceId);

    // 找出包含點擊範圍的所有片語
    const matchingPhrases = sentenceLinks.filter(
      link =>
        link.phrase_priority > 0 &&
        link.start_index <= startIndex &&
        link.end_index >= endIndex
    );

    if (matchingPhrases.length === 0) {
      return null;
    }

    // 選擇最長的片語（end_index - start_index 最大）
    matchingPhrases.sort((a, b) => {
      const lengthA = a.end_index - a.start_index;
      const lengthB = b.end_index - b.start_index;
      return lengthB - lengthA; // 降序排列
    });

    return matchingPhrases[0];
  }

  /**
   * 從 SQLite 或 Supabase 獲取字典條目
   */
  private async getDictionaryEntry(
    lemma: string,
    languageCode: string
  ): Promise<DictionaryEntry | null> {
    // 優先從 SQLite 查詢
    const cachedEntry = await sqliteService.queryDictionaryEntry(lemma, languageCode);
    if (cachedEntry) {
      return cachedEntry;
    }

    // SQLite 沒有資料，若線上則從 Supabase 查詢
    if (this.isOnline) {
      return await this.fetchFromSupabase(lemma, languageCode);
    }

    return null;
  }

  /**
   * 從 SQLite 獲取字典條目（通過 ID）
   */
  private async getDictionaryEntryById(
    entryId: string | undefined
  ): Promise<DictionaryEntry | null> {
    if (!entryId) return null;

    try {
      // 從 SQLite 查詢
      const result = await sqliteService.queryDictionaryEntry(entryId, 'en');
      if (result) {
        return result;
      }

      // SQLite 沒有資料，若線上則從 Supabase 查詢
      if (this.isOnline) {
        return await this.fetchFromSupabaseById(entryId);
      }

      return null;
    } catch (error) {
      console.error('Failed to get dictionary entry by ID:', error);
      return null;
    }
  }

  /**
   * 從 Supabase 獲取字典條目
   */
  private async fetchFromSupabase(
    lemma: string,
    languageCode: string
  ): Promise<DictionaryEntry | null> {
    try {
      const response = await fetch('/api/dictionary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lemma,
          language_code: languageCode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch from Supabase');
      }

      const data = await response.json();
      return data.entry || null;
    } catch (error) {
      console.error('Failed to fetch from Supabase:', error);
      return null;
    }
  }

  /**
   * 從 Supabase 獲取字典條目（通過 ID）
   */
  private async fetchFromSupabaseById(
    entryId: string
  ): Promise<DictionaryEntry | null> {
    try {
      const response = await fetch('/api/dictionary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entry_id: entryId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch from Supabase');
      }

      const data = await response.json();
      return data.entry || null;
    } catch (error) {
      console.error('Failed to fetch from Supabase by ID:', error);
      return null;
    }
  }

  /**
   * 正規化單字（詞形還原）
   */
  private normalizeWord(word: string): string {
    return word.toLowerCase().trim();
  }

  /**
   * 預載場景相關的 lexeme links
   */
  async preloadSceneLexemeLinks(
    sceneId: string,
    languageCode: string = 'en'
  ): Promise<void> {
    try {
      if (!this.isOnline) {
        return;
      }

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
        throw new Error('Failed to preload lexeme links');
      }

      const data = await response.json();
      if (data.links && data.links.length > 0) {
        await sqliteService.cacheSceneLexemeLinks(data.links);
      }
    } catch (error) {
      console.error('Failed to preload scene lexeme links:', error);
    }
  }

  /**
   * 預載場景相關的字典條目
   */
  async preloadSceneDictionaryEntries(
    entryIds: string[]
  ): Promise<void> {
    try {
      if (!this.isOnline || entryIds.length === 0) {
        return;
      }

      const response = await fetch('/api/dictionary/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entry_ids: entryIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to preload dictionary entries');
      }

      const data = await response.json();
      if (data.entries && data.entries.length > 0) {
        for (const entry of data.entries) {
          await sqliteService.cacheDictionaryEntry(entry);
        }
      }
    } catch (error) {
      console.error('Failed to preload dictionary entries:', error);
    }
  }
}

export const dictionaryQueryService = new DictionaryQueryService();
