#!/usr/bin/env node
/**
 * Gemini 批次補充與永久快取流程
 * 
 * 只在外部字典資料已存在，但缺少學習欄位時才呼叫 Gemini
 * 結果永久寫入 Supabase，標示 is_ai_enriched = true
 * 
 * 使用方式：
 * pnpm gemini:enrich --language=en --dry-run
 * pnpm gemini:enrich --all --confirm
 */

import { createClient } from '@supabase/supabase-js';

interface EnrichmentStats {
  totalEntries: number;
  enrichedCount: number;
  skippedCount: number;
  failedCount: number;
  estimatedCost: number;
}

interface EnrichmentResult {
  language: string;
  stats: EnrichmentStats;
  success: boolean;
  error?: string;
}

class GeminiBatchEnrichment {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  async enrichLanguage(
    language: string,
    dryRun: boolean = false
  ): Promise<EnrichmentResult> {
    console.log(`\n=== Enriching ${language} dictionary entries ===\n`);

    try {
      // 1. 獲取需要補充的條目
      const entries = await this.getEntriesNeedingEnrichment(language);

      const stats: EnrichmentStats = {
        totalEntries: entries.length,
        enrichedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        estimatedCost: 0,
      };

      if (entries.length === 0) {
        console.log('No entries need enrichment');
        return {
          language,
          stats,
          success: true,
        };
      }

      console.log(`Found ${entries.length} entries needing enrichment`);

      // 2. 批次處理
      const batchSize = 10;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entries.length / batchSize)}`);

        for (const entry of batch) {
          try {
            if (dryRun) {
              stats.enrichedCount++;
              stats.estimatedCost += 0.002;
            } else {
              const enriched = await this.enrichEntry(entry, language);
              if (enriched) {
                await this.updateEntry(entry.id, enriched);
                stats.enrichedCount++;
                stats.estimatedCost += 0.002;
              } else {
                stats.skippedCount++;
              }
            }
          } catch (error) {
            console.error(`Failed to enrich entry ${entry.id}:`, error);
            stats.failedCount++;
          }
        }
      }

      console.log(`\n--- ${language} Enrichment Summary ---`);
      console.log(`Total entries: ${stats.totalEntries}`);
      console.log(`Enriched: ${stats.enrichedCount}`);
      console.log(`Skipped: ${stats.skippedCount}`);
      console.log(`Failed: ${stats.failedCount}`);
      console.log(`Estimated cost: $${stats.estimatedCost.toFixed(2)}`);

      return {
        language,
        stats,
        success: true,
      };
    } catch (error) {
      return {
        language,
        stats: {
          totalEntries: 0,
          enrichedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          estimatedCost: 0,
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async enrichAll(dryRun: boolean = false): Promise<EnrichmentResult[]> {
    const languages = ['en', 'ja', 'ko', 'it', 'es'];
    const results: EnrichmentResult[] = [];

    for (const language of languages) {
      const result = await this.enrichLanguage(language, dryRun);
      results.push(result);
    }

    return results;
  }

  private async getEntriesNeedingEnrichment(language: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('dictionary_entries')
      .select('*')
      .eq('language_code', language)
      .is('is_ai_enriched', false)
      .limit(1000);

    if (error) {
      throw new Error(`Failed to fetch entries: ${error.message}`);
    }

    // 過濾出真正需要補充的條目
    return (data || []).filter((entry: any) => {
      const hasZhTw = entry.definitions_zh_tw_json && entry.definitions_zh_tw_json.length > 0;
      const hasExamples = entry.examples_json && entry.examples_json.length > 0;
      const hasCefr = !!entry.cefr_level;

      return !hasZhTw || !hasExamples || !hasCefr;
    });
  }

  private async enrichEntry(entry: { id: string; display_word: string; is_ai_enriched: boolean }, language: string): Promise<any | null> {
    // 檢查是否已經補充過
    if (entry.is_ai_enriched) {
      return null;
    }

    // TODO: 實際實作 Gemini API 呼叫
    // 這裡需要安裝 @google/generative-ai 套件
    // 暫時返回 null
    console.log(`Would enrich entry: ${entry.display_word} (${language})`);
    return null;
  }

  private buildEnrichmentPrompt(entry: { display_word: string; part_of_speech?: string; definitions_json?: any[]; examples_json?: any[] }, language: string): string {
    return `You are a language learning assistant. Please enrich the following dictionary entry with learning-focused content.

Word: ${entry.display_word}
Language: ${language}
Part of Speech: ${entry.part_of_speech || 'N/A'}
Existing Definitions: ${JSON.stringify(entry.definitions_json || [])}
Existing Examples: ${JSON.stringify(entry.examples_json || [])}

Please provide the following in JSON format:
{
  "definitions_zh_tw": ["繁體中文學習解釋 1", "繁體中文學習解釋 2"],
  "examples": ["場景化例句 1", "場景化例句 2"],
  "cefr_level": "A1/A2/B1/B2/C1/C2",
  "collocations": ["常見搭配詞 1", "常見搭配詞 2"],
  "topic_tags": ["主題標籤 1", "主題標籤 2"],
  "learning_tips": "學習提示"
}

Requirements:
- Only provide Traditional Chinese definitions and examples
- Examples should be contextual and useful for language learners
- CEFR level should be accurate based on word difficulty
- If you cannot confidently determine the information, keep existing data
- Do not fabricate word meanings`;
  }

  private parseGeminiResponse(text: string, entry: any): any {
    try {
      // 嘗試解析 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        return {
          definitions_zh_tw_json: parsed.definitions_zh_tw || entry.definitions_zh_tw_json,
          examples_json: parsed.examples || entry.examples_json,
          cefr_level: parsed.cefr_level || entry.cefr_level,
          collocations_json: parsed.collocations || entry.collocations_json,
          topic_tags_json: parsed.topic_tags || entry.topic_tags_json,
          is_ai_enriched: true,
          content_version: (entry.content_version || 0) + 1,
          updated_at: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
    }

    // 解析失敗，返回 null
    return null;
  }

  private async updateEntry(entryId: string, enriched: any): Promise<void> {
    const { error } = await this.supabase
      .from('dictionary_entries')
      .update(enriched)
      .eq('id', entryId);

    if (error) {
      throw new Error(`Failed to update entry: ${error.message}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const languageFlag = args.find(arg => arg.startsWith('--language='));
  const allFlag = args.includes('--all');
  const dryRunFlag = args.includes('--dry-run');
  const confirmFlag = args.includes('--confirm');

  const enricher = new GeminiBatchEnrichment();
  const dryRun = dryRunFlag && !confirmFlag;

  if (allFlag) {
    if (dryRun) {
      console.log('DRY RUN MODE - No changes will be made\n');
    }
    const results = await enricher.enrichAll(dryRun);
    console.log('\n=== Enrichment Summary ===');
    results.forEach(result => {
      if (result.success) {
        console.log(`${result.language}: ${result.stats.enrichedCount} enriched`);
      } else {
        console.error(`${result.language}: Failed - ${result.error}`);
      }
    });
  } else if (languageFlag) {
    const language = languageFlag.split('=')[1];
    if (dryRun) {
      console.log('DRY RUN MODE - No changes will be made\n');
    }
    const result = await enricher.enrichLanguage(language, dryRun);
    console.log('\n=== Enrichment Summary ===');
    if (result.success) {
      console.log(`${result.language}: ${result.stats.enrichedCount} enriched`);
    } else {
      console.error(`${result.language}: Failed - ${result.error}`);
    }
  } else {
    console.log('Usage:');
    console.log('  pnpm gemini:enrich --language=en --dry-run');
    console.log('  pnpm gemini:enrich --all --confirm');
  }
}

main().catch(console.error);
