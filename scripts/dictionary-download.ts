#!/usr/bin/env node
/**
 * 五語字典下載 Script
 * 
 * 支援語言：
 * - en: 英文 (Kaikki/Wiktextract, WordNet, CMU Pronouncing Dictionary)
 * - ja: 日文 (JMdict, KANJIDIC2)
 * - ko: 韓文 (Kaikki/Wiktextract Korean)
 * - it: 義大利文 (Kaikki/Wiktextract Italian)
 * - es: 西班牙文 (Kaikki/Wiktextract Spanish)
 * 
 * 使用方式：
 * pnpm dictionary:download --language=en
 * pnpm dictionary:download --language=ja
 * pnpm dictionary:download --all
 */

import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';
import { join } from 'path';
import { mkdir } from 'fs/promises';

interface DictionarySource {
  name: string;
  language: string;
  url: string;
  license: string;
  attribution: string;
  version?: string;
  format: 'json' | 'xml' | 'txt' | 'gz';
}

const DICTIONARY_SOURCES: Record<string, DictionarySource[]> = {
  en: [
    {
      name: 'wiktextract-en',
      language: 'en',
      url: 'https://github.com/tatuylonen/wiktextract/raw/master/data/en/wiktextract-en.json.gz',
      license: 'CC BY-SA 4.0',
      attribution: 'Wiktionary contributors',
      format: 'gz',
    },
    {
      name: 'wordnet',
      language: 'en',
      url: 'https://github.com/globalwordnet/english-wordnet/raw/master/src/wordnet/wn-data-en.json',
      license: 'MIT',
      attribution: 'Princeton University',
      format: 'json',
    },
    {
      name: 'cmudict',
      language: 'en',
      url: 'https://github.com/cmusphinx/cmudict/raw/master/cmudict.dict',
      license: 'BSD-3-Clause',
      attribution: 'Carnegie Mellon University',
      format: 'txt',
    },
  ],
  ja: [
    {
      name: 'jmdict',
      language: 'ja',
      url: 'https://github.com/datasets-io/jmdict/raw/master/JMdict_e.gz',
      license: 'CC BY-SA 3.0',
      attribution: 'EDRDG',
      format: 'gz',
    },
    {
      name: 'kanjidic2',
      language: 'ja',
      url: 'https://github.com/datasets-io/kanjidic2/raw/master/kanjidic2.xml.gz',
      license: 'CC BY-SA 3.0',
      attribution: 'EDRDG',
      format: 'gz',
    },
  ],
  ko: [
    {
      name: 'wiktextract-ko',
      language: 'ko',
      url: 'https://github.com/tatuylonen/wiktextract/raw/master/data/ko/wiktextract-ko.json.gz',
      license: 'CC BY-SA 4.0',
      attribution: 'Wiktionary contributors',
      format: 'gz',
    },
  ],
  it: [
    {
      name: 'wiktextract-it',
      language: 'it',
      url: 'https://github.com/tatuylonen/wiktextract/raw/master/data/it/wiktextract-it.json.gz',
      license: 'CC BY-SA 4.0',
      attribution: 'Wiktionary contributors',
      format: 'gz',
    },
  ],
  es: [
    {
      name: 'wiktextract-es',
      language: 'es',
      url: 'https://github.com/tatuylonen/wiktextract/raw/master/data/es/wiktextract-es.json.gz',
      license: 'CC BY-SA 4.0',
      attribution: 'Wiktionary contributors',
      format: 'gz',
    },
  ],
};

class DictionaryDownloader {
  private dataDir: string;
  private downloadDir: string;

  constructor() {
    this.dataDir = join(process.cwd(), 'data', 'dictionary');
    this.downloadDir = join(this.dataDir, 'downloads');
  }

  async downloadSource(source: DictionarySource): Promise<{
    success: boolean;
    filePath?: string;
    size?: number;
    error?: string;
  }> {
    try {
      await mkdir(this.downloadDir, { recursive: true });

      const fileName = `${source.name}.${source.format === 'gz' ? 'json.gz' : source.format}`;
      const filePath = join(this.downloadDir, fileName);

      console.log(`Downloading ${source.name} (${source.language})...`);

      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const chunks: Buffer[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(Buffer.from(value));
        loaded += value.length;

        if (total > 0) {
          const progress = Math.floor((loaded / total) * 100);
          process.stdout.write(`\rProgress: ${progress}% (${loaded}/${total} bytes)`);
        }
      }

      process.stdout.write('\n');

      // 寫入檔案
      const fileStream = createWriteStream(filePath);
      await pipeline(Readable.from(chunks), fileStream);

      // 如果是 gzip，解壓縮
      if (source.format === 'gz') {
        const jsonPath = filePath.replace('.gz', '');
        await this.decompressGzip(filePath, jsonPath);
        
        return {
          success: true,
          filePath: jsonPath,
          size: loaded,
        };
      }

      return {
        success: true,
        filePath,
        size: loaded,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async decompressGzip(inputPath: string, outputPath: string): Promise<void> {
    const fs = await import('fs');
    const input = fs.createReadStream(inputPath);
    const gunzip = createGunzip();
    const output = createWriteStream(outputPath);

    await pipeline(input, gunzip, output);
  }

  async downloadLanguage(language: string): Promise<void> {
    const sources = DICTIONARY_SOURCES[language];
    if (!sources) {
      console.error(`Unknown language: ${language}`);
      return;
    }

    console.log(`\n=== Downloading ${language} dictionary sources ===\n`);

    const results = [];
    for (const source of sources) {
      const result = await this.downloadSource(source);
      results.push({ source, result });

      if (result.success) {
        console.log(`✓ Downloaded ${source.name}: ${result.filePath} (${result.size} bytes)`);
      } else {
        console.error(`✗ Failed to download ${source.name}: ${result.error}`);
      }
    }

    // 保存下載記錄
    await this.saveDownloadRecord(language, results);
  }

  async downloadAll(): Promise<void> {
    const languages = Object.keys(DICTIONARY_SOURCES);
    
    for (const language of languages) {
      await this.downloadLanguage(language);
    }

    console.log('\n=== All downloads completed ===');
  }

  private async saveDownloadRecord(
    language: string,
    results: Array<{ source: DictionarySource; result: any }>
  ): Promise<void> {
    const record = {
      language,
      downloadedAt: new Date().toISOString(),
      sources: results.map(({ source, result }) => ({
        name: source.name,
        success: result.success,
        filePath: result.filePath,
        size: result.size,
        error: result.error,
      })),
    };

    const recordPath = join(this.downloadDir, `${language}-download-record.json`);
    const recordStream = createWriteStream(recordPath);
    recordStream.write(JSON.stringify(record, null, 2));
    recordStream.end();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const languageFlag = args.find(arg => arg.startsWith('--language='));
  const allFlag = args.includes('--all');

  const downloader = new DictionaryDownloader();

  if (allFlag) {
    await downloader.downloadAll();
  } else if (languageFlag) {
    const language = languageFlag.split('=')[1];
    await downloader.downloadLanguage(language);
  } else {
    console.log('Usage:');
    console.log('  pnpm dictionary:download --language=en');
    console.log('  pnpm dictionary:download --language=ja');
    console.log('  pnpm dictionary:download --language=ko');
    console.log('  pnpm dictionary:download --language=it');
    console.log('  pnpm dictionary:download --language=es');
    console.log('  pnpm dictionary:download --all');
  }
}

main().catch(console.error);
