/**
 * 詞形還原與 Surface Form 索引流程
 * 
 * 用於建立詞形變化索引，支援詞形還原查詢
 */

export interface SurfaceForm {
  id: string;
  languageCode: string;
  surfaceForm: string;
  normalizedForm: string;
  lemma: string;
  dictionaryEntryId: string;
  formType: 'inflection' | 'conjugation' | 'declension' | 'variant';
}

export interface LemmatizationResult {
  lemma: string;
  confidence: number;
  formType?: string;
}

export class LemmatizationFlow {
  /**
   * 詞形還原（英文）
   */
  static lemmatizeEnglish(word: string): LemmatizationResult {
    const lowerWord = word.toLowerCase();

    // 常見詞形變化規則
    const rules = [
      // 複數 → 單數
      { pattern: /(.*)es$/, replacement: '$1', formType: 'inflection' },
      { pattern: /(.*)ies$/, replacement: '$1y', formType: 'inflection' },
      { pattern: /(.*)ves$/, replacement: '$1f', formType: 'inflection' },
      { pattern: /(.*)s$/, replacement: '$1', formType: 'inflection' },
      
      // 過去式 → 原形
      { pattern: /(.*)ed$/, replacement: '$1', formType: 'inflection' },
      { pattern: /(.*)ied$/, replacement: '$1y', formType: 'inflection' },
      
      // 現在分詞 → 原形
      { pattern: /(.*)ing$/, replacement: '$1', formType: 'inflection' },
      
      // 比較級 → 原形
      { pattern: /(.*)er$/, replacement: '$1', formType: 'inflection' },
      { pattern: /(.*)ier$/, replacement: '$1y', formType: 'inflection' },
      
      // 最高級 → 原形
      { pattern: /(.*)est$/, replacement: '$1', formType: 'inflection' },
      { pattern: /(.*)iest$/, replacement: '$1y', formType: 'inflection' },
    ];

    for (const rule of rules) {
      const match = lowerWord.match(rule.pattern);
      if (match) {
        const lemma = match[1];
        return {
          lemma,
          confidence: 0.8,
          formType: rule.formType,
        };
      }
    }

    // 無法還原，返回原詞
    return {
      lemma: lowerWord,
      confidence: 0.5,
    };
  }

  /**
   * 詞形還原（日文）
   */
  static lemmatizeJapanese(word: string): LemmatizationResult {
    // 日文動詞活用形還原
    const verbEndings = [
      { ending: 'ます', lemma: '', formType: 'conjugation' },
      { ending: 'ました', lemma: '', formType: 'conjugation' },
      { ending: 'ません', lemma: '', formType: 'conjugation' },
      { ending: 'て', lemma: '', formType: 'conjugation' },
      { ending: 'た', lemma: '', formType: 'conjugation' },
      { ending: 'ない', lemma: '', formType: 'conjugation' },
    ];

    for (const { ending, lemma, formType } of verbEndings) {
      if (word.endsWith(ending)) {
        const base = word.slice(0, -ending.length);
        return {
          lemma: base + lemma,
          confidence: 0.7,
          formType,
        };
      }
    }

    return {
      lemma: word,
      confidence: 0.5,
    };
  }

  /**
   * 詞形還原（韓文）
   */
  static lemmatizeKorean(word: string): LemmatizationResult {
    // 韓文動詞活用形還原
    const verbEndings = [
      { ending: '요', lemma: '다', formType: 'conjugation' },
      { ending: '습니다', lemma: '다', formType: 'conjugation' },
      { ending: '어요', lemma: '다', formType: 'conjugation' },
      { ending: '았어요', lemma: '다', formType: 'conjugation' },
    ];

    for (const { ending, lemma, formType } of verbEndings) {
      if (word.endsWith(ending)) {
        const base = word.slice(0, -ending.length);
        return {
          lemma: base + lemma,
          confidence: 0.7,
          formType,
        };
      }
    }

    return {
      lemma: word,
      confidence: 0.5,
    };
  }

  /**
   * 詞形還原（義大利文）
   */
  static lemmatizeItalian(word: string): LemmatizationResult {
    const lowerWord = word.toLowerCase();

    // 義大利文動詞變位還原
    const verbEndings = [
      { ending: 'o', lemma: 'are', formType: 'conjugation' },
      { ending: 'i', lemma: 'are', formType: 'conjugation' },
      { ending: 'a', lemma: 'are', formType: 'conjugation' },
      { ending: 'iamo', lemma: 'are', formType: 'conjugation' },
      { ending: 'ate', lemma: 'are', formType: 'conjugation' },
      { ending: 'ano', lemma: 'are', formType: 'conjugation' },
    ];

    for (const { ending, lemma, formType } of verbEndings) {
      if (lowerWord.endsWith(ending)) {
        const base = lowerWord.slice(0, -ending.length);
        return {
          lemma: base + lemma,
          confidence: 0.7,
          formType,
        };
      }
    }

    return {
      lemma: lowerWord,
      confidence: 0.5,
    };
  }

  /**
   * 詞形還原（西班牙文）
   */
  static lemmatizeSpanish(word: string): LemmatizationResult {
    const lowerWord = word.toLowerCase();

    // 西班牙文動詞變位還原
    const verbEndings = [
      { ending: 'o', lemma: 'ar', formType: 'conjugation' },
      { ending: 'as', lemma: 'ar', formType: 'conjugation' },
      { ending: 'a', lemma: 'ar', formType: 'conjugation' },
      { ending: 'amos', lemma: 'ar', formType: 'conjugation' },
      { ending: 'áis', lemma: 'ar', formType: 'conjugation' },
      { ending: 'an', lemma: 'ar', formType: 'conjugation' },
    ];

    for (const { ending, lemma, formType } of verbEndings) {
      if (lowerWord.endsWith(ending)) {
        const base = lowerWord.slice(0, -ending.length);
        return {
          lemma: base + lemma,
          confidence: 0.7,
          formType,
        };
      }
    }

    return {
      lemma: lowerWord,
      confidence: 0.5,
    };
  }

  /**
   * 通用詞形還原
   */
  static lemmatize(word: string, language: string): LemmatizationResult {
    switch (language) {
      case 'en':
        return this.lemmatizeEnglish(word);
      case 'ja':
        return this.lemmatizeJapanese(word);
      case 'ko':
        return this.lemmatizeKorean(word);
      case 'it':
        return this.lemmatizeItalian(word);
      case 'es':
        return this.lemmatizeSpanish(word);
      default:
        return {
          lemma: word.toLowerCase(),
          confidence: 0.5,
        };
    }
  }

  /**
   * 生成 surface forms
   */
  static generateSurfaceForms(
    lemma: string,
    language: string,
    partOfSpeech?: string
  ): SurfaceForm[] {
    const forms: SurfaceForm[] = [];
    const id = this.generateId();

    // 原形本身就是一個 surface form
    forms.push({
      id: `${id}_base`,
      languageCode: language,
      surfaceForm: lemma,
      normalizedForm: this.normalizeForm(lemma),
      lemma,
      dictionaryEntryId: id,
      formType: 'variant',
    });

    // 根據詞性生成變化形式
    if (partOfSpeech === 'noun' || partOfSpeech === 'verb') {
      const inflections = this.generateInflections(lemma, language, partOfSpeech);
      forms.push(...inflections);
    }

    return forms;
  }

  /**
   * 生成詞形變化
   */
  private static generateInflections(
    lemma: string,
    language: string,
    partOfSpeech: string
  ): SurfaceForm[] {
    const forms: SurfaceForm[] = [];
    const id = this.generateId();

    if (language === 'en') {
      if (partOfSpeech === 'noun') {
        // 複數形式
        if (!lemma.endsWith('s')) {
          forms.push({
            id: `${id}_plural`,
            languageCode: language,
            surfaceForm: lemma + 's',
            normalizedForm: this.normalizeForm(lemma + 's'),
            lemma,
            dictionaryEntryId: id,
            formType: 'inflection',
          });
        }
      } else if (partOfSpeech === 'verb') {
        // 過去式
        forms.push({
          id: `${id}_past`,
          languageCode: language,
          surfaceForm: lemma + 'ed',
          normalizedForm: this.normalizeForm(lemma + 'ed'),
          lemma,
          dictionaryEntryId: id,
          formType: 'inflection',
        });

        // 現在分詞
        forms.push({
          id: `${id}_ing`,
          languageCode: language,
          surfaceForm: lemma + 'ing',
          normalizedForm: this.normalizeForm(lemma + 'ing'),
          lemma,
          dictionaryEntryId: id,
          formType: 'inflection',
        });
      }
    }

    return forms;
  }

  /**
   * 正規化形式
   */
  private static normalizeForm(form: string): string {
    return form.toLowerCase().normalize('NFC');
  }

  /**
   * 生成唯一 ID
   */
  private static generateId(): string {
    return `sf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 批次建立 surface forms
   */
  static batchCreateSurfaceForms(
    entries: Array<{ lemma: string; language: string; partOfSpeech?: string }>
  ): SurfaceForm[] {
    const allForms: SurfaceForm[] = [];

    for (const entry of entries) {
      const forms = this.generateSurfaceForms(
        entry.lemma,
        entry.language,
        entry.partOfSpeech
      );
      allForms.push(...forms);
    }

    return allForms;
  }

  /**
   * 建立 surface form 索引
   */
  static buildSurfaceFormIndex(forms: SurfaceForm[]): Map<string, SurfaceForm[]> {
    const index = new Map<string, SurfaceForm[]>();

    for (const form of forms) {
      const key = `${form.languageCode}:${form.normalizedForm}`;
      
      if (!index.has(key)) {
        index.set(key, []);
      }
      
      index.get(key)!.push(form);
    }

    return index;
  }

  /**
   * 查詢 surface form
   */
  static querySurfaceForm(
    word: string,
    language: string,
    index: Map<string, SurfaceForm[]>
  ): SurfaceForm[] {
    const normalized = this.normalizeForm(word);
    const key = `${language}:${normalized}`;
    
    return index.get(key) || [];
  }
}
