/**
 * 外部資料清洗與標準化規則
 * 
 * 用於清洗來自不同字典來源的資料
 */

export interface CleanedEntry {
  word: string;
  lemma: string;
  language: string;
  partOfSpeech?: string;
  definitions?: string[];
  examples?: string[];
  pronunciation?: string;
  ipa?: string;
  isValid: boolean;
  errors: string[];
}

export class DataCleaningRules {
  /**
   * 清洗單字條目
   */
  static cleanEntry(entry: any, language: string): CleanedEntry {
    const cleaned: CleanedEntry = {
      word: '',
      lemma: '',
      language,
      isValid: true,
      errors: [],
    };

    // 1. 檢查必要欄位
    if (!entry.word) {
      cleaned.isValid = false;
      cleaned.errors.push('Missing word field');
      return cleaned;
    }

    // 2. Unicode normalization
    cleaned.word = this.normalizeUnicode(entry.word);
    cleaned.lemma = this.normalizeUnicode(entry.lemma || entry.word);

    // 3. 清洗無效字元
    if (!this.isValidWord(cleaned.word, language)) {
      cleaned.isValid = false;
      cleaned.errors.push('Invalid word characters');
      return cleaned;
    }

    // 4. 清洗詞性
    if (entry.pos) {
      cleaned.partOfSpeech = this.normalizePartOfSpeech(entry.pos);
    }

    // 5. 清洗定義
    if (entry.definitions) {
      cleaned.definitions = this.cleanDefinitions(entry.definitions);
    }

    // 6. 清洗例句
    if (entry.examples) {
      cleaned.examples = this.cleanExamples(entry.examples);
    }

    // 7. 清洗發音
    if (entry.pronunciation) {
      cleaned.pronunciation = this.cleanPronunciation(entry.pronunciation);
    }

    // 8. 清洗 IPA
    if (entry.ipa) {
      cleaned.ipa = this.cleanIPA(entry.ipa);
    }

    // 9. 語言特定清洗
    this.languageSpecificCleaning(cleaned, language);

    return cleaned;
  }

  /**
   * Unicode normalization
   */
  private static normalizeUnicode(text: string): string {
    return text.normalize('NFC');
  }

  /**
   * 檢查單字是否有效
   */
  private static isValidWord(word: string, language: string): boolean {
    // 基本檢查：不為空，長度合理
    if (!word || word.length === 0 || word.length > 100) {
      return false;
    }

    // 語言特定檢查
    switch (language) {
      case 'en':
        // 英文：只允許字母、連字號、撇號
        return /^[a-zA-Z'-]+$/.test(word);
      case 'ja':
        // 日文：允許平假名、片假名、漢字
        return /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(word);
      case 'ko':
        // 韓文：允許韓文字母
        return /^[\uAC00-\uD7AF\u1100-\u11FF]+$/.test(word);
      case 'it':
      case 'es':
        // 義大利文、西班牙文：允許字母、重音符號、連字號、撇號
        return /^[a-zA-Z\u00C0-\u00FF'-]+$/.test(word);
      default:
        return true;
    }
  }

  /**
   * 正規化詞性
   */
  private static normalizePartOfSpeech(pos: string): string {
    const posMap: Record<string, string> = {
      // 英文
      'noun': 'noun',
      'verb': 'verb',
      'adjective': 'adjective',
      'adverb': 'adverb',
      'pronoun': 'pronoun',
      'preposition': 'preposition',
      'conjunction': 'conjunction',
      'interjection': 'interjection',
      // 縮寫
      'n': 'noun',
      'v': 'verb',
      'adj': 'adjective',
      'adv': 'adverb',
      'pron': 'pronoun',
      'prep': 'preposition',
      'conj': 'conjunction',
      'int': 'interjection',
    };

    const normalized = pos.toLowerCase().trim();
    return posMap[normalized] || normalized;
  }

  /**
   * 清洗定義
   */
  private static cleanDefinitions(definitions: any[]): string[] {
    if (!Array.isArray(definitions)) {
      return [];
    }

    return definitions
      .filter(def => def && typeof def === 'string')
      .map(def => def.trim())
      .filter(def => def.length > 0 && def.length < 500)
      .slice(0, 10); // 最多保留 10 個定義
  }

  /**
   * 清洗例句
   */
  private static cleanExamples(examples: any[]): string[] {
    if (!Array.isArray(examples)) {
      return [];
    }

    return examples
      .filter(ex => ex && typeof ex === 'string')
      .map(ex => ex.trim())
      .filter(ex => ex.length > 0 && ex.length < 1000)
      .slice(0, 5); // 最多保留 5 個例句
  }

  /**
   * 清洗發音
   */
  private static cleanPronunciation(pronunciation: string): string {
    if (typeof pronunciation !== 'string') {
      return '';
    }

    return pronunciation
      .trim()
      .replace(/[^a-zA-Z0-9\s\-']/g, '')
      .substring(0, 100);
  }

  /**
   * 清洗 IPA
   */
  private static cleanIPA(ipa: string): string {
    if (typeof ipa !== 'string') {
      return '';
    }

    return ipa
      .trim()
      .replace(/[^\u0020-\u007E\u00A0-\u024F\u0370-\u03FF\u1D00-\u1D7F]/g, '')
      .substring(0, 100);
  }

  /**
   * 語言特定清洗
   */
  private static languageSpecificCleaning(entry: CleanedEntry, language: string): void {
    switch (language) {
      case 'ja':
        this.cleanJapaneseEntry(entry);
        break;
      case 'ko':
        this.cleanKoreanEntry(entry);
        break;
      case 'en':
        this.cleanEnglishEntry(entry);
        break;
    }
  }

  /**
   * 清洗日文條目
   */
  private static cleanJapaneseEntry(entry: CleanedEntry): void {
    // 確保 lemma 是漢字或假名形式
    if (entry.word && /^[ァ-ンー]+$/.test(entry.word)) {
      // 如果是片假名，嘗試轉換為平假名或漢字
      // 這裡需要實際的轉換邏輯
    }
  }

  /**
   * 清洗韓文條目
   */
  private static cleanKoreanEntry(entry: CleanedEntry): void {
    // 韓文特定清洗邏輯
  }

  /**
   * 清洗英文條目
   */
  private static cleanEnglishEntry(entry: CleanedEntry): void {
    // 確保 lemma 是小寫
    entry.lemma = entry.lemma.toLowerCase();
    entry.word = entry.word.toLowerCase();
  }

  /**
   * 去除重複條目
   */
  static removeDuplicates(entries: CleanedEntry[]): CleanedEntry[] {
    const seen = new Set<string>();
    const unique: CleanedEntry[] = [];

    for (const entry of entries) {
      const key = `${entry.language}:${entry.lemma}:${entry.partOfSpeech || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(entry);
      }
    }

    return unique;
  }

  /**
   * 驗證條目完整性
   */
  static validateEntry(entry: CleanedEntry): boolean {
    if (!entry.isValid) {
      return false;
    }

    if (!entry.word || !entry.lemma) {
      return false;
    }

    if (entry.word.length === 0 || entry.lemma.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * 批次清洗
   */
  static batchClean(
    rawEntries: any[],
    language: string
  ): { cleaned: CleanedEntry[]; stats: any } {
    const cleaned: CleanedEntry[] = [];
    const stats = {
      total: rawEntries.length,
      valid: 0,
      invalid: 0,
      byError: {} as Record<string, number>,
    };

    for (const rawEntry of rawEntries) {
      const entry = this.cleanEntry(rawEntry, language);

      if (this.validateEntry(entry)) {
        cleaned.push(entry);
        stats.valid++;
      } else {
        stats.invalid++;
        for (const error of entry.errors) {
          stats.byError[error] = (stats.byError[error] || 0) + 1;
        }
      }
    }

    // 去除重複
    const unique = this.removeDuplicates(cleaned);

    return {
      cleaned: unique,
      stats: {
        ...stats,
        duplicatesRemoved: cleaned.length - unique.length,
      },
    };
  }
}
