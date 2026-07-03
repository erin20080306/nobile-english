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
    p.patterns.length >= 4 &&
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

// Cache up to this many distinct sentence-set variants per scene/language.
// Once this many exist, no more Gemini calls are made for that scene and a
// variant is picked at random on every request, so learners see rotating
// (but stable, cached) content across visits instead of an ever-growing
// stream of new API calls.
const MAX_VARIANTS = 3;

function buildPrompt(
  body: ScenePatternsRequest,
  targetLanguage: ReturnType<typeof getLearningLanguage>,
  existingVariants: ScenePattern[][]
) {
  return [
    `You are creating shadowing (repeat-after-me) practice sentences for a language-learning app, for a learner studying ${targetLanguage.label} (${targetLanguage.nativeName}).`,
    `Scenario theme: "${body.themeName}". Specific scene: "${body.sceneName}" (${body.enName}).`,
    `Difficulty level: ${body.difficulty}.`,
    body.keyWords.length ? `Relevant vocabulary to naturally incorporate where fitting: ${body.keyWords.join(", ")}.` : "",
    "Generate 4 to 6 sentences the learner can shadow (listen and repeat aloud) for this exact scene.",
    "Each sentence must be a complete, short, standalone sentence in the target language (never a fragment, never containing a blank/underscore placeholder), natural and idiomatic, with length and vocabulary matched to the difficulty level.",
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

async function readCachedVariants(
  sceneId: string,
  languageCode: string
): Promise<{ variantIndex: number; patterns: ScenePattern[] }[]> {
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
    return data
      .filter((row) => Array.isArray(row.patterns) && row.patterns.length)
      .map((row) => ({ variantIndex: row.variant_index as number, patterns: row.patterns as ScenePattern[] }));
  } catch {
    return [];
  }
}

async function writeCachedVariant(
  sceneId: string,
  languageCode: string,
  variantIndex: number,
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
        variant_index: variantIndex,
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

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
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

  const variants = await readCachedVariants(body.sceneId, languageCode);
  if (variants.length >= MAX_VARIANTS) {
    return NextResponse.json({ patterns: pickRandom(variants).patterns, source: "cache" });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    if (variants.length > 0) {
      return NextResponse.json({ patterns: pickRandom(variants).patterns, source: "cache" });
    }
    return NextResponse.json({ patterns: null, source: "unavailable" });
  }

  try {
    const raw = await generateWithGemini({
      prompt: buildPrompt(body, targetLanguage, variants.map((v) => v.patterns)),
      temperature: 0.8,
      maxOutputTokens: 1024,
      json: true,
    });
    const parsed = parseJsonFromModel<unknown>(raw);
    if (!isValidPatterns(parsed)) throw new Error("Gemini returned invalid patterns");
    const nextVariantIndex = variants.length;
    void writeCachedVariant(body.sceneId, languageCode, nextVariantIndex, parsed.patterns, "gemini");
    return NextResponse.json({ patterns: parsed.patterns, source: "gemini" });
  } catch {
    if (variants.length > 0) {
      return NextResponse.json({ patterns: pickRandom(variants).patterns, source: "cache" });
    }
    return NextResponse.json({ patterns: null, source: "unavailable" });
  }
}
