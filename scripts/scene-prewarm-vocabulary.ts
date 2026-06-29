#!/usr/bin/env node
/**
 * 100 場景五語單字與片語預熱 Script
 * 
 * 為場景預先建立單字卡、片語卡與詞形索引
 * 
 * 使用方式：
 * pnpm scenes:prewarm-vocabulary --scene=<sceneId>
 * pnpm scenes:prewarm-vocabulary --all --dry-run
 * pnpm scenes:prewarm-vocabulary --all --confirm
 */

import { createClient } from '@supabase/supabase-js';
import { LemmatizationFlow } from './lemmatizationFlow';
import { DataCleaningRules } from './dataCleaningRules';

interface SceneVocabularyStats {
  sceneCount: number;
  sentenceCount: number;
  wordCount: number;
  phraseCount: number;
  existingCardCount: number;
  missingCardCount: number;
  needsGeminiCount: number;
  estimatedGeminiCost: number;
}

interface PrewarmResult {
  sceneId: string;
  language: string;
  stats: SceneVocabularyStats;
  success: boolean;
  error?: string;
}

class SceneVocabularyPrewarmer {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  async prewarmScene(
    sceneId: string,
    dryRun: boolean = false
  ): Promise<PrewarmResult> {
    console.log(`\n=== Prewarming scene: ${sceneId} ===\n`);

    try {
      // 1. 讀取場景資料
      const sceneData = await this.getSceneData(sceneId);
      if (!sceneData) {
        throw new Error(`Scene not found: ${sceneId}`);
      }

      // 2. 處理五語
      const languages = ['en', 'ja', 'ko', 'it', 'es'];
      const allStats: SceneVocabularyStats = {
        sceneCount: 1,
        sentenceCount: 0,
        wordCount: 0,
        phraseCount: 0,
        existingCardCount: 0,
        missingCardCount: 0,
        needsGeminiCount: 0,
        estimatedGeminiCost: 0,
      };

      for (const language of languages) {
        const stats = await this.prewarmSceneLanguage(sceneId, language, sceneData, dryRun);
        
        allStats.sentenceCount += stats.sentenceCount;
        allStats.wordCount += stats.wordCount;
        allStats.phraseCount += stats.phraseCount;
        allStats.existingCardCount += stats.existingCardCount;
        allStats.missingCardCount += stats.missingCardCount;
        allStats.needsGeminiCount += stats.needsGeminiCount;
        allStats.estimatedGeminiCost += stats.estimatedGeminiCost;
      }

      console.log(`\n--- Scene ${sceneId} Summary ---`);
      console.log(`Total sentences: ${allStats.sentenceCount}`);
      console.log(`Total words: ${allStats.wordCount}`);
      console.log(`Total phrases: ${allStats.phraseCount}`);
      console.log(`Existing cards: ${allStats.existingCardCount}`);
      console.log(`Missing cards: ${allStats.missingCardCount}`);
      console.log(`Needs Gemini: ${allStats.needsGeminiCount}`);
      console.log(`Estimated Gemini cost: $${allStats.estimatedGeminiCost.toFixed(2)}`);

      return {
        sceneId,
        language: 'all',
        stats: allStats,
        success: true,
      };
    } catch (error) {
      return {
        sceneId,
        language: 'all',
        stats: {
          sceneCount: 0,
          sentenceCount: 0,
          wordCount: 0,
          phraseCount: 0,
          existingCardCount: 0,
          missingCardCount: 0,
          needsGeminiCount: 0,
          estimatedGeminiCost: 0,
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async prewarmAll(dryRun: boolean = false): Promise<PrewarmResult[]> {
    console.log('\n=== Prewarming all scenes ===\n');

    // 獲取所有場景
    const { data: scenes, error } = await this.supabase
      .from('scenes')
      .select('id')
      .eq('status', 'published');

    if (error) {
      throw new Error(`Failed to fetch scenes: ${error.message}`);
    }

    const results: PrewarmResult[] = [];

    for (const scene of scenes) {
      const result = await this.prewarmScene(scene.id, dryRun);
      results.push(result);
    }

    console.log('\n=== All scenes prewarmed ===');
    return results;
  }

  private async getSceneData(sceneId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('scenes')
      .select('*')
      .eq('id', sceneId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch scene data: ${error.message}`);
    }

    return data;
  }

  private async prewarmSceneLanguage(
    sceneId: string,
    language: string,
    sceneData: any,
    dryRun: boolean
  ): Promise<SceneVocabularyStats> {
    console.log(`Processing ${language}...`);

    const stats: SceneVocabularyStats = {
      sceneCount: 1,
      sentenceCount: 0,
      wordCount: 0,
      phraseCount: 0,
      existingCardCount: 0,
      missingCardCount: 0,
      needsGeminiCount: 0,
      estimatedGeminiCost: 0,
    };

    // 1. 讀取場景句子
    const sentences = await this.getSceneSentences(sceneId, language);
    stats.sentenceCount = sentences.length;

    // 2. 切詞與詞形還原
    const wordsAndPhrases = this.tokenizeAndLemmatize(sentences, language);

    // 3. 優先辨識最長片語
    const phrases = this.identifyPhrases(wordsAndPhrases, language);
    stats.phraseCount = phrases.length;

    // 4. 建立詞形索引
    const lexemeLinks = this.buildLexemeLinks(sceneId, language, sentences, phrases);

    // 5. 從 Supabase 取得單字資料
    const vocabularyData = await this.fetchVocabularyData(wordsAndPhrases, language);

    // 6. 檢查缺少的資料
    const missingData = this.checkMissingData(vocabularyData);
    stats.missingCardCount = missingData.length;
    stats.needsGeminiCount = missingData.filter(
      item => item.needsGeminiEnrichment
    ).length;
    stats.estimatedGeminiCost = stats.needsGeminiCount * 0.002; // 估計每次 Gemini 補充成本

    // 7. 寫入 scene_lexeme_links
    if (!dryRun) {
      await this.writeLexemeLinks(lexemeLinks);
    }

    // 8. 建立 language content pack
    if (!dryRun) {
      await this.createLanguageContentPack(sceneId, language, vocabularyData);
    }

    return stats;
  }

  private async getSceneSentences(sceneId: string, language: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('scene_sentences')
      .select('text')
      .eq('scene_id', sceneId)
      .eq('language_code', language);

    if (error) {
      throw new Error(`Failed to fetch sentences: ${error.message}`);
    }

    return data.map((item: any) => item.text);
  }

  private tokenizeAndLemmatize(sentences: string[], language: string): Array<{
    word: string;
    lemma: string;
    startIndex: number;
    endIndex: number;
  }> {
    const results: Array<{
      word: string;
      lemma: string;
      startIndex: number;
      endIndex: number;
    }> = [];

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);
      let currentIndex = 0;

      for (const word of words) {
        const startIndex = currentIndex;
        const endIndex = currentIndex + word.length;
        const lemmatization = LemmatizationFlow.lemmatize(word, language);

        results.push({
          word,
          lemma: lemmatization.lemma,
          startIndex,
          endIndex,
        });

        currentIndex = endIndex + 1; // +1 for space
      }
    }

    return results;
  }

  private identifyPhrases(
    wordsAndPhrases: any[],
    language: string
  ): Array<{
    phrase: string;
    lemma: string;
    startIndex: number;
    endIndex: number;
    priority: number;
  }> {
    // 常見片語清單（可擴充）
    const commonPhrases: Record<string, string[]> = {
      en: [
        'make a reservation',
        'a cup of coffee',
        'check in',
        'look for',
        'for here or to go',
        'would like to',
        'how much is it',
        'take your time',
        'nice to meet you',
      ],
      ja: [
        'お願いします',
        'ありがとうございます',
        'すみません',
        'よろしくお願いします',
      ],
      ko: [
        '주세요',
        '감사합니다',
        '죄송합니다',
        '부탁드립니다',
      ],
      it: [
        'per favore',
        'grazie',
        'scusi',
        'vorrei',
      ],
      es: [
        'por favor',
        'gracias',
        'disculpe',
        'me gustaría',
      ],
    };

    const phrases: Array<{
      phrase: string;
      lemma: string;
      startIndex: number;
      endIndex: number;
      priority: number;
    }> = [];

    const languagePhrases = commonPhrases[language] || [];

    for (const phrase of languagePhrases) {
      const phraseWords = phrase.split(' ');
      // 簡化實作：實際需要在句子中搜尋片語
      phrases.push({
        phrase,
        lemma: phrase.toLowerCase(),
        startIndex: 0,
        endIndex: phrase.length,
        priority: 10,
      });
    }

    return phrases;
  }

  private buildLexemeLinks(
    sceneId: string,
    language: string,
    sentences: string[],
    phrases: any[]
  ): any[] {
    const links: any[] = [];
    let sentenceIndex = 0;

    for (const sentence of sentences) {
      // 為每個片語建立連結
      for (const phrase of phrases) {
        links.push({
          id: `lexeme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          scene_id: sceneId,
          scene_version: 1,
          language_code: language,
          sentence_id: `sentence_${sentenceIndex}`,
          start_index: phrase.startIndex,
          end_index: phrase.endIndex,
          display_text: phrase.phrase,
          dictionary_entry_id: null, // 稍後填入
          phrase_priority: phrase.priority,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      sentenceIndex++;
    }

    return links;
  }

  private async fetchVocabularyData(
    wordsAndPhrases: any[],
    language: string
  ): Promise<any[]> {
    const lemmaSet = new Set(wordsAndPhrases.map(item => item.lemma));
    const lemmas = Array.from(lemmaSet);

    const { data, error } = await this.supabase
      .from('dictionary_entries')
      .select('*')
      .in('lemma', lemmas)
      .eq('language_code', language);

    if (error) {
      throw new Error(`Failed to fetch vocabulary data: ${error.message}`);
    }

    return data || [];
  }

  private checkMissingData(vocabularyData: any[]): Array<{
    lemma: string;
    needsGeminiEnrichment: boolean;
  }> {
    return vocabularyData
      .filter(entry => {
        // 檢查是否缺少繁中解釋、例句、CEFR 等學習欄位
        const hasZhTw = entry.definitions_zh_tw_json && entry.definitions_zh_tw_json.length > 0;
        const hasExamples = entry.examples_json && entry.examples_json.length > 0;
        const hasCefr = !!entry.cefr_level;

        return !hasZhTw || !hasExamples || !hasCefr;
      })
      .map(entry => ({
        lemma: entry.lemma,
        needsGeminiEnrichment: true,
      }));
  }

  private async writeLexemeLinks(links: any[]): Promise<void> {
    const { error } = await this.supabase
      .from('scene_lexeme_links')
      .insert(links);

    if (error) {
      throw new Error(`Failed to write lexeme links: ${error.message}`);
    }
  }

  private async createLanguageContentPack(
    sceneId: string,
    language: string,
    vocabularyData: any[]
  ): Promise<void> {
    const pack = {
      id: `pack_${sceneId}_${language}`,
      language_code: language,
      pack_version: 1,
      pack_type: 'basic',
      scene_ids: [sceneId],
      dictionary_entry_count: vocabularyData.length,
      audio_manifest: {},
      download_url: '',
      file_size_bytes: 0,
      is_required: false,
      released_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from('language_content_packs')
      .insert(pack);

    if (error) {
      throw new Error(`Failed to create language content pack: ${error.message}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const sceneFlag = args.find(arg => arg.startsWith('--scene='));
  const allFlag = args.includes('--all');
  const dryRunFlag = args.includes('--dry-run');
  const confirmFlag = args.includes('--confirm');

  const prewarmer = new SceneVocabularyPrewarmer();
  const dryRun = dryRunFlag && !confirmFlag;

  if (allFlag) {
    if (dryRun) {
      console.log('DRY RUN MODE - No changes will be made\n');
    }
    const results = await prewarmer.prewarmAll(dryRun);
    console.log('\n=== Prewarm Summary ===');
    results.forEach(result => {
      if (result.success) {
        console.log(`${result.sceneId}: ${result.stats.missingCardCount} missing cards`);
      } else {
        console.error(`${result.sceneId}: Failed - ${result.error}`);
      }
    });
  } else if (sceneFlag) {
    const sceneId = sceneFlag.split('=')[1];
    if (dryRun) {
      console.log('DRY RUN MODE - No changes will be made\n');
    }
    const result = await prewarmer.prewarmScene(sceneId, dryRun);
    console.log('\n=== Prewarm Summary ===');
    if (result.success) {
      console.log(`${result.sceneId}: ${result.stats.missingCardCount} missing cards`);
    } else {
      console.error(`${result.sceneId}: Failed - ${result.error}`);
    }
  } else {
    console.log('Usage:');
    console.log('  pnpm scenes:prewarm-vocabulary --scene=<sceneId>');
    console.log('  pnpm scenes:prewarm-vocabulary --all --dry-run');
    console.log('  pnpm scenes:prewarm-vocabulary --all --confirm');
  }
}

main().catch(console.error);
