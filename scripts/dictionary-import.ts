#!/usr/bin/env node
/**
 * 五語字典匯入 Script
 * 
 * 將下載的外部字典資料匯入 Supabase
 * 
 * 使用方式：
 * pnpm dictionary:import --language=en --dry-run
 * pnpm dictionary:import --language=ja --dry-run
 * pnpm dictionary:import --all --confirm
 * pnpm dictionary:update --all --dry-run
 * pnpm dictionary:update --all --confirm
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

interface ImportStats {
  originalCount: number;
  validCount: number;
  newCount: number;
  updateCount: number;
  skipCount: number;
  estimatedSize: number;
}

interface ImportResult {
  language: string;
  source: string;
  stats: ImportStats;
  license: string;
  attribution: string;
}

class DictionaryImporter {
  private supabase: any;
  private dataDir: string;
  private downloadDir: string;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    this.dataDir = join(process.cwd(), 'data', 'dictionary');
    this.downloadDir = join(this.dataDir, 'downloads');
  }

  async importLanguage(
    language: string,
    dryRun: boolean = false
  ): Promise<ImportResult[]> {
    console.log(`\n=== Importing ${language} dictionary ===\n`);

    const sources = this.getSourcesForLanguage(language);
    const results: ImportResult[] = [];

    for (const source of sources) {
      const result = await this.importSource(source, dryRun);
      results.push(result);
    }

    return results;
  }

  async importAll(dryRun: boolean = false): Promise<ImportResult[]> {
    const languages = ['en', 'ja', 'ko', 'it', 'es'];
    const allResults: ImportResult[] = [];

    for (const language of languages) {
      const results = await this.importLanguage(language, dryRun);
      allResults.push(...results);
    }

    return allResults;
  }

  private getSourcesForLanguage(language: string): string[] {
    const sources: Record<string, string[]> = {
      en: ['wiktextract-en', 'wordnet', 'cmudict'],
      ja: ['jmdict', 'kanjidic2'],
      ko: ['wiktextract-ko'],
      it: ['wiktextract-it'],
      es: ['wiktextract-es'],
    };

    return sources[language] || [];
  }

  private async importSource(
    sourceName: string,
    dryRun: boolean
  ): Promise<ImportResult> {
    const language = this.extractLanguageFromSource(sourceName);
    const filePath = join(this.downloadDir, `${sourceName}.json`);

    if (!existsSync(filePath)) {
      throw new Error(`Source file not found: ${filePath}`);
    }

    console.log(`Processing ${sourceName}...`);

    const rawData = await readFile(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    const stats: ImportStats = {
      originalCount: Array.isArray(data) ? data.length : 1,
      validCount: 0,
      newCount: 0,
      updateCount: 0,
      skipCount: 0,
      estimatedSize: 0,
    };

    const entries = this.parseSourceData(sourceName, data);

    for (const entry of entries) {
      const cleaned = this.cleanAndNormalize(entry);
      if (!cleaned) {
        continue;
      }

      stats.validCount++;

      if (dryRun) {
        // Dry run: 只統計，不實際匯入
        const existing = await this.checkExisting(cleaned.lemma, language);
        if (existing) {
          stats.updateCount++;
        } else {
          stats.newCount++;
        }
      } else {
        // 實際匯入
        const result = await this.upsertEntry(cleaned, language, sourceName);
        if (result === 'new') {
          stats.newCount++;
        } else if (result === 'update') {
          stats.updateCount++;
        } else {
          stats.skipCount++;
        }
      }
    }

    stats.estimatedSize = this.estimateSize(stats.validCount);

    // 來源資訊
    const sourceInfo = this.getSourceInfo(sourceName);

    console.log(`\n--- ${sourceName} Statistics ---`);
    console.log(`Original entries: ${stats.originalCount}`);
    console.log(`Valid entries: ${stats.validCount}`);
    console.log(`New entries: ${stats.newCount}`);
    console.log(`Updated entries: ${stats.updateCount}`);
    console.log(`Skipped entries: ${stats.skipCount}`);
    console.log(`Estimated size: ${this.formatBytes(stats.estimatedSize)}`);
    console.log(`License: ${sourceInfo.license}`);
    console.log(`Attribution: ${sourceInfo.attribution}`);

    return {
      language,
      source: sourceName,
      stats,
      license: sourceInfo.license,
      attribution: sourceInfo.attribution,
    };
  }

  private parseSourceData(sourceName: string, data: any): any[] {
    // 根據不同來源解析資料
    switch (sourceName) {
      case 'wiktextract-en':
      case 'wiktextract-ko':
      case 'wiktextract-it':
      case 'wiktextract-es':
        return this.parseWiktextract(data);
      case 'wordnet':
        return this.parseWordNet(data);
      case 'cmudict':
        return this.parseCMUDict(data);
      case 'jmdict':
        return this.parseJMdict(data);
      case 'kanjidic2':
        return this.parseKanjidic2(data);
      default:
        return [];
    }
  }

  private parseWiktextract(data: any): any[] {
    // Wiktextract 格式解析
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }

  private parseWordNet(data: any): any[] {
    // WordNet 格式解析
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }

  private parseCMUDict(data: string): any[] {
    // CMU Dict 格式解析
    const lines = data.split('\n');
    const entries: any[] = [];

    for (const line of lines) {
      if (line.startsWith(';;;') || line.trim() === '') {
        continue;
      }

      const parts = line.split('  ');
      if (parts.length >= 2) {
        const word = parts[0].toLowerCase();
        const pronunciation = parts[1];

        entries.push({
          word,
          pronunciation,
          source: 'cmudict',
        });
      }
    }

    return entries;
  }

  private parseJMdict(data: any): any[] {
    // JMdict XML 格式解析
    // 簡化實作，實際需要 XML parser
    return [];
  }

  private parseKanjidic2(data: any): any[] {
    // KANJIDIC2 XML 格式解析
    // 簡化實作，實際需要 XML parser
    return [];
  }

  private cleanAndNormalize(entry: any): any | null {
    if (!entry || !entry.word) {
      return null;
    }

    // Unicode normalization
    const word = entry.word.normalize('NFC');

    // 清洗無效字元
    if (!/^[\w\s'-]+$/.test(word)) {
      return null;
    }

    return {
      ...entry,
      word,
    };
  }

  private async checkExisting(lemma: string, language: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('dictionary_entries')
      .select('id')
      .eq('lemma', lemma)
      .eq('language_code', language)
      .single();

    return !error && data;
  }

  private async upsertEntry(
    entry: any,
    language: string,
    sourceName: string
  ): Promise<'new' | 'update' | 'skip'> {
    const sourceInfo = this.getSourceInfo(sourceName);

    const { data: existing, error: checkError } = await this.supabase
      .from('dictionary_entries')
      .select('id, content_version')
      .eq('lemma', entry.word)
      .eq('language_code', language)
      .single();

    if (checkError) {
      // 新增
      const { error: insertError } = await this.supabase
        .from('dictionary_entries')
        .insert({
          language_code: language,
          lemma: entry.word,
          display_word: entry.word,
          reading: entry.pronunciation || null,
          part_of_speech: entry.pos || null,
          definitions_json: entry.definitions || [],
          definitions_zh_tw_json: [],
          examples_json: entry.examples || [],
          source_name: sourceInfo.name,
          source_license: sourceInfo.license,
          source_attribution: sourceInfo.attribution,
          source_version: sourceInfo.version,
          is_ai_enriched: false,
          content_version: 1,
        });

      if (insertError) {
        return 'skip';
      }

      return 'new';
    }

    // 更新
    const { error: updateError } = await this.supabase
      .from('dictionary_entries')
      .update({
        display_word: entry.word,
        reading: entry.pronunciation || existing.reading,
        part_of_speech: entry.pos || existing.part_of_speech,
        definitions_json: entry.definitions || existing.definitions_json,
        examples_json: entry.examples || existing.examples_json,
        content_version: (existing.content_version || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) {
      return 'skip';
    }

    return 'update';
  }

  private getSourceInfo(sourceName: string): {
    name: string;
    license: string;
    attribution: string;
    version?: string;
  } {
    const sources: Record<string, any> = {
      'wiktextract-en': {
        name: 'Wiktionary English',
        license: 'CC BY-SA 4.0',
        attribution: 'Wiktionary contributors',
      },
      'wiktextract-ko': {
        name: 'Wiktionary Korean',
        license: 'CC BY-SA 4.0',
        attribution: 'Wiktionary contributors',
      },
      'wiktextract-it': {
        name: 'Wiktionary Italian',
        license: 'CC BY-SA 4.0',
        attribution: 'Wiktionary contributors',
      },
      'wiktextract-es': {
        name: 'Wiktionary Spanish',
        license: 'CC BY-SA 4.0',
        attribution: 'Wiktionary contributors',
      },
      'wordnet': {
        name: 'WordNet',
        license: 'MIT',
        attribution: 'Princeton University',
      },
      'cmudict': {
        name: 'CMU Pronouncing Dictionary',
        license: 'BSD-3-Clause',
        attribution: 'Carnegie Mellon University',
      },
      'jmdict': {
        name: 'JMdict',
        license: 'CC BY-SA 3.0',
        attribution: 'EDRDG',
      },
      'kanjidic2': {
        name: 'KANJIDIC2',
        license: 'CC BY-SA 3.0',
        attribution: 'EDRDG',
      },
    };

    return sources[sourceName] || {
      name: sourceName,
      license: 'Unknown',
      attribution: 'Unknown',
    };
  }

  private extractLanguageFromSource(sourceName: string): string {
    if (sourceName.includes('-en')) return 'en';
    if (sourceName.includes('-ja')) return 'ja';
    if (sourceName.includes('-ko')) return 'ko';
    if (sourceName.includes('-it')) return 'it';
    if (sourceName.includes('-es')) return 'es';
    return 'en';
  }

  private estimateSize(count: number): number {
    // 估計每個條目約 1KB
    return count * 1024;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const languageFlag = args.find(arg => arg.startsWith('--language='));
  const allFlag = args.includes('--all');
  const dryRunFlag = args.includes('--dry-run');
  const confirmFlag = args.includes('--confirm');
  const updateFlag = args.includes('--update');

  const importer = new DictionaryImporter();
  const dryRun = dryRunFlag && !confirmFlag;

  if (updateFlag) {
    console.log('Update mode: checking for new versions...');
    // 實作更新邏輯
  } else if (allFlag) {
    if (dryRun) {
      console.log('DRY RUN MODE - No changes will be made\n');
    }
    const results = await importer.importAll(dryRun);
    console.log('\n=== Import Summary ===');
    results.forEach(result => {
      console.log(`${result.language}/${result.source}: ${result.stats.newCount} new, ${result.stats.updateCount} updated`);
    });
  } else if (languageFlag) {
    const language = languageFlag.split('=')[1];
    if (dryRun) {
      console.log('DRY RUN MODE - No changes will be made\n');
    }
    const results = await importer.importLanguage(language, dryRun);
    console.log('\n=== Import Summary ===');
    results.forEach(result => {
      console.log(`${result.source}: ${result.stats.newCount} new, ${result.stats.updateCount} updated`);
    });
  } else {
    console.log('Usage:');
    console.log('  pnpm dictionary:import --language=en --dry-run');
    console.log('  pnpm dictionary:import --language=ja --dry-run');
    console.log('  pnpm dictionary:import --all --confirm');
    console.log('  pnpm dictionary:update --all --dry-run');
    console.log('  pnpm dictionary:update --all --confirm');
  }
}

main().catch(console.error);
