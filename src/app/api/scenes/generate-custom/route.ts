import { NextResponse } from "next/server";
import { createHash } from "crypto";
import type { EnglishLevel, LearningLanguageCode } from "@/types";
import { getLearningLanguage } from "@/data/learningLanguages";
import { generateWithGemini, getGeminiApiKey, parseJsonFromModel } from "@/server/gemini";
import { getSupabaseServerClient } from "@/server/supabaseClient";
import { inferScenarioPlan, type ScenarioPlan } from "@/services/sceneService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GenerateCustomSceneRequest {
  situation: string;
  role: string;
  place: string;
  difficulty: EnglishLevel;
  topic: string;
  pattern: string;
  targetLanguage?: LearningLanguageCode;
}

function normalizeCacheText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u00c0-\u024f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mayUseSharedCache(body: GenerateCustomSceneRequest): boolean {
  const combined = [body.situation, body.role, body.place, body.topic, body.pattern]
    .filter(Boolean)
    .join(" ");

  if (combined.length > 220) return false;
  if (/https?:\/\/|www\.|@/.test(combined)) return false;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(combined)) return false;
  if (/(line|ig|instagram|facebook|電話|手機|地址|身分證|護照|email|信箱|住址|公司統編)/i.test(combined)) return false;
  if (/\d[\d\s()+-]{6,}\d/.test(combined)) return false;

  return true;
}

function buildSharedCacheKey(body: GenerateCustomSceneRequest, targetLanguageCode: LearningLanguageCode): string {
  const normalized = [
    targetLanguageCode,
    body.difficulty,
    normalizeCacheText(body.situation),
    normalizeCacheText(body.role),
    normalizeCacheText(body.place),
    normalizeCacheText(body.topic),
    normalizeCacheText(body.pattern),
  ].join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

function isValidPlan(payload: unknown): payload is ScenarioPlan {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Partial<ScenarioPlan>;
  return Boolean(
    p.name &&
      typeof p.name === "string" &&
      Array.isArray(p.keyWords) &&
      p.keyWords.length >= 3 &&
      Array.isArray(p.patterns) &&
      p.patterns.length >= 8 &&
      p.patterns.every(
        (item) =>
          item &&
          typeof item.en === "string" &&
          item.en.trim() &&
          !/_{2,}/.test(item.en) &&
          typeof item.zh === "string"
      ) &&
      Array.isArray(p.stages) &&
      p.stages.length >= 3 &&
      p.stages.every((s) => s && typeof s.tutorPrompt === "string" && s.tutorPrompt.trim() && typeof s.sampleUser === "string") &&
      Array.isArray(p.quiz) &&
      p.quiz.length >= 1 &&
      p.quiz.every(
        (q) =>
          q &&
          typeof q.question === "string" &&
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          Number.isInteger(q.answerIndex)
      )
  );
}

async function readSharedCachedPlan(cacheKey: string): Promise<ScenarioPlan | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("custom_scene_plan_cache")
      .select("plan")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !isValidPlan(data?.plan)) return null;

    void supabase
      .from("custom_scene_plan_cache")
      .update({ last_used_at: new Date().toISOString() })
      .eq("cache_key", cacheKey);

    return data.plan;
  } catch {
    return null;
  }
}

async function writeSharedCachedPlan(
  cacheKey: string,
  languageCode: LearningLanguageCode,
  difficulty: EnglishLevel,
  plan: ScenarioPlan
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  try {
    await supabase.from("custom_scene_plan_cache").upsert(
      {
        cache_key: cacheKey,
        language_code: languageCode,
        difficulty_level: difficulty,
        plan,
        source: "gemini",
        model: "gemini",
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" }
    );
  } catch {
    // Shared cache is optional. Missing migration must not break scene creation.
  }
}

function buildPrompt(body: GenerateCustomSceneRequest, targetLanguage: ReturnType<typeof getLearningLanguage>) {
  return [
    `You are designing a role-play language-learning scenario for a learner studying ${targetLanguage.label} (${targetLanguage.nativeName}).`,
    `Learner's requested situation (may be written in Traditional Chinese or English): "${body.situation}"`,
    `Role the learner plays: "${body.role || "the learner"}"`,
    `Place/setting: "${body.place || "unspecified, infer a sensible one from the situation"}"`,
    body.topic ? `Topic keyword: "${body.topic}"` : "",
    body.pattern ? `Sentence pattern the learner specifically wants to practice: "${body.pattern}"` : "",
    `Difficulty level: ${body.difficulty}.`,
    "Design realistic, SPECIFIC content tailored to this exact situation. Do not produce generic filler content that could apply to any scenario.",
    `All target-language text (the "en" field inside patterns, tutorPrompt, sampleUser, and quiz options) must be natural, idiomatic ${targetLanguage.nativeName}, appropriate for a ${body.difficulty} learner.`,
    "All Traditional Chinese text (zh fields, learnerGoal, question, explanation, name, intro, title) must be natural Traditional Chinese.",
    "patterns must contain 10 to 14 varied items. Each pattern's \"en\" field must be a complete, short, standalone sentence (never a sentence fragment and never containing a blank/underscore placeholder) that the learner can read aloud on its own for shadowing practice, with length and vocabulary matched to the learner's difficulty level.",
    "The pattern bank should cover several angles of the learner's own topic: opening, stating the need, asking a question, clarifying details, confirming, reacting naturally, solving a small problem, and closing politely.",
    "Do not repeat or closely paraphrase patterns. This should feel like a reusable shadowing bank for this learner's exact idea.",
    "stages must be ordered logically from opening to closing (4 to 6 stages), each a concrete step of this specific situation.",
    "quiz must contain exactly 3 multiple-choice questions, each with exactly 4 options, testing something specific to this scenario (vocabulary, etiquette, or the right response).",
    "Return ONLY valid JSON, no markdown fences, no prose, with this exact shape:",
    `{"name":"Traditional Chinese scenario name","enName":"English scenario name","intro":"1-2 sentence Traditional Chinese description of the scenario","keyWords":["6 to 10 relevant ${targetLanguage.nativeName} words used in this scenario"],"patterns":[{"en":"target-language sentence","zh":"Traditional Chinese translation"}],"stages":[{"title":"Traditional Chinese stage title","enTitle":"target-language stage title","tutorPrompt":"what the counterpart character says in ${targetLanguage.nativeName}","learnerGoal":"Traditional Chinese description of what the learner should accomplish in this stage","sampleUser":"example ${targetLanguage.nativeName} learner reply"}],"quiz":[{"question":"Traditional Chinese multiple-choice question about this scenario","options":["4 short options, target-language or Traditional Chinese as fits the question"],"answerIndex":0,"explanation":"Traditional Chinese explanation of the correct answer"}]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  let body: GenerateCustomSceneRequest;
  try {
    body = (await req.json()) as GenerateCustomSceneRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.situation || !body.situation.trim()) {
    return NextResponse.json({ error: "Missing situation" }, { status: 400 });
  }

  const targetLanguageCode = body.targetLanguage || "en";
  const targetLanguage = getLearningLanguage(targetLanguageCode);
  const fallbackPlan = () => inferScenarioPlan(body.situation, body.place, body.role, targetLanguageCode);
  const canUseSharedCache = mayUseSharedCache(body);
  const sharedCacheKey = canUseSharedCache ? buildSharedCacheKey(body, targetLanguageCode) : null;

  if (sharedCacheKey) {
    const cachedPlan = await readSharedCachedPlan(sharedCacheKey);
    if (cachedPlan) {
      return NextResponse.json({ plan: cachedPlan, source: "shared-cache" });
    }
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json({ plan: fallbackPlan(), source: "fallback" });
  }

  try {
    const raw = await generateWithGemini({
      prompt: buildPrompt(body, targetLanguage),
      temperature: 0.7,
      maxOutputTokens: 4096,
      json: true,
    });
    const parsed = parseJsonFromModel<unknown>(raw);
    if (!isValidPlan(parsed)) throw new Error("Gemini returned an invalid scenario plan");
    if (sharedCacheKey) {
      void writeSharedCachedPlan(sharedCacheKey, targetLanguageCode, body.difficulty, parsed);
    }
    return NextResponse.json({ plan: parsed, source: "gemini" });
  } catch {
    return NextResponse.json({ plan: fallbackPlan(), source: "fallback" });
  }
}
