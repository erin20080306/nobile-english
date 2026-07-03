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

function buildPrompt(body: ScenePatternsRequest, targetLanguage: ReturnType<typeof getLearningLanguage>) {
  return [
    `You are creating shadowing (repeat-after-me) practice sentences for a language-learning app, for a learner studying ${targetLanguage.label} (${targetLanguage.nativeName}).`,
    `Scenario theme: "${body.themeName}". Specific scene: "${body.sceneName}" (${body.enName}).`,
    `Difficulty level: ${body.difficulty}.`,
    body.keyWords.length ? `Relevant vocabulary to naturally incorporate where fitting: ${body.keyWords.join(", ")}.` : "",
    "Generate 4 to 6 sentences the learner can shadow (listen and repeat aloud) for this exact scene.",
    "Each sentence must be a complete, short, standalone sentence in the target language (never a fragment, never containing a blank/underscore placeholder), natural and idiomatic, with length and vocabulary matched to the difficulty level.",
    "All Traditional Chinese translations (zh field) must be natural Traditional Chinese.",
    "Return ONLY valid JSON, no markdown fences, no prose, with this exact shape:",
    `{"patterns":[{"en":"target-language sentence","zh":"Traditional Chinese translation"}]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function readCachedPatterns(sceneId: string, languageCode: string): Promise<ScenePattern[] | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("scene_pattern_cache")
      .select("patterns")
      .eq("scene_id", sceneId)
      .eq("language_code", languageCode)
      .maybeSingle();
    if (error || !Array.isArray(data?.patterns) || !data.patterns.length) return null;
    return data.patterns as ScenePattern[];
  } catch {
    return null;
  }
}

async function writeCachedPatterns(
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
        patterns,
        source: "gemini",
        model,
      },
      { onConflict: "scene_id,language_code" }
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

  const cached = await readCachedPatterns(body.sceneId, languageCode);
  if (cached) {
    return NextResponse.json({ patterns: cached, source: "cache" });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json({ patterns: null, source: "unavailable" });
  }

  try {
    const raw = await generateWithGemini({
      prompt: buildPrompt(body, targetLanguage),
      temperature: 0.7,
      maxOutputTokens: 1024,
      json: true,
    });
    const parsed = parseJsonFromModel<unknown>(raw);
    if (!isValidPatterns(parsed)) throw new Error("Gemini returned invalid patterns");
    void writeCachedPatterns(body.sceneId, languageCode, parsed.patterns, "gemini");
    return NextResponse.json({ patterns: parsed.patterns, source: "gemini" });
  } catch {
    return NextResponse.json({ patterns: null, source: "unavailable" });
  }
}
