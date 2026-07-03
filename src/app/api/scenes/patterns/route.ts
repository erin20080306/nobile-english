import { NextResponse } from "next/server";
import type { EnglishLevel, LearningLanguageCode } from "@/types";
import { getLearningLanguage } from "@/data/learningLanguages";
import { generateWithGemini, getGeminiApiKey, parseJsonFromModel } from "@/server/gemini";
import { getSupabaseServerClient } from "@/server/supabaseClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScenePatternsRequest {
  sceneId: string;
  themeName: string;
  sceneName: string;
  enName: string;
  difficulty: EnglishLevel;
  learnerLevel?: EnglishLevel;
  keyWords: string[];
  targetLanguage?: LearningLanguageCode;
}

interface ScenePattern {
  en: string;
  zh: string;
}

function isValidPatterns(payload: unknown): payload is { patterns: ScenePattern[] } {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as { patterns?: unknown };
  return (
    Array.isArray(p.patterns) &&
    p.patterns.length >= MIN_GENERATED_BANK_SIZE &&
    p.patterns.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as ScenePattern).en === "string" &&
        (item as ScenePattern).en.trim() &&
        !/_{2,}/.test((item as ScenePattern).en) &&
        typeof (item as ScenePattern).zh === "string" &&
        (item as ScenePattern).zh.trim()
    )
  );
}

const SESSION_PATTERN_COUNT = 4;
const TARGET_BANK_SIZE = 18;
const MIN_GENERATED_BANK_SIZE = 12;

function normalizePatternKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u00c0-\u024f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupePatterns(patterns: ScenePattern[]): ScenePattern[] {
  const seen = new Set<string>();
  const result: ScenePattern[] = [];
  for (const pattern of patterns) {
    const en = pattern.en.trim();
    const zh = pattern.zh.trim();
    const key = normalizePatternKey(en);
    if (!en || !zh || /_{2,}/.test(en) || seen.has(key)) continue;
    seen.add(key);
    result.push({ en, zh });
  }
  return result;
}

function selectPracticeWindow(patterns: ScenePattern[], count = SESSION_PATTERN_COUNT): ScenePattern[] {
  const clean = dedupePatterns(patterns);
  if (clean.length <= count) return clean;
  const start = Math.floor(Math.random() * clean.length);
  return Array.from({ length: count }, (_, index) => clean[(start + index) % clean.length]);
}

function buildPrompt(
  body: ScenePatternsRequest,
  targetLanguage: ReturnType<typeof getLearningLanguage>,
  existingVariants: ScenePattern[][]
) {
  const learnerLevel = body.learnerLevel || body.difficulty;
  return [
    `You are creating shadowing (repeat-after-me) practice sentences for a language-learning app, for a learner studying ${targetLanguage.label} (${targetLanguage.nativeName}).`,
    `Scenario theme: "${body.themeName}". Specific scene: "${body.sceneName}" (${body.enName}).`,
    `Scene difficulty: ${body.difficulty}. Learner's current level: ${learnerLevel}.`,
    body.keyWords.length ? `Relevant vocabulary to naturally incorporate where fitting: ${body.keyWords.join(", ")}.` : "",
    `Generate exactly ${TARGET_BANK_SIZE} varied sentences the learner can shadow (listen and repeat aloud) for this exact scene.`,
    "Cover different angles of the scenario: opening, asking for help, clarifying details, confirming, polite responses, small problems, and closing.",
    "Each sentence must be a complete, short, standalone sentence in the target language (never a fragment, never containing a blank/underscore placeholder), natural and idiomatic, with length and vocabulary matched to the learner's current level.",
    "Do not make near-duplicates. The sentences should feel like a reusable practice bank, not one tiny repeated set.",
    "All Traditional Chinese translations (zh field) must be natural Traditional Chinese.",
    existingVariants.length
      ? [
          "These sentence sets have already been used for this exact scene:",
          ...existingVariants.map((set, i) => `Set ${i + 1}: ${set.map((p) => p.en).join(" | ")}`),
          "Generate a NEW set covering different phrasing or a different angle of this scenario. Do not repeat or closely paraphrase the sentences above.",
        ].join("\n")
      : "",
    "Return ONLY valid JSON, no markdown fences, no prose, with this exact shape:",
    `{"patterns":[{"en":"target-language sentence","zh":"Traditional Chinese translation"}]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function readCachedPatternBank(
  sceneId: string,
  languageCode: string
): Promise<ScenePattern[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("scene_pattern_cache")
      .select("variant_index,patterns")
      .eq("scene_id", sceneId)
      .eq("language_code", languageCode)
      .order("variant_index", { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return dedupePatterns(
      data
      .filter((row) => Array.isArray(row.patterns) && row.patterns.length)
        .flatMap((row) => row.patterns as ScenePattern[])
    );
  } catch {
    return [];
  }
}

async function writeCachedPatternBank(
  sceneId: string,
  languageCode: string,
  patterns: ScenePattern[],
  model: string
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  try {
    await supabase.from("scene_pattern_cache").upsert(
      {
        scene_id: sceneId,
        language_code: languageCode,
        variant_index: 0,
        patterns,
        source: "gemini",
        model,
      },
      { onConflict: "scene_id,language_code,variant_index" }
    );
  } catch {
    // Cache is optional. Missing migration or schema drift must not break the API.
  }
}

export async function POST(req: Request) {
  let body: ScenePatternsRequest;
  try {
    body = (await req.json()) as ScenePatternsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.sceneId || !body.sceneName) {
    return NextResponse.json({ error: "Missing sceneId or sceneName" }, { status: 400 });
  }

  const languageCode = body.targetLanguage || "en";
  const targetLanguage = getLearningLanguage(languageCode);
  const learnerLevel = body.learnerLevel || body.difficulty;
  const cacheSceneId = `${body.sceneId}::level:${learnerLevel.replace(/[^A-Za-z-]/g, "")}`;

  const cachedBank = await readCachedPatternBank(cacheSceneId, languageCode);
  if (cachedBank.length >= MIN_GENERATED_BANK_SIZE) {
    return NextResponse.json({
      patterns: selectPracticeWindow(cachedBank),
      source: "cache",
      bankSize: cachedBank.length,
    });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    if (cachedBank.length > 0) {
      return NextResponse.json({
        patterns: selectPracticeWindow(cachedBank),
        source: "cache",
        bankSize: cachedBank.length,
      });
    }
    return NextResponse.json({ patterns: null, source: "unavailable" });
  }

  try {
    const raw = await generateWithGemini({
      prompt: buildPrompt(body, targetLanguage, cachedBank.length ? [cachedBank] : []),
      temperature: 0.8,
      maxOutputTokens: 4096,
      json: true,
    });
    const parsed = parseJsonFromModel<unknown>(raw);
    if (!isValidPatterns(parsed)) throw new Error("Gemini returned invalid patterns");
    const generatedBank = dedupePatterns(parsed.patterns);
    void writeCachedPatternBank(cacheSceneId, languageCode, generatedBank, "gemini");
    return NextResponse.json({
      patterns: selectPracticeWindow(generatedBank),
      source: "gemini",
      bankSize: generatedBank.length,
    });
  } catch {
    if (cachedBank.length > 0) {
      return NextResponse.json({
        patterns: selectPracticeWindow(cachedBank),
        source: "cache",
        bankSize: cachedBank.length,
      });
    }
    return NextResponse.json({ patterns: null, source: "unavailable" });
  }
}
