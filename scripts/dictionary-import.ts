#!/usr/bin/env node
/**
 * Five-language dictionary importer.
 *
 * Goals:
 * - Parse Wiktextract JSON/JSONL, WordNet JSON, CMUdict TXT, JMdict XML, and KANJIDIC2 XML.
 * - Keep dry-run useful without Supabase credentials.
 * - Write dictionary entries in batches and never touch user learning tables.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createReadStream } from "fs";
import { access, mkdir, readFile, stat, writeFile } from "fs/promises";
import { join } from "path";
import readline from "readline";

type LanguageCode = "en" | "ja" | "ko" | "it" | "es";
type SourceFormat = "json" | "jsonl" | "txt" | "xml";
type SourceType = "wordnet" | "jmdict" | "kanjidic" | "wiktextract" | "custom";

interface DictionarySourceInfo {
  name: string;
  language: LanguageCode;
  sourceType: SourceType;
  license: string;
  attribution: string;
  version: string;
  fileExtensions: SourceFormat[];
}

interface RawEntry {
  word?: string;
  lemma?: string;
  displayWord?: string;
  reading?: string | null;
  romanization?: string | null;
  ipa?: string | null;
  pos?: string | null;
  definitions?: string[];
  definitionsZhTw?: string[];
  examples?: Array<{ text: string; translation?: string }>;
  surfaceForms?: string[];
  synonyms?: string[];
  antonyms?: string[];
  sourcePayload?: unknown;
}

interface NormalizedEntry {
  language_code: LanguageCode;
  lemma: string;
  display_word: string;
  reading: string | null;
  romanization: string | null;
  ipa: string | null;
  part_of_speech: string | null;
  definitions_json: string[];
  definitions_zh_tw_json: string[];
  examples_json: Array<{ text: string; translation?: string }>;
  synonyms_json: string[];
  antonyms_json: string[];
  cefr_level: string | null;
  frequency_rank: number | null;
  surfaceForms: Array<{ surface_form: string; normalized_form: string; form_type: "inflection" | "conjugation" | "declension" | "variant" }>;
  source: DictionarySourceInfo;
}

interface ImportStats {
  originalCount: number;
  parsedCount: number;
  validCount: number;
  newCount: number;
  updateCount: number;
  skipCount: number;
  failedCount: number;
  surfaceFormCount: number;
  estimatedSize: number;
  failures: string[];
}

interface ImportResult {
  language: LanguageCode;
  source: string;
  filePath?: string;
  format?: SourceFormat;
  dryRun: boolean;
  databaseChecked: boolean;
  stats: ImportStats;
  license: string;
  attribution: string;
  version: string;
}

interface CliOptions {
  languages: LanguageCode[];
  sources: string[];
  dryRun: boolean;
  confirm: boolean;
  seedLocal: boolean;
  resume: boolean;
  limit: number | null;
  batchSize: number;
  retryCount: number;
  reportJson: boolean;
  assumeNew: boolean;
  startRank: number;
}

const SOURCE_CATALOG: Record<string, DictionarySourceInfo> = {
  "wiktextract-en": {
    name: "wiktextract-en",
    language: "en",
    sourceType: "wiktextract",
    license: "CC BY-SA 4.0",
    attribution: "Wiktionary contributors",
    version: "wiktextract",
    fileExtensions: ["jsonl", "json"],
  },
  wordnet: {
    name: "wordnet",
    language: "en",
    sourceType: "wordnet",
    license: "MIT",
    attribution: "Princeton University / Open English WordNet",
    version: "english-wordnet",
    fileExtensions: ["json"],
  },
  cmudict: {
    name: "cmudict",
    language: "en",
    sourceType: "custom",
    license: "BSD-3-Clause",
    attribution: "Carnegie Mellon University",
    version: "cmusphinx/cmudict",
    fileExtensions: ["txt"],
  },
  jmdict: {
    name: "jmdict",
    language: "ja",
    sourceType: "jmdict",
    license: "CC BY-SA 3.0",
    attribution: "Electronic Dictionary Research and Development Group",
    version: "JMdict",
    fileExtensions: ["xml"],
  },
  kanjidic2: {
    name: "kanjidic2",
    language: "ja",
    sourceType: "kanjidic",
    license: "CC BY-SA 3.0",
    attribution: "Electronic Dictionary Research and Development Group",
    version: "KANJIDIC2",
    fileExtensions: ["xml"],
  },
  "wiktextract-ko": {
    name: "wiktextract-ko",
    language: "ko",
    sourceType: "wiktextract",
    license: "CC BY-SA 4.0",
    attribution: "Wiktionary contributors",
    version: "wiktextract",
    fileExtensions: ["jsonl", "json"],
  },
  "wiktextract-it": {
    name: "wiktextract-it",
    language: "it",
    sourceType: "wiktextract",
    license: "CC BY-SA 4.0",
    attribution: "Wiktionary contributors",
    version: "wiktextract",
    fileExtensions: ["jsonl", "json"],
  },
  "wiktextract-es": {
    name: "wiktextract-es",
    language: "es",
    sourceType: "wiktextract",
    license: "CC BY-SA 4.0",
    attribution: "Wiktionary contributors",
    version: "wiktextract",
    fileExtensions: ["jsonl", "json"],
  },
  "local-basic": {
    name: "local-basic",
    language: "en",
    sourceType: "custom",
    license: "Project local seed",
    attribution: "Mobile Language built-in dictionary",
    version: "local",
    fileExtensions: ["json"],
  },
};

const SOURCES_BY_LANGUAGE: Record<LanguageCode, string[]> = {
  en: ["wiktextract-en", "wordnet", "cmudict"],
  ja: ["jmdict", "kanjidic2"],
  ko: ["wiktextract-ko"],
  it: ["wiktextract-it"],
  es: ["wiktextract-es"],
};

const DEFAULT_BATCH_SIZE = 250;
const MAX_FAILURES_IN_REPORT = 20;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return decodeXml(value)
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedLookupForm(value: string, language: LanguageCode): string {
  const cleaned = cleanText(value);
  if (language === "en" || language === "it" || language === "es") {
    return cleaned.toLocaleLowerCase(language);
  }
  return cleaned;
}

function isUsableHeadword(value: string): boolean {
  if (!value || value.length > 120) return false;
  return Array.from(value).some((char) => {
    const code = char.codePointAt(0) || 0;
    return (
      (code >= 0x30 && code <= 0x39) ||
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      (code >= 0xff10 && code <= 0xff19) ||
      (code >= 0xff21 && code <= 0xff3a) ||
      (code >= 0xff41 && code <= 0xff5a) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0x3400 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x1100 && code <= 0x11ff)
    );
  });
}

function compactStrings(values: unknown[], limit = 8): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
    if (result.length >= limit) break;
  }

  return result;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-zA-Z0-9_-]+);/g, "$1");
}

function getTagValues(xml: string, tag: string): string[] {
  const values: string[] = [];
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml))) {
    values.push(cleanText(match[1]));
  }
  return values.filter(Boolean);
}

function firstTagValue(xml: string, tag: string): string {
  return getTagValues(xml, tag)[0] || "";
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function cefrForRank(rank: number): string {
  if (rank <= 1500) return "A1";
  if (rank <= 2500) return "A2";
  if (rank <= 4000) return "B1";
  if (rank <= 6000) return "B2";
  return "C1";
}

class DictionaryImporter {
  private supabase: SupabaseClient | null;
  private dataDir: string;
  private downloadDir: string;
  private progressPath: string;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    this.supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
    this.dataDir = join(process.cwd(), "data", "dictionary");
    this.downloadDir = join(this.dataDir, "downloads");
    this.progressPath = join(this.dataDir, "import-progress.json");
  }

  async importAll(options: CliOptions): Promise<ImportResult[]> {
    const results: ImportResult[] = [];
    for (const language of options.languages) {
      results.push(...await this.importLanguage(language, options));
    }
    return results;
  }

  async importLanguage(language: LanguageCode, options: CliOptions): Promise<ImportResult[]> {
    const sourceNames = options.seedLocal && options.sources.length === 0
      ? ["local-basic"]
      : options.sources.length > 0
        ? options.sources.filter(sourceName => SOURCE_CATALOG[sourceName]?.language === language || sourceName === "local-basic")
        : SOURCES_BY_LANGUAGE[language];

    const sources = uniqueStrings(sourceNames);
    const results: ImportResult[] = [];
    const completed = options.resume ? await this.readCompletedSources() : new Set<string>();

    for (const sourceName of sources) {
      const progressKey = `${language}:${sourceName}`;
      if (completed.has(progressKey)) {
        console.log(`Skipping ${progressKey}; already completed in resume file.`);
        continue;
      }

      const source = this.sourceFor(sourceName, language);
      const result = await this.withRetry(() => this.importSource(source, options), options.retryCount);
      results.push(result);

      if (!result.dryRun && result.stats.failedCount === 0 && options.resume) {
        await this.markSourceCompleted(progressKey);
      }
    }

    return results;
  }

  private async importSource(source: DictionarySourceInfo, options: CliOptions): Promise<ImportResult> {
    const stats = this.emptyStats();
    const databaseChecked = Boolean(this.supabase);
    let filePath: string | undefined;
    let format: SourceFormat | undefined;

    console.log(`\n=== ${options.dryRun ? "Dry-run" : "Importing"} ${source.language}/${source.name} ===`);

    if (!options.dryRun && !options.confirm) {
      throw new Error("Refusing to write without --confirm.");
    }

    if (!options.dryRun && !this.supabase) {
      throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    }

    if (!options.dryRun) {
      await this.upsertDictionarySource(source);
    }

    const batch: NormalizedEntry[] = [];
    let seenInSource = new Set<string>();

    if (source.name === "local-basic") {
      for await (const raw of this.iterateLocalEntries(source.language)) {
        const shouldContinue = await this.consumeRawEntry(raw, source, options, stats, batch, seenInSource);
        if (!shouldContinue) break;
      }
    } else {
      filePath = await this.findSourceFile(source);
      format = await this.detectFormat(source, filePath);
      console.log(`Source file: ${filePath}`);
      console.log(`Detected format: ${format}`);

      for await (const raw of this.iterateSourceEntries(source, filePath, format)) {
        const shouldContinue = await this.consumeRawEntry(raw, source, options, stats, batch, seenInSource);
        if (!shouldContinue) break;
      }
    }

    await this.flushBatch(batch, options, stats);
    stats.estimatedSize = stats.validCount * 1024;

    console.log(`\n--- ${source.name} report ---`);
    console.log(`Original rows: ${stats.originalCount}`);
    console.log(`Parsed entries: ${stats.parsedCount}`);
    console.log(`Valid entries: ${stats.validCount}`);
    console.log(`New entries: ${stats.newCount}`);
    console.log(`Updated entries: ${stats.updateCount}`);
    console.log(`Skipped entries: ${stats.skipCount}`);
    console.log(`Failed entries: ${stats.failedCount}`);
    console.log(`Surface forms: ${stats.surfaceFormCount}`);

    return {
      language: source.language,
      source: source.name,
      filePath,
      format,
      dryRun: options.dryRun,
      databaseChecked,
      stats,
      license: source.license,
      attribution: source.attribution,
      version: source.version,
    };
  }

  private async consumeRawEntry(
    raw: RawEntry,
    source: DictionarySourceInfo,
    options: CliOptions,
    stats: ImportStats,
    batch: NormalizedEntry[],
    seenInSource: Set<string>
  ): Promise<boolean> {
    stats.originalCount++;

    for (const parsed of this.parseRawEntry(source, raw)) {
      stats.parsedCount++;

      const cleaned = this.cleanAndNormalize(parsed, source);
      if (!cleaned) {
        stats.skipCount++;
        continue;
      }

      const dedupeKey = `${cleaned.language_code}:${cleaned.lemma}`;
      if (seenInSource.has(dedupeKey)) {
        stats.skipCount++;
        continue;
      }
      seenInSource.add(dedupeKey);

      stats.validCount++;
      cleaned.frequency_rank = cleaned.frequency_rank || stats.validCount;
      cleaned.cefr_level = cleaned.cefr_level || cefrForRank(stats.validCount);

      if (options.startRank > 1 && stats.validCount < options.startRank) {
        continue;
      }

      batch.push(cleaned);

      if (batch.length >= options.batchSize) {
        await this.flushBatch(batch, options, stats);
      }

      if (options.limit && stats.validCount >= options.limit) {
        return false;
      }
    }

    return true;
  }

  private async flushBatch(batch: NormalizedEntry[], options: CliOptions, stats: ImportStats): Promise<void> {
    if (batch.length === 0) return;

    const entries = batch.splice(0, batch.length);

    if (options.dryRun) {
      stats.newCount += entries.length;
      stats.surfaceFormCount += entries.reduce((sum, entry) => sum + entry.surfaceForms.length, 0);
      return;
    }

    const entryIds = await this.writeEntryBatch(entries, stats, options);
    await this.writeSurfaceForms(entries, entryIds, stats);
  }

  private async writeEntryBatch(entries: NormalizedEntry[], stats: ImportStats, options: CliOptions): Promise<Map<string, string>> {
    if (!this.supabase) throw new Error("Supabase client is not configured.");

    const language = entries[0].language_code;
    const existing = options.assumeNew
      ? new Map<string, { id: string }>()
      : await this.fetchExistingEntries(language, entries.map(entry => entry.lemma));
    const entryIds = new Map<string, string>();
    const now = new Date().toISOString();
    const insertRows = entries
      .filter(entry => !existing.has(entry.lemma))
      .map(entry => this.entryPayload(entry, now));

    if (insertRows.length > 0) {
      const { data, error } = await this.supabase
        .from("dictionary_entries")
        .insert(insertRows)
        .select("id, lemma");

      if (error) {
        this.recordFailure(stats, `Batch insert failed: ${error.message}`);
      } else {
        stats.newCount += data?.length || 0;
        for (const row of data || []) {
          entryIds.set(row.lemma, row.id);
        }
      }
    }

    const updateEntries = entries.filter(entry => existing.has(entry.lemma));
    if (updateEntries.length > 0) {
      await Promise.all(updateEntries.map(async entry => {
        const existingRow = existing.get(entry.lemma);
        if (!existingRow?.id) return;

        const { error } = await this.supabase!
          .from("dictionary_entries")
          .update(this.updatePayload(entry, now))
          .eq("id", existingRow.id);

        if (error) {
          this.recordFailure(stats, `Update failed for ${entry.lemma}: ${error.message}`);
          return;
        }

        stats.updateCount++;
        entryIds.set(entry.lemma, existingRow.id);
      }));
    }

    existing.forEach((row, lemma) => {
      if (row?.id) entryIds.set(lemma, row.id);
    });

    return entryIds;
  }

  private async writeSurfaceForms(entries: NormalizedEntry[], entryIds: Map<string, string>, stats: ImportStats): Promise<void> {
    if (!this.supabase) throw new Error("Supabase client is not configured.");

    const entryIdValues = Array.from(entryIds.values());
    if (entryIdValues.length === 0) return;

    const { data: existingForms, error: selectError } = await this.supabase
      .from("dictionary_surface_forms")
      .select("dictionary_entry_id, surface_form, normalized_form, lemma")
      .in("dictionary_entry_id", entryIdValues);

    if (selectError) {
      this.recordFailure(stats, `Surface form lookup failed: ${selectError.message}`);
      return;
    }

    const existingKeys = new Set((existingForms || []).map(row => (
      `${row.dictionary_entry_id}:${row.surface_form}:${row.normalized_form}:${row.lemma}`
    )));

    const rows = entries.flatMap(entry => {
      const dictionaryEntryId = entryIds.get(entry.lemma);
      if (!dictionaryEntryId) return [];
      return entry.surfaceForms.map(form => ({
        language_code: entry.language_code,
        surface_form: form.surface_form,
        normalized_form: form.normalized_form,
        lemma: entry.lemma,
        dictionary_entry_id: dictionaryEntryId,
        form_type: form.form_type,
      }));
    }).filter(row => {
      const key = `${row.dictionary_entry_id}:${row.surface_form}:${row.normalized_form}:${row.lemma}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    if (rows.length === 0) return;

    const { error } = await this.supabase
      .from("dictionary_surface_forms")
      .insert(rows);

    if (error) {
      this.recordFailure(stats, `Surface form insert failed: ${error.message}`);
      return;
    }

    stats.surfaceFormCount += rows.length;
  }

  private entryPayload(entry: NormalizedEntry, importedAt: string): Record<string, unknown> {
    return {
      language_code: entry.language_code,
      lemma: entry.lemma,
      display_word: entry.display_word,
      reading: entry.reading,
      romanization: entry.romanization,
      ipa: entry.ipa,
      part_of_speech: entry.part_of_speech,
      definitions_json: entry.definitions_json,
      definitions_zh_tw_json: entry.definitions_zh_tw_json,
      examples_json: entry.examples_json,
      synonyms_json: entry.synonyms_json,
      antonyms_json: entry.antonyms_json,
      cefr_level: entry.cefr_level,
      frequency_rank: entry.frequency_rank,
      source_name: entry.source.name,
      source_license: entry.source.license,
      source_attribution: entry.source.attribution,
      source_version: entry.source.version,
      imported_at: importedAt,
      is_ai_enriched: false,
      content_version: 1,
    };
  }

  private updatePayload(entry: NormalizedEntry, importedAt: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      display_word: entry.display_word,
      reading: entry.reading,
      romanization: entry.romanization,
      ipa: entry.ipa,
      part_of_speech: entry.part_of_speech,
      source_name: entry.source.name,
      source_license: entry.source.license,
      source_attribution: entry.source.attribution,
      source_version: entry.source.version,
      imported_at: importedAt,
    };

    if (entry.definitions_json.length > 0) payload.definitions_json = entry.definitions_json;
    if (entry.definitions_zh_tw_json.length > 0) payload.definitions_zh_tw_json = entry.definitions_zh_tw_json;
    if (entry.examples_json.length > 0) payload.examples_json = entry.examples_json;
    if (entry.synonyms_json.length > 0) payload.synonyms_json = entry.synonyms_json;
    if (entry.antonyms_json.length > 0) payload.antonyms_json = entry.antonyms_json;
    if (entry.cefr_level) payload.cefr_level = entry.cefr_level;
    if (entry.frequency_rank) payload.frequency_rank = entry.frequency_rank;

    return payload;
  }

  private async fetchExistingEntries(language: LanguageCode, lemmas: string[]): Promise<Map<string, { id: string }>> {
    if (!this.supabase || lemmas.length === 0) return new Map();

    const { data, error } = await this.supabase
      .from("dictionary_entries")
      .select("id, lemma")
      .eq("language_code", language)
      .in("lemma", uniqueStrings(lemmas));

    if (error) {
      throw new Error(`Existing entry lookup failed: ${error.message}`);
    }

    return new Map((data || []).map(row => [row.lemma, { id: row.id }]));
  }

  private async upsertDictionarySource(source: DictionarySourceInfo): Promise<void> {
    if (!this.supabase) throw new Error("Supabase client is not configured.");

    const { error } = await this.supabase
      .from("dictionary_sources")
      .upsert({
        name: source.name,
        language_code: source.language,
        source_type: source.sourceType,
        license: source.license,
        attribution: source.attribution,
        version: source.version,
        last_imported_at: new Date().toISOString(),
      }, { onConflict: "name" });

    if (error) {
      throw new Error(`Dictionary source upsert failed: ${error.message}`);
    }
  }

  private parseRawEntry(source: DictionarySourceInfo, raw: RawEntry): RawEntry[] {
    switch (source.name) {
      case "cmudict":
        return [raw];
      case "jmdict":
        return this.parseJMdictBlock(String(raw.sourcePayload || ""));
      case "kanjidic2":
        return this.parseKanjidic2Block(String(raw.sourcePayload || ""));
      case "wordnet":
        return this.parseWordNetEntry(raw.sourcePayload ?? raw);
      default:
        if (source.sourceType === "wiktextract") return this.parseWiktextractEntry(raw.sourcePayload ?? raw);
        return [raw];
    }
  }

  private parseWiktextractEntry(raw: unknown): RawEntry[] {
    if (!raw || typeof raw !== "object") return [];
    const entry = raw as any;
    const word = cleanText(entry.word || entry.title);
    if (!word) return [];

    const senses = Array.isArray(entry.senses) ? entry.senses : [];
    const definitions = compactStrings(senses.flatMap((sense: any) => [
      ...(Array.isArray(sense.glosses) ? sense.glosses : []),
      ...(Array.isArray(sense.raw_glosses) ? sense.raw_glosses : []),
    ]), 8);
    const examples = senses
      .flatMap((sense: any) => Array.isArray(sense.examples) ? sense.examples : [])
      .map((example: any) => typeof example === "string" ? { text: example } : { text: cleanText(example.text), translation: cleanText(example.translation) || undefined })
      .filter((example: { text: string }) => Boolean(example.text))
      .slice(0, 5);
    const forms = Array.isArray(entry.forms)
      ? entry.forms.map((form: any) => cleanText(form.form)).filter(Boolean)
      : [];

    return [{
      word,
      pos: cleanText(entry.pos || senses.find((sense: any) => sense.pos)?.pos),
      ipa: Array.isArray(entry.sounds) ? cleanText(entry.sounds.find((sound: any) => sound.ipa)?.ipa) : null,
      definitions,
      examples,
      surfaceForms: forms,
      synonyms: compactStrings(Array.isArray(entry.synonyms) ? entry.synonyms.map((item: any) => item.word || item) : [], 8),
      antonyms: compactStrings(Array.isArray(entry.antonyms) ? entry.antonyms.map((item: any) => item.word || item) : [], 8),
    }];
  }

  private parseWordNetEntry(raw: unknown): RawEntry[] {
    if (!raw || typeof raw !== "object") return [];
    const entry = raw as any;
    const words = uniqueStrings([
      ...(Array.isArray(entry.words) ? entry.words.map((word: any) => typeof word === "string" ? word : word.lemma || word.word) : []),
      ...(Array.isArray(entry.members) ? entry.members.map((member: any) => typeof member === "string" ? member : member.lemma || member.word) : []),
      entry.word,
      entry.lemma,
    ]);

    const definitions = compactStrings([
      entry.definition,
      entry.gloss,
      ...(Array.isArray(entry.definitions) ? entry.definitions : []),
    ], 8);
    const examples = compactStrings(Array.isArray(entry.examples) ? entry.examples : [], 5)
      .map(text => ({ text }));

    return words.map(word => ({
      word,
      pos: cleanText(entry.pos || entry.partOfSpeech),
      definitions,
      examples,
      synonyms: words.filter(other => other !== word).slice(0, 8),
    }));
  }

  private parseJMdictBlock(xml: string): RawEntry[] {
    const kanjiForms = getTagValues(xml, "keb");
    const readings = getTagValues(xml, "reb");
    const senses = getTagValues(xml, "sense");
    const definitions = compactStrings(getTagValues(xml, "gloss"), 10);
    const pos = compactStrings(senses.flatMap(sense => getTagValues(sense, "pos")), 3).join(", ") || null;
    const lemma = kanjiForms[0] || readings[0];

    if (!lemma) return [];

    return [{
      word: lemma,
      reading: readings[0] || null,
      pos,
      definitions,
      surfaceForms: uniqueStrings([...kanjiForms, ...readings]),
    }];
  }

  private parseKanjidic2Block(xml: string): RawEntry[] {
    const literal = firstTagValue(xml, "literal");
    if (!literal) return [];

    const readings = getTagValues(xml, "reading");
    const meanings = getTagValues(xml, "meaning")
      .filter(value => !/^[a-z]{2,3}:/.test(value))
      .slice(0, 10);

    return [{
      word: literal,
      reading: readings.slice(0, 5).join(" / ") || null,
      pos: "kanji",
      definitions: meanings,
      surfaceForms: [literal],
    }];
  }

  private cleanAndNormalize(entry: RawEntry, source: DictionarySourceInfo): NormalizedEntry | null {
    const rawLemma = cleanText(entry.lemma || entry.word);
    if (!isUsableHeadword(rawLemma)) return null;

    const displayWord = cleanText(entry.displayWord || entry.word || rawLemma) || rawLemma;
    const surfaceSeed = uniqueStrings([
      rawLemma,
      displayWord,
      ...(entry.surfaceForms || []),
    ]).filter(isUsableHeadword);

    const surfaceForms = surfaceSeed.map(surface => ({
      surface_form: surface,
      normalized_form: normalizedLookupForm(surface, source.language),
      form_type: surface === rawLemma ? "variant" as const : "inflection" as const,
    }));

    return {
      language_code: source.language,
      lemma: normalizedLookupForm(rawLemma, source.language),
      display_word: displayWord,
      reading: cleanText(entry.reading) || null,
      romanization: cleanText(entry.romanization) || null,
      ipa: cleanText(entry.ipa) || null,
      part_of_speech: cleanText(entry.pos) || null,
      definitions_json: compactStrings(entry.definitions || [], 12),
      definitions_zh_tw_json: compactStrings(entry.definitionsZhTw || [], 12),
      examples_json: (entry.examples || [])
        .map(example => ({ text: cleanText(example.text), translation: cleanText(example.translation) || undefined }))
        .filter(example => example.text)
        .slice(0, 8),
      synonyms_json: compactStrings(entry.synonyms || [], 12),
      antonyms_json: compactStrings(entry.antonyms || [], 12),
      cefr_level: null,
      frequency_rank: null,
      surfaceForms,
      source,
    };
  }

  private async *iterateSourceEntries(source: DictionarySourceInfo, filePath: string, format: SourceFormat): AsyncGenerator<RawEntry> {
    if (source.name === "cmudict" || format === "txt") {
      yield* this.iterateCMUDict(filePath);
      return;
    }

    if (format === "xml") {
      const blockTag = source.name === "kanjidic2" ? "character" : "entry";
      for await (const block of this.iterateXmlBlocks(filePath, blockTag)) {
        yield { sourcePayload: block };
      }
      return;
    }

    if (format === "jsonl") {
      for await (const value of this.iterateJsonLines(filePath)) {
        yield { sourcePayload: value };
      }
      return;
    }

    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    for (const value of this.expandJsonSource(source, parsed)) {
      yield { sourcePayload: value };
    }
  }

  private async *iterateCMUDict(filePath: string): AsyncGenerator<RawEntry> {
    const rl = readline.createInterface({
      input: createReadStream(filePath, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(";;;")) continue;
      const [wordToken, ...phones] = trimmed.split(/\s+/);
      const word = wordToken.replace(/\(\d+\)$/, "").toLocaleLowerCase("en");
      yield {
        word,
        reading: phones.join(" "),
        pos: null,
        definitions: [],
        surfaceForms: [wordToken.toLocaleLowerCase("en")],
      };
    }
  }

  private async *iterateJsonLines(filePath: string): AsyncGenerator<unknown> {
    const rl = readline.createInterface({
      input: createReadStream(filePath, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      yield JSON.parse(trimmed);
    }
  }

  private async *iterateXmlBlocks(filePath: string, tag: string): AsyncGenerator<string> {
    const openTag = `<${tag}`;
    const closeTag = `</${tag}>`;
    let buffer = "";

    for await (const chunk of createReadStream(filePath, { encoding: "utf-8" })) {
      buffer += chunk;

      while (true) {
        const start = buffer.indexOf(openTag);
        if (start < 0) {
          buffer = buffer.slice(Math.max(0, buffer.length - openTag.length));
          break;
        }

        const end = buffer.indexOf(closeTag, start);
        if (end < 0) {
          buffer = buffer.slice(start);
          break;
        }

        const blockEnd = end + closeTag.length;
        yield buffer.slice(start, blockEnd);
        buffer = buffer.slice(blockEnd);
      }
    }
  }

  private expandJsonSource(source: DictionarySourceInfo, parsed: unknown): unknown[] {
    if (Array.isArray(parsed)) return parsed;
    if (!parsed || typeof parsed !== "object") return [];

    const data = parsed as any;
    if (source.name === "wordnet") {
      if (Array.isArray(data.synsets)) return data.synsets;
      if (Array.isArray(data.entries)) return data.entries;
      if (data.synsets && typeof data.synsets === "object") return Object.values(data.synsets);
    }

    if (Array.isArray(data.entries)) return data.entries;
    return Object.values(data).flatMap(value => Array.isArray(value) ? value : [value]);
  }

  private async *iterateLocalEntries(language: LanguageCode): AsyncGenerator<RawEntry> {
    if (language === "en") {
      const mod = await import("../src/data/dictionary");
      for (const word of mod.dictionaryEntries || []) {
        yield {
          word: word.word,
          reading: word.phonetic,
          pos: word.pos,
          definitions: [word.enDef].filter(Boolean),
          definitionsZhTw: [word.zh].filter(Boolean),
          examples: word.example ? [{ text: word.example, translation: word.exampleZh }] : [],
          synonyms: word.synonyms || [],
          antonyms: word.antonyms || [],
          surfaceForms: word.related || [],
        };
      }
    }

    const multi = await import("../src/data/multilingualDictionary");
    for (const word of multi.multilingualDictionaryEntries || []) {
      if (word.language !== language) continue;
      yield {
        word: word.word,
        reading: word.phonetic,
        pos: word.pos,
        definitions: [word.enDef].filter(Boolean),
        definitionsZhTw: [word.zh].filter(Boolean),
        examples: word.example ? [{ text: word.example, translation: word.exampleZh }] : [],
        synonyms: word.synonyms || [],
        antonyms: word.antonyms || [],
        surfaceForms: word.related || [],
      };
    }
  }

  private async findSourceFile(source: DictionarySourceInfo): Promise<string> {
    const candidateExtensions = uniqueStrings([...source.fileExtensions, "jsonl", "json", "xml", "txt"]);
    for (const ext of candidateExtensions) {
      const filePath = join(this.downloadDir, `${source.name}.${ext}`);
      try {
        await access(filePath);
        return filePath;
      } catch {
        // Try next extension.
      }
    }

    throw new Error(`Source file not found for ${source.name}. Expected one of: ${candidateExtensions.map(ext => `${source.name}.${ext}`).join(", ")}`);
  }

  private async detectFormat(source: DictionarySourceInfo, filePath: string): Promise<SourceFormat> {
    if (source.name === "cmudict") return "txt";
    const ext = filePath.split(".").pop();
    if (ext === "xml" || ext === "txt" || ext === "jsonl" || ext === "json") return ext;

    const fd = await readFile(filePath, { encoding: "utf-8" });
    const sample = fd.slice(0, 2048).trimStart();
    if (sample.startsWith("<")) return "xml";
    if (sample.startsWith("[") || sample.startsWith("{")) {
      const firstLine = sample.split(/\r?\n/, 1)[0];
      return firstLine.trim().endsWith("}") && sample.includes("\n{") ? "jsonl" : "json";
    }
    return "txt";
  }

  private sourceFor(sourceName: string, language: LanguageCode): DictionarySourceInfo {
    if (sourceName === "local-basic") {
      return { ...SOURCE_CATALOG["local-basic"], language };
    }
    const source = SOURCE_CATALOG[sourceName];
    if (!source) throw new Error(`Unknown dictionary source: ${sourceName}`);
    return source;
  }

  private async withRetry<T>(operation: () => Promise<T>, retryCount: number): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < retryCount) {
          console.warn(`Attempt ${attempt + 1} failed; retrying...`, error instanceof Error ? error.message : error);
          await delay(500 * (attempt + 1));
        }
      }
    }
    throw lastError;
  }

  private async readCompletedSources(): Promise<Set<string>> {
    try {
      const raw = await readFile(this.progressPath, "utf-8");
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed.completedSources) ? parsed.completedSources : []);
    } catch {
      return new Set();
    }
  }

  private async markSourceCompleted(key: string): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const completed = await this.readCompletedSources();
    completed.add(key);
    await writeFile(this.progressPath, JSON.stringify({
      updatedAt: new Date().toISOString(),
      completedSources: Array.from(completed).sort(),
    }, null, 2));
  }

  private emptyStats(): ImportStats {
    return {
      originalCount: 0,
      parsedCount: 0,
      validCount: 0,
      newCount: 0,
      updateCount: 0,
      skipCount: 0,
      failedCount: 0,
      surfaceFormCount: 0,
      estimatedSize: 0,
      failures: [],
    };
  }

  private recordFailure(stats: ImportStats, message: string): void {
    stats.failedCount++;
    if (stats.failures.length < MAX_FAILURES_IN_REPORT) {
      stats.failures.push(message);
    }
  }
}

function parseCliOptions(args: string[]): CliOptions {
  const languageFlag = args.find(arg => arg.startsWith("--language="));
  const sourceFlags = args.filter(arg => arg.startsWith("--source=") || arg.startsWith("--sources="));
  const allFlag = args.includes("--all");
  const confirm = args.includes("--confirm");
  const dryRun = args.includes("--dry-run") || !confirm;
  const seedLocal = args.includes("--seed-local");
  const resume = args.includes("--resume");
  const limitFlag = args.find(arg => arg.startsWith("--limit="));
  const batchFlag = args.find(arg => arg.startsWith("--batch-size="));
  const retryFlag = args.find(arg => arg.startsWith("--retry="));
  const startRankFlag = args.find(arg => arg.startsWith("--start-rank="));

  const languages: LanguageCode[] = allFlag || (seedLocal && !languageFlag)
    ? ["en", "ja", "ko", "it", "es"]
    : languageFlag
      ? [languageFlag.split("=")[1] as LanguageCode]
      : [];

  const sources = sourceFlags.flatMap(flag => flag.split("=")[1].split(",").map(value => value.trim()).filter(Boolean));

  return {
    languages,
    sources,
    dryRun,
    confirm,
    seedLocal,
    resume,
    limit: limitFlag ? Number(limitFlag.split("=")[1]) : null,
    batchSize: batchFlag ? Number(batchFlag.split("=")[1]) : DEFAULT_BATCH_SIZE,
    retryCount: retryFlag ? Number(retryFlag.split("=")[1]) : 1,
    reportJson: args.includes("--report-json"),
    assumeNew: args.includes("--assume-new"),
    startRank: startRankFlag ? Math.max(1, Number(startRankFlag.split("=")[1]) || 1) : 1,
  };
}

function printUsage(): void {
  console.log("Usage:");
  console.log("  npm run dictionary:import -- --language=en --dry-run");
  console.log("  npm run dictionary:import -- --language=ja --source=kanjidic2 --limit=20 --dry-run");
  console.log("  npm run dictionary:import -- --all --confirm");
  console.log("  npm run dictionary:import -- --all --seed-local --dry-run");
  console.log("Options:");
  console.log("  --dry-run       Parse and report without writing. This is the default unless --confirm is present.");
  console.log("  --confirm       Allow Supabase writes.");
  console.log("  --source=name   Limit import to one source. May be repeated or comma-separated.");
  console.log("  --limit=n       Stop after n valid entries per source for smoke tests.");
  console.log("  --batch-size=n  Number of entries per batch.");
  console.log("  --resume        Skip sources recorded as completed.");
  console.log("  --assume-new    Initial seed mode: skip existing-entry lookup and insert rows directly.");
  console.log("  --start-rank=n  Continue an initial seed from a specific frequency rank.");
  console.log("  --retry=n       Retry source import failures.");
  console.log("  --report-json   Write data/dictionary/import-report.json.");
}

async function writeReport(results: ImportResult[]): Promise<void> {
  const dataDir = join(process.cwd(), "data", "dictionary");
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "import-report.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    results,
  }, null, 2));
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));

  if (options.languages.length === 0) {
    printUsage();
    return;
  }

  await mkdir(join(process.cwd(), "data", "dictionary"), { recursive: true });

  const importer = new DictionaryImporter();
  const results = await importer.importAll(options);

  console.log("\n=== Import Summary ===");
  for (const result of results) {
    console.log(`${result.language}/${result.source}: parsed=${result.stats.parsedCount}, valid=${result.stats.validCount}, new=${result.stats.newCount}, updated=${result.stats.updateCount}, skipped=${result.stats.skipCount}, failed=${result.stats.failedCount}`);
    if (result.stats.failures.length > 0) {
      console.log(`  failures: ${result.stats.failures.join(" | ")}`);
    }
  }

  if (options.reportJson) {
    await writeReport(results);
    const reportPath = join(process.cwd(), "data", "dictionary", "import-report.json");
    const info = await stat(reportPath);
    console.log(`Report written: ${reportPath} (${info.size} bytes)`);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
