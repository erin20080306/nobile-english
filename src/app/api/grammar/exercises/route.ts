import { NextResponse } from "next/server";
import type { EnglishLevel, LearningLanguageCode } from "@/types";
import { getSupabaseServerClient } from "@/server/supabaseClient";
import { generateJsonWithGemini, hasGeminiConfig } from "@/server/gemini";
import { scenes } from "@/data/scenes";

export const runtime = "nodejs";

const LANGUAGES: LearningLanguageCode[] = ["en", "ja", "ko", "it", "es", "zh"];
const LEVELS: EnglishLevel[] = ["Beginner", "Elementary", "Intermediate", "Upper-Intermediate", "Advanced"];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 60;
const LANGUAGE_NAMES: Record<LearningLanguageCode, string> = {
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  it: "Italian",
  es: "Spanish",
  zh: "Traditional Chinese",
};

const CEFR_RANK: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
const LEVEL_CEFR_RANGE: Record<EnglishLevel, { min: number; max: number }> = {
  Beginner: { min: 1, max: 1 },
  Elementary: { min: 1, max: 2 },
  Intermediate: { min: 2, max: 3 },
  "Upper-Intermediate": { min: 3, max: 4 },
  Advanced: { min: 4, max: 6 },
};

function isCefrAllowed(cefrLevel: string | null | undefined, level: EnglishLevel) {
  const cefr = String(cefrLevel || "").toUpperCase();
  const rank = CEFR_RANK[cefr];
  if (!rank) {
    // Unknown CEFR entries are often rare/archaic dictionary quotations, so
    // only let them through for the higher levels where that's acceptable.
    return level === "Upper-Intermediate" || level === "Advanced";
  }
  const range = LEVEL_CEFR_RANGE[level];
  return rank >= range.min && rank <= range.max;
}

function parseLanguage(value: string | null): LearningLanguageCode {
  return LANGUAGES.includes(value as LearningLanguageCode) ? (value as LearningLanguageCode) : "en";
}

function parseLevel(value: string | null): EnglishLevel {
  return LEVELS.includes(value as EnglishLevel) ? (value as EnglishLevel) : "Beginner";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

interface ExerciseRow {
  id: string;
  language_code: string;
  level: string;
  source: string;
  sentence_key: string;
  text_target: string;
  text_zh: string;
  tokens: string[];
}

interface ExerciseOut {
  id: string;
  textTarget: string;
  textZh: string;
  tokens: string[];
}

function sentenceKey(text: string) {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~。，、；：？！「」『』（）\s]+/g, " ")
    .trim()
    .slice(0, 90);
}

function cacheKeyForRow(row: Pick<ExerciseRow, "language_code" | "sentence_key">) {
  return `${row.language_code}:${row.sentence_key}`;
}

function hasUsefulChineseTranslation(value: string | null | undefined) {
  const clean = String(value || "").trim();
  if (!clean) return false;
  if (!/[\u3400-\u9fff]/.test(clean)) return false;
  if (/(_{2,}|＿{2,})/.test(clean)) return false;
  if (/放回場景句子中完整練習|場景中的完整句子/.test(clean)) return false;
  if (/^請依照.*排出/.test(clean)) return false;
  return true;
}

function isTargetScript(char: string, language: LearningLanguageCode) {
  if (language === "ja") return /[\u3040-\u30ff\u3400-\u9fff]/.test(char);
  if (language === "ko") return /[\uac00-\ud7af]/.test(char);
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(char);
}

function tokenizeSentence(text: string, language: LearningLanguageCode): string[] {
  const clean = text.trim();
  if (!clean) return [];

  if (language === "ja" || language === "ko" || language === "zh") {
    const SegmenterCtor = (Intl as typeof Intl & {
      Segmenter?: new (locale?: string, options?: { granularity?: "word" }) => {
        segment(input: string): Iterable<{ segment: string; index: number }>;
      };
    }).Segmenter;
    if (SegmenterCtor) {
      const locale = language === "ja" ? "ja-JP" : language === "ko" ? "ko-KR" : "zh-TW";
      const segmenter = new SegmenterCtor(locale, { granularity: "word" });
      const tokens: string[] = [];
      Array.from(segmenter.segment(clean)).forEach((part) => {
        const seg = part.segment;
        if (!seg.trim()) return;
        const isPunctOnly = !Array.from(seg).some((char) => isTargetScript(char, language) || /[A-Za-z0-9]/.test(char));
        if (isPunctOnly && tokens.length) {
          tokens[tokens.length - 1] += seg;
        } else {
          tokens.push(seg);
        }
      });
      return tokens;
    }
    // Fallback: split by character when Intl.Segmenter isn't available.
    return Array.from(clean);
  }

  return clean.split(/\s+/).filter(Boolean);
}

function normalizePartOfSpeechExamples(value: unknown): Array<{ text: string; translation?: string }> {
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

function wordCount(text: string, language: LearningLanguageCode) {
  if (language === "ja" || language === "ko" || language === "zh") return Array.from(text).length;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function minSentenceUnits(language: LearningLanguageCode, level: EnglishLevel) {
  const isCjk = language === "ja" || language === "ko" || language === "zh";
  if (isCjk) return 4;
  const latinMinimums: Record<EnglishLevel, number> = {
    Beginner: 4,
    Elementary: 4,
    Intermediate: 5,
    "Upper-Intermediate": 5,
    Advanced: 6,
  };
  return latinMinimums[level];
}

function maxSentenceUnits(language: LearningLanguageCode, level: EnglishLevel) {
  const isCjk = language === "ja" || language === "ko" || language === "zh";
  const latinLimits: Record<EnglishLevel, number> = {
    Beginner: 7,
    Elementary: 9,
    Intermediate: 11,
    "Upper-Intermediate": 13,
    Advanced: 15,
  };
  const cjkLimits: Record<EnglishLevel, number> = {
    Beginner: 14,
    Elementary: 18,
    Intermediate: 24,
    "Upper-Intermediate": 30,
    Advanced: 36,
  };
  return isCjk ? cjkLimits[level] : latinLimits[level];
}

function isSentenceLevelFit(text: string, language: LearningLanguageCode, level: EnglishLevel) {
  const units = wordCount(text, language);
  return units >= minSentenceUnits(language, level) && units <= maxSentenceUnits(language, level) && isReasonableSentence(text, language, level);
}

// Filters out dictionary quotations that are technically valid sentences but
// a poor fit for a sentence-ordering game (extremely long single words,
// archaic spelling artifacts, etc). Intentionally simple/heuristic rather
// than a full quality classifier.
function isReasonableSentence(text: string, language: LearningLanguageCode, level: EnglishLevel) {
  if (language !== "ja" && language !== "ko" && language !== "zh") {
    const words = text.split(/\s+/).filter(Boolean);
    const maxWordLength = level === "Beginner" || level === "Elementary" ? 12 : 18;
    if (words.some((word) => word.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").length > maxWordLength)) return false;
  }
  return true;
}

async function fetchDictionarySentences(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  language: LearningLanguageCode,
  level: EnglishLevel,
  need: number,
  existingKeys: Set<string>
): Promise<Array<{ text: string; zh: string }>> {
  if (!supabase || need <= 0) return [];
  const { data, error } = await supabase
    .from("dictionary_entries")
    .select("examples_json, cefr_level")
    .eq("language_code", language)
    .order("frequency_rank", { ascending: true })
    .limit(500);
  if (error || !data) return [];

  const candidates: Array<{ text: string; zh: string; hasZh: boolean }> = [];

  for (const row of data as Array<{ examples_json: unknown; cefr_level: string | null }>) {
    if (!isCefrAllowed(row.cefr_level, level)) continue;
    const examples = normalizePartOfSpeechExamples(row.examples_json);
    for (const example of examples) {
      if (!isSentenceLevelFit(example.text, language, level)) continue;
      const key = sentenceKey(example.text);
      if (!key || existingKeys.has(key)) continue;
      existingKeys.add(key);
      candidates.push({ text: example.text, zh: example.translation || "", hasZh: Boolean(example.translation) });
    }
  }

  // Prefer sentences that already have a Chinese translation so the practice
  // prompt is never blank; only fall back to untranslated ones if needed.
  candidates.sort((a, b) => {
    const zhScore = Number(b.hasZh) - Number(a.hasZh);
    if (zhScore !== 0) return zhScore;
    return wordCount(a.text, language) - wordCount(b.text, language);
  });
  return candidates.slice(0, need).map(({ text, zh }) => ({ text, zh }));
}

function collectSceneSentences(level: EnglishLevel, need: number, existingKeys: Set<string>) {
  const out: Array<{ en: string; zh: string }> = [];
  const matching = scenes.filter((scene) => scene.difficulty === level);
  const pool = matching.length ? matching : scenes;
  for (const scene of pool) {
    for (const line of scene.dialogue) {
      if (!isSentenceLevelFit(line.en, "en", level)) continue;
      const key = sentenceKey(line.en);
      if (!key || existingKeys.has(key)) continue;
      existingKeys.add(key);
      out.push({ en: line.en, zh: line.zh });
      if (out.length >= need) return out;
    }
  }
  return out;
}

async function translateScenesWithGemini(
  sentences: Array<{ en: string; zh: string }>,
  language: LearningLanguageCode
): Promise<Array<{ text: string; zh: string }>> {
  if (!hasGeminiConfig() || sentences.length === 0) return [];
  const prompt = [
    `Translate these English sentences into natural, everyday ${LANGUAGE_NAMES[language]}.`,
    "Return ONLY a JSON object with this exact shape, one item per input sentence, in the same order:",
    JSON.stringify({ items: [{ target: "translated sentence", zh: "Traditional Chinese translation of the sentence" }] }),
    "Sentences:",
    JSON.stringify(sentences.map((s) => s.en)),
  ].join("\n");

  try {
    const result = await generateJsonWithGemini<{ items?: Array<{ target?: string; zh?: string }> }>({
      prompt,
      temperature: 0.3,
      maxOutputTokens: 1200,
    });
    if (!result || !Array.isArray(result.items)) return [];
    return result.items
      .map((item, index) => ({
        text: String(item?.target || "").trim(),
        zh: String(item?.zh || sentences[index]?.zh || "").trim(),
      }))
      .filter((item) => item.text);
  } catch {
    return [];
  }
}

async function fillMissingChineseTranslations(
  rows: ExerciseRow[],
  language: LearningLanguageCode
): Promise<Set<string>> {
  const changed = new Set<string>();
  const missing = rows.filter((row) => !hasUsefulChineseTranslation(row.text_zh));
  if (!hasGeminiConfig() || missing.length === 0) return changed;

  const prompt = [
    `Translate these ${LANGUAGE_NAMES[language]} sentences into natural Traditional Chinese for a grammar drag-to-order exercise.`,
    "Return ONLY a JSON object with this exact shape, one item per input sentence, in the same order:",
    JSON.stringify({ items: [{ zh: "complete Traditional Chinese translation of the whole sentence" }] }),
    "Rules:",
    "- Translate the complete sentence meaning, not the missing word and not a hint.",
    "- Do not include blanks, underscores, answer labels, grammar explanations, or instructions.",
    "- Keep names, prices, and product terms natural.",
    "Sentences:",
    JSON.stringify(missing.map((row) => row.text_target)),
  ].join("\n");

  try {
    const result = await generateJsonWithGemini<{ items?: Array<{ zh?: string }> }>({
      prompt,
      temperature: 0.2,
      maxOutputTokens: Math.min(2200, 220 + missing.length * 90),
    });
    if (!result || !Array.isArray(result.items)) return changed;
    missing.forEach((row, index) => {
      const zh = String(result.items?.[index]?.zh || "").trim();
      if (!hasUsefulChineseTranslation(zh)) return;
      row.text_zh = zh;
      changed.add(cacheKeyForRow(row));
    });
  } catch {
    // Leave rows untranslated; they are filtered out before being shown.
  }

  return changed;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const language = parseLanguage(url.searchParams.get("language"));
  const level = parseLevel(url.searchParams.get("level"));
  const limit = clamp(Number(url.searchParams.get("limit") || DEFAULT_LIMIT), 5, MAX_LIMIT);

  const supabase = getSupabaseServerClient();
  const existingKeys = new Set<string>();
  let cachedRows: ExerciseRow[] = [];

  if (supabase) {
    try {
      const { data } = await supabase
        .from("grammar_exercise_cache")
        .select("*")
        .eq("language_code", language)
        .eq("level", level)
        .limit(500);
      const rows = (data || []) as ExerciseRow[];
      rows.forEach((row) => existingKeys.add(row.sentence_key));
      cachedRows = rows
        .filter((row) => isSentenceLevelFit(row.text_target, language, level))
        .slice(0, limit * 3);
    } catch {
      cachedRows = [];
    }
  }

  const need = Math.max(0, limit * 2 - cachedRows.length);
  const newRows: ExerciseRow[] = [];

  if (need > 0) {
    const dictionarySentences = await fetchDictionarySentences(supabase, language, level, need, existingKeys);
    dictionarySentences.forEach((sentence) => {
      newRows.push({
        id: `new-${sentenceKey(sentence.text)}`,
        language_code: language,
        level,
        source: "dictionary",
        sentence_key: sentenceKey(sentence.text),
        text_target: sentence.text,
        text_zh: sentence.zh,
        tokens: tokenizeSentence(sentence.text, language),
      });
    });

    const stillNeed = need - dictionarySentences.length;
    if (stillNeed > 0) {
      const sceneSentences = collectSceneSentences(level, stillNeed, existingKeys);
      if (language === "en") {
        sceneSentences.forEach((sentence) => {
          newRows.push({
            id: `new-${sentenceKey(sentence.en)}`,
            language_code: language,
            level,
            source: "scene",
            sentence_key: sentenceKey(sentence.en),
            text_target: sentence.en,
            text_zh: sentence.zh,
            tokens: tokenizeSentence(sentence.en, language),
          });
        });
      } else {
        const translated = await translateScenesWithGemini(sceneSentences, language);
        translated.forEach((sentence) => {
          if (!isSentenceLevelFit(sentence.text, language, level)) return;
          const key = sentenceKey(sentence.text);
          if (!key || existingKeys.has(key)) return;
          existingKeys.add(key);
          newRows.push({
            id: `new-${key}`,
            language_code: language,
            level,
            source: "scene_translation",
            sentence_key: key,
            text_target: sentence.text,
            text_zh: sentence.zh,
            tokens: tokenizeSentence(sentence.text, language),
          });
        });
      }
    }
  }

  const combinedRows = [...cachedRows, ...newRows].filter((row) => Array.isArray(row.tokens) && row.tokens.length >= 3);
  const translatedKeys = await fillMissingChineseTranslations(combinedRows, language);
  const rowsToCache = new Map<string, ExerciseRow>();
  newRows
    .filter((row) => hasUsefulChineseTranslation(row.text_zh))
    .forEach((row) => rowsToCache.set(cacheKeyForRow(row), row));
  combinedRows.forEach((row) => {
    if (translatedKeys.has(cacheKeyForRow(row)) && hasUsefulChineseTranslation(row.text_zh)) {
      rowsToCache.set(cacheKeyForRow(row), row);
    }
  });

  // Best-effort cache write. If the migration hasn't been applied yet, this
  // silently fails and the app still works (just without cross-user caching).
  if (supabase && rowsToCache.size) {
    try {
      await supabase
        .from("grammar_exercise_cache")
        .upsert(
          Array.from(rowsToCache.values()).map((row) => ({
            language_code: row.language_code,
            level: row.level,
            source: row.source,
            sentence_key: row.sentence_key,
            text_target: row.text_target,
            text_zh: row.text_zh,
            tokens: row.tokens,
          })),
          { onConflict: "language_code,sentence_key", ignoreDuplicates: true }
        );
    } catch {
      // Ignore; caching is a best-effort optimization.
    }
  }

  const combined = combinedRows
    .filter((row) => hasUsefulChineseTranslation(row.text_zh))
    .map((row): ExerciseOut => ({
      id: row.id,
      textTarget: row.text_target,
      textZh: row.text_zh,
      tokens: row.tokens,
    }));

  // Shuffle so repeated requests within the same day feel varied.
  for (let i = combined.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return NextResponse.json({
    source: cachedRows.length > 0 ? "database" : newRows.length > 0 ? "generated" : "empty",
    exercises: combined.slice(0, limit),
  });
}
