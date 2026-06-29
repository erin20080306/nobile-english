#!/usr/bin/env node
/**
 * Five-language dictionary downloader.
 *
 * Use dry-run/source filtering for smoke checks before downloading large files:
 *   npm run dictionary:download -- --language=en --source=cmudict --dry-run
 *   npm run dictionary:download -- --language=ja --source=kanjidic2
 */

import { createReadStream, createWriteStream } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";

type LanguageCode = "en" | "ja" | "ko" | "it" | "es";
type OutputFormat = "json" | "jsonl" | "xml" | "txt";

interface DictionarySource {
  name: string;
  language: LanguageCode;
  url: string;
  license: string;
  attribution: string;
  version?: string;
  outputFormat: OutputFormat;
  compressed?: boolean;
}

interface DownloadOptions {
  languages: LanguageCode[];
  sources: string[];
  dryRun: boolean;
  checkSources: boolean;
}

const DICTIONARY_SOURCES: Record<LanguageCode, DictionarySource[]> = {
  en: [
    {
      name: "wiktextract-en",
      language: "en",
      url: "https://github.com/tatuylonen/wiktextract/raw/master/data/en/wiktextract-en.json.gz",
      license: "CC BY-SA 4.0",
      attribution: "Wiktionary contributors",
      outputFormat: "jsonl",
      compressed: true,
    },
    {
      name: "wordnet",
      language: "en",
      url: "https://github.com/globalwordnet/english-wordnet/raw/master/src/wordnet/wn-data-en.json",
      license: "MIT",
      attribution: "Princeton University / Open English WordNet",
      outputFormat: "json",
    },
    {
      name: "cmudict",
      language: "en",
      url: "https://github.com/cmusphinx/cmudict/raw/master/cmudict.dict",
      license: "BSD-3-Clause",
      attribution: "Carnegie Mellon University",
      outputFormat: "txt",
    },
  ],
  ja: [
    {
      name: "jmdict",
      language: "ja",
      url: "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz",
      license: "CC BY-SA 3.0",
      attribution: "EDRDG",
      outputFormat: "xml",
      compressed: true,
    },
    {
      name: "kanjidic2",
      language: "ja",
      url: "http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz",
      license: "CC BY-SA 3.0",
      attribution: "EDRDG",
      outputFormat: "xml",
      compressed: true,
    },
  ],
  ko: [
    {
      name: "wiktextract-ko",
      language: "ko",
      url: "https://github.com/tatuylonen/wiktextract/raw/master/data/ko/wiktextract-ko.json.gz",
      license: "CC BY-SA 4.0",
      attribution: "Wiktionary contributors",
      outputFormat: "jsonl",
      compressed: true,
    },
  ],
  it: [
    {
      name: "wiktextract-it",
      language: "it",
      url: "https://github.com/tatuylonen/wiktextract/raw/master/data/it/wiktextract-it.json.gz",
      license: "CC BY-SA 4.0",
      attribution: "Wiktionary contributors",
      outputFormat: "jsonl",
      compressed: true,
    },
  ],
  es: [
    {
      name: "wiktextract-es",
      language: "es",
      url: "https://github.com/tatuylonen/wiktextract/raw/master/data/es/wiktextract-es.json.gz",
      license: "CC BY-SA 4.0",
      attribution: "Wiktionary contributors",
      outputFormat: "jsonl",
      compressed: true,
    },
  ],
};

class DictionaryDownloader {
  private dataDir = join(process.cwd(), "data", "dictionary");
  private downloadDir = join(this.dataDir, "downloads");

  async downloadAll(options: DownloadOptions): Promise<void> {
    await mkdir(this.downloadDir, { recursive: true });
    const results = [];

    for (const language of options.languages) {
      for (const source of this.sourcesForLanguage(language, options.sources)) {
        if (options.dryRun) {
          const paths = this.pathsForSource(source);
          console.log(`[dry-run] ${source.language}/${source.name}`);
          console.log(`  url: ${source.url}`);
          console.log(`  output: ${paths.outputPath}`);
          console.log(`  license: ${source.license}`);
          results.push({ source, result: { success: true, dryRun: true, filePath: paths.outputPath } });
          continue;
        }

        if (options.checkSources) {
          const ok = await this.checkSource(source);
          results.push({ source, result: { success: ok } });
          continue;
        }

        const result = await this.downloadSource(source);
        results.push({ source, result });
      }
    }

    await this.saveDownloadRecord(results);
  }

  private sourcesForLanguage(language: LanguageCode, sourceFilters: string[]): DictionarySource[] {
    const sources = DICTIONARY_SOURCES[language] || [];
    if (sourceFilters.length === 0) return sources;
    return sources.filter(source => sourceFilters.includes(source.name));
  }

  private pathsForSource(source: DictionarySource): { compressedPath: string; outputPath: string } {
    const outputPath = join(this.downloadDir, `${source.name}.${source.outputFormat}`);
    return {
      compressedPath: `${outputPath}.gz`,
      outputPath,
    };
  }

  private async checkSource(source: DictionarySource): Promise<boolean> {
    console.log(`Checking ${source.name}...`);
    let response = await fetch(source.url, { method: "HEAD" });
    if (!response.ok) {
      response = await fetch(source.url, { method: "GET", headers: { Range: "bytes=0-0" } });
    }
    console.log(`${source.name}: HTTP ${response.status} ${response.statusText}`);
    return response.ok || response.status === 206;
  }

  private async downloadSource(source: DictionarySource): Promise<{
    success: boolean;
    filePath?: string;
    size?: number;
    error?: string;
  }> {
    try {
      await mkdir(this.downloadDir, { recursive: true });
      const { compressedPath, outputPath } = this.pathsForSource(source);
      const targetPath = source.compressed ? compressedPath : outputPath;

      console.log(`Downloading ${source.name} (${source.language})...`);
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error("Response body is empty.");
      }

      const total = Number(response.headers.get("content-length") || 0);
      let loaded = 0;
      const progress = new Transform({
        transform(chunk, _encoding, callback) {
          loaded += chunk.length;
          if (total > 0) {
            const pct = Math.min(100, Math.floor((loaded / total) * 100));
            process.stdout.write(`\rProgress: ${pct}% (${loaded}/${total} bytes)`);
          } else {
            process.stdout.write(`\rDownloaded: ${loaded} bytes`);
          }
          callback(null, chunk);
        },
      });

      await pipeline(
        Readable.fromWeb(response.body as any),
        progress,
        createWriteStream(targetPath)
      );
      process.stdout.write("\n");

      if (source.compressed) {
        await pipeline(
          createReadStream(targetPath),
          createGunzip(),
          createWriteStream(outputPath)
        );
      }

      console.log(`Saved ${source.name}: ${outputPath}`);
      return { success: true, filePath: outputPath, size: loaded };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed ${source.name}: ${message}`);
      return { success: false, error: message };
    }
  }

  private async saveDownloadRecord(
    results: Array<{ source: DictionarySource; result: any }>
  ): Promise<void> {
    const record = {
      downloadedAt: new Date().toISOString(),
      sources: results.map(({ source, result }) => ({
        name: source.name,
        language: source.language,
        success: result.success,
        dryRun: Boolean(result.dryRun),
        filePath: result.filePath,
        size: result.size,
        error: result.error,
        license: source.license,
        attribution: source.attribution,
        version: source.version,
      })),
    };

    await writeFile(join(this.downloadDir, "download-record.json"), JSON.stringify(record, null, 2));
  }
}

function parseCliOptions(args: string[]): DownloadOptions {
  const allFlag = args.includes("--all");
  const languageFlag = args.find(arg => arg.startsWith("--language="));
  const sourceFlags = args.filter(arg => arg.startsWith("--source=") || arg.startsWith("--sources="));

  return {
    languages: allFlag
      ? ["en", "ja", "ko", "it", "es"]
      : languageFlag
        ? [languageFlag.split("=")[1] as LanguageCode]
        : [],
    sources: sourceFlags.flatMap(flag => flag.split("=")[1].split(",").map(value => value.trim()).filter(Boolean)),
    dryRun: args.includes("--dry-run"),
    checkSources: args.includes("--check-sources"),
  };
}

function printUsage(): void {
  console.log("Usage:");
  console.log("  npm run dictionary:download -- --language=en --source=cmudict --dry-run");
  console.log("  npm run dictionary:download -- --language=ja --source=kanjidic2");
  console.log("  npm run dictionary:download -- --all --check-sources");
  console.log("  npm run dictionary:download -- --all");
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.languages.length === 0) {
    printUsage();
    return;
  }

  await new DictionaryDownloader().downloadAll(options);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
