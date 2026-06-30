import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EnglishLevel, LearningLanguageCode, PartOfSpeech, Word } from "@/types";

export const runtime = "nodejs";

const LEVEL_TARGETS: Record<LearningLanguageCode, Record<EnglishLevel, number>> = {
  en: {
    Beginner: 1500,
    Elementary: 2500,
    Intermediate: 4000,
    "Upper-Intermediate": 6000,
    Advanced: 16000,
  },
  ja: {
    Beginner: 1500,
    Elementary: 2500,
    Intermediate: 4000,
    "Upper-Intermediate": 6000,
    Advanced: 10000,
  },
  ko: {
    Beginner: 1500,
    Elementary: 2500,
    Intermediate: 4000,
    "Upper-Intermediate": 6000,
    Advanced: 10000,
  },
  it: {
    Beginner: 1500,
    Elementary: 2500,
    Intermediate: 4000,
    "Upper-Intermediate": 6000,
    Advanced: 10000,
  },
  es: {
    Beginner: 1500,
    Elementary: 2500,
    Intermediate: 4000,
    "Upper-Intermediate": 6000,
    Advanced: 10000,
  },
};

const LANGUAGES: LearningLanguageCode[] = ["en", "ja", "ko", "it", "es"];
const LEVELS: EnglishLevel[] = ["Beginner", "Elementary", "Intermediate", "Upper-Intermediate", "Advanced"];
const DEFAULT_POOL_LIMIT = 900;
const MAX_POOL_LIMIT = 1500;

type DictionaryRow = {
  lemma: string | null;
  display_word: string | null;
  reading: string | null;
  romanization: string | null;
  ipa: string | null;
  part_of_speech: string | null;
  definitions_json: unknown;
  definitions_zh_tw_json: unknown;
  examples_json: unknown;
  synonyms_json: unknown;
  antonyms_json: unknown;
  frequency_rank: number | null;
};

function parseLanguage(value: string | null): LearningLanguageCode {
  return LANGUAGES.includes(value as LearningLanguageCode) ? value as LearningLanguageCode : "en";
}

function parseLevel(value: string | null): EnglishLevel {
  return LEVELS.includes(value as EnglishLevel) ? value as EnglishLevel : "Beginner";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stableHash(text: string) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function compactStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function compactExamples(value: unknown): Array<{ text: string; translation?: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { text: item.trim() };
      if (!item || typeof item !== "object") return { text: "" };
      const example = item as { text?: unknown; translation?: unknown };
      return {
        text: String(example.text || "").trim(),
        translation: String(example.translation || "").trim() || undefined,
      };
    })
    .filter((item) => item.text);
}

function normalizePartOfSpeech(value: string | null): PartOfSpeech {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("verb") || raw === "v" || raw.includes("v.")) return "v.";
  if (raw.includes("adj") || raw.includes("adjective")) return "adj.";
  if (raw.includes("adv") || raw.includes("adverb")) return "adv.";
  if (raw.includes("prep") || raw.includes("preposition")) return "prep.";
  if (raw.includes("conj") || raw.includes("conjunction")) return "conj.";
  if (raw.includes("interj") || raw.includes("interjection")) return "interj.";
  if (raw.includes("pron") || raw.includes("pronoun")) return "pron.";
  return "n.";
}

function isReviewableWordText(value: string) {
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

function rowToWord(row: DictionaryRow, language: LearningLanguageCode): Word {
  const definitions = compactStringArray(row.definitions_json);
  const zhDefinitions = compactStringArray(row.definitions_zh_tw_json);
  const examples = compactExamples(row.examples_json);
  const word = String(row.display_word || row.lemma || "").trim();
  const zh = zhDefinitions[0] || definitions[0] || word;
  const example = examples[0]?.text || word;

  return {
    language,
    word,
    phonetic: String(row.ipa || row.romanization || row.reading || "/-/").trim(),
    pos: normalizePartOfSpeech(row.part_of_speech),
    enDef: definitions[0] || zh || "Database vocabulary entry.",
    zh,
    example,
    exampleZh: examples[0]?.translation,
    synonyms: compactStringArray(row.synonyms_json).slice(0, 6),
    antonyms: compactStringArray(row.antonyms_json).slice(0, 6),
  };
}

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchRankedRows(
  supabase: SupabaseClient,
  language: LearningLanguageCode,
  fromRank: number,
  toRank: number,
) {
  const { data, error } = await supabase
    .from("dictionary_entries")
    .select("lemma, display_word, reading, romanization, ipa, part_of_speech, definitions_json, definitions_zh_tw_json, examples_json, synonyms_json, antonyms_json, frequency_rank")
    .eq("language_code", language)
    .gte("frequency_rank", fromRank)
    .lte("frequency_rank", toRank)
    .order("frequency_rank", { ascending: true })
    .limit(Math.max(0, toRank - fromRank + 1));

  if (error) throw error;
  return (data || []) as DictionaryRow[];
}

async function fetchFallbackRows(
  supabase: SupabaseClient,
  language: LearningLanguageCode,
  limit: number,
) {
  const { data, error } = await supabase
    .from("dictionary_entries")
    .select("lemma, display_word, reading, romanization, ipa, part_of_speech, definitions_json, definitions_zh_tw_json, examples_json, synonyms_json, antonyms_json, frequency_rank")
    .eq("language_code", language)
    .order("frequency_rank", { ascending: true, nullsFirst: false })
    .order("lemma", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []) as DictionaryRow[];
}

function uniqueRows(rows: DictionaryRow[], language: LearningLanguageCode): Word[] {
  const seen = new Set<string>();
  const words: Word[] = [];

  for (const row of rows) {
    const word = rowToWord(row, language);
    if (!word.word || !isReviewableWordText(word.word)) continue;
    const key = `${language}:${word.word.toLowerCase().normalize("NFC")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }

  return words;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const language = parseLanguage(url.searchParams.get("language"));
  const level = parseLevel(url.searchParams.get("level"));
  const limit = clamp(Number(url.searchParams.get("limit") || DEFAULT_POOL_LIMIT), 30, MAX_POOL_LIMIT);
  const seed = url.searchParams.get("seed") || new Date().toISOString().slice(0, 10);
  const targetCount = LEVEL_TARGETS[language][level];
  const supabase = createSupabaseClient();

  if (!supabase) {
    return NextResponse.json({
      source: "local",
      reason: "Supabase vocabulary environment variables are not configured.",
      targetCount,
      words: [],
    });
  }

  try {
    const foundationLimit = Math.min(220, limit, targetCount);
    const windowLimit = Math.max(0, Math.min(limit - foundationLimit, targetCount - foundationLimit));
    const maxWindowStart = Math.max(foundationLimit + 1, targetCount - windowLimit + 1);
    const windowStart = windowLimit > 0
      ? foundationLimit + 1 + (stableHash(`${language}:${level}:${seed}`) % Math.max(1, maxWindowStart - foundationLimit))
      : foundationLimit + 1;

    const foundationRows = foundationLimit > 0
      ? await fetchRankedRows(supabase, language, 1, foundationLimit)
      : [];
    const windowRows = windowLimit > 0
      ? await fetchRankedRows(supabase, language, windowStart, Math.min(targetCount, windowStart + windowLimit - 1))
      : [];
    let words = uniqueRows([...foundationRows, ...windowRows], language);

    if (words.length < Math.min(30, limit)) {
      const fallbackRows = await fetchFallbackRows(supabase, language, limit);
      words = uniqueRows([...foundationRows, ...windowRows, ...fallbackRows], language).slice(0, limit);
    }

    return NextResponse.json({
      source: words.length > 0 ? "database" : "local",
      targetCount,
      poolSize: words.length,
      words,
    });
  } catch (error) {
    return NextResponse.json({
      source: "local",
      reason: error instanceof Error ? error.message : "Database vocabulary query failed.",
      targetCount,
      words: [],
    });
  }
}
