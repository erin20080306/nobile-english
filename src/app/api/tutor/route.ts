import { NextResponse } from "next/server";
import { createHash } from "crypto";
import type { Scene, TutorFeedback } from "@/types";
import { mockAiTutorService } from "@/services/mockAiTutorService";
import { getLearningLanguage } from "@/data/learningLanguages";
import { generateWithGemini, getGeminiApiKey, getGeminiModel, parseJsonFromModel } from "@/server/gemini";
import { getSupabaseServerClient } from "@/server/supabaseClient";

export const runtime = "nodejs";

const PERSONAS: Record<string, string[]> = {
  daily:      ["Alex (local helper)", "Jordan (neighbor)", "Taylor (local guide)"],
  travel:     ["Morgan (local passerby)", "Riley (tourist information guide)", "Alex (helpful local)"],
  cafe:       ["Mia (barista)", "Leo (cafe owner)", "Sophie (barista)"],
  airport:    ["Jake (check-in staff)", "Emma (gate agent)", "Ryan (airline rep)"],
  hotel:      ["Olivia (front desk)", "Liam (concierge)", "Ava (receptionist)"],
  shopping:   ["Noah (sales staff)", "Chloe (store clerk)", "Ethan (shopkeeper)"],
  interview:  ["Dr. Carter (interviewer)", "Ms. Lee (HR manager)", "Mr. Brown (hiring manager)"],
  hospital:   ["Dr. Kim (doctor)", "Nurse Lily (nurse)", "Dr. Sam (physician)"],
  restaurant: ["Lucas (waiter)", "Isabella (server)", "Mason (host)"],
  default:    ["Alex", "Jordan", "Taylor", "Morgan", "Riley"],
};

function getPersona(themeId?: string): string {
  const key = themeId && PERSONAS[themeId] ? themeId : "default";
  const list = PERSONAS[key];
  return list[Math.floor(Math.random() * list.length)];
}

function getScenePersona(scene: Scene, requestedPersona?: string) {
  const title = `${scene.name} ${scene.enName}`.toLowerCase();
  if (title.includes("問路") || title.includes("direction")) return "Morgan (helpful local guide)";
  return requestedPersona || getPersona(scene.themeId);
}

function sceneRoleGuide(scene: Scene) {
  const title = `${scene.name} ${scene.enName}`.toLowerCase();
  if (title.includes("問路") || title.includes("direction")) {
    return [
      "You are a helpful local passerby or local guide giving directions.",
      "Casual small talk is allowed, but your identity must stay as a passerby/local guide.",
      "If the learner mentions food, seafood, shops, or asks 'do you sell...', do NOT become a store clerk or seller.",
      "Instead, say you are not selling anything, then naturally mention a nearby place and give directions.",
    ].join(" ");
  }
  if (scene.themeId === "travel") {
    return "You are a helpful local or travel staff member. Keep every reply about travel, locations, transport, tickets, or directions.";
  }
  if (scene.themeId === "cafe") {
    return "You are cafe staff. Keep every reply about ordering drinks, food, sizes, sweetness, payment, or pickup.";
  }
  if (scene.themeId === "custom" && /餐廳|點餐|restaurant|ordering/i.test(`${scene.name} ${scene.enName} ${scene.intro}`)) {
    return [
      "You are restaurant host/server staff, never the customer.",
      "Progress through a realistic restaurant flow: reservation or walk-in, seating preference, menu recommendations, ordering food and drinks, changes or extras, then bill/payment.",
      "Keep replies in character and move the next stage forward naturally.",
    ].join(" ");
  }
  if (scene.themeId === "shopping") {
    return "You are store staff. Keep every reply about products, sizes, prices, stock, payment, or returns.";
  }
  if (scene.themeId === "airport") {
    return "You are airport or hotel staff. Keep every reply about check-in, luggage, gates, rooms, or travel logistics.";
  }
  if (scene.themeId === "interview") {
    return "You are an interviewer. Keep every reply about the job interview and candidate answers.";
  }
  return "Stay strictly inside the current scenario. If the learner goes off topic, acknowledge briefly and guide them back to the scenario.";
}

interface TutorRequest {
  scene: Scene;
  userInput: string;
  turn: number;
  history?: string[];
  persona?: string;
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function buildTutorReplyCacheKey(body: TutorRequest, persona: string) {
  const languageCode = body.scene.targetLanguage || "en";
  const recentHistory = (body.history || []).slice(-8).join("\n").trim();
  const normalizedInput = body.userInput.trim().replace(/\s+/g, " ").toLowerCase();
  return hashText(
    JSON.stringify({
      version: 2,
      sceneId: body.scene.id,
      languageCode,
      persona,
      turn: body.turn,
      userInput: normalizedInput,
      historyHash: hashText(recentHistory),
    })
  );
}

async function readCachedTutorReply(cacheKey: string): Promise<TutorFeedback | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("tutor_reply_cache")
      .select("feedback")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data?.feedback) return null;
    return normalizeTutorFeedback(data.feedback as Partial<TutorFeedback>);
  } catch {
    return null;
  }
}

async function writeCachedTutorReply(
  cacheKey: string,
  body: TutorRequest,
  persona: string,
  model: string,
  feedback: TutorFeedback
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  try {
    await supabase.from("tutor_reply_cache").upsert(
      {
        cache_key: cacheKey,
        scene_id: body.scene.id,
        language_code: body.scene.targetLanguage || "en",
        persona,
        turn: body.turn,
        user_input: body.userInput.trim(),
        history_hash: hashText((body.history || []).slice(-8).join("\n").trim()),
        model,
        feedback,
      },
      { onConflict: "cache_key" }
    );
  } catch {
    // Cache is optional; tutor practice should keep working if the migration has
    // not been applied yet.
  }
}

function fallback(body: TutorRequest, status = 200) {
  return NextResponse.json({
    source: "local",
    feedback: normalizeTutorFeedback(mockAiTutorService.feedback(body.scene, body.userInput, body.turn, body.history || [])),
  }, { status });
}

function normalizeTutorFeedback(feedback: Partial<TutorFeedback>): TutorFeedback {
  const reply = String(feedback.reply || "");
  const replyZh = String(feedback.replyZh || "");
  const naturalness = Number(feedback.naturalness);

  return {
    reply,
    replyZh,
    ttsCandidate: String(feedback.ttsCandidate || reply || "").trim(),
    naturalness: Number.isFinite(naturalness) ? naturalness : 70,
    grammarTip: String(feedback.grammarTip || ""),
    betterWay: String(feedback.betterWay || ""),
    zhExplain: String(feedback.zhExplain || ""),
    encouragement: String(feedback.encouragement || ""),
  };
}


function buildPrompt({ scene, userInput, turn, history = [] }: TutorRequest, persona: string) {
  const targetLanguage = getLearningLanguage(scene.targetLanguage || "en");
  // The client sends the full alternating transcript (both "Tutor:" and "You:"
  // lines). Show the recent window so the model can see what it already asked
  // and never repeat the same question.
  const transcript = history.slice(-8).join("\n");
  const patterns = scene.keyPatterns.slice(0, 3).map((p) => p.en).join(" | ");
  const tutorLines = scene.dialogue
    .filter((d) => d.speaker === "tutor")
    .slice(0, 3)
    .map((d) => d.en)
    .join(" / ");

  return [
    `You are ${persona}, playing the NON-LEARNER role in scene: "${scene.name}".`,
    `Target learning language: ${targetLanguage.label} / ${targetLanguage.nativeName}.`,
    targetLanguage.code === "en"
      ? "Use natural English for reply and betterWay."
      : `Use natural ${targetLanguage.nativeName} for reply and betterWay. Do not answer in English unless the learner explicitly asks for an English translation.`,
    sceneRoleGuide(scene),
    `IMPORTANT: You are the ${persona} (staff/host/interviewer). The learner is the customer/guest/applicant. NEVER say lines that belong to the learner's role.`,
    `Your job: respond naturally as ${persona} to what the learner said, then MOVE THE SCENE FORWARD to the next step.`,
    `CRITICAL: Build your next reply from the learner's actual latest answer. If the learner gives a short answer, infer the likely intent and ask one natural follow-up that fits it.`,
    `Do NOT follow the example script mechanically. The example lines are only reference material, not a fixed order.`,
    `Do NOT repeat a question or sentence you already said earlier in the conversation. Each turn must advance to a new step (e.g. cafe flow: greeting -> order -> size/hot-iced -> name -> payment -> pickup time). Vary your wording so it never feels scripted.`,
    `You may chat naturally, but never change your role. If the learner's sentence is off-topic, bridge it back to the scene in character.`,
    `The example tutor lines below are only style hints; do NOT copy them verbatim: ${tutorLines}`,
    `Key patterns learner should use: ${patterns}`,
    transcript ? `Conversation so far (do not repeat any tutor line already here):\n${transcript}` : "",
    `Turn ${turn}/7. Learner just said: "${userInput}"`,
    ``,
    `Return ONLY valid JSON (no extra text):`,
    `{"reply":"your natural in-character ${targetLanguage.nativeName} response, 2 short sentences","replyZh":"Traditional Chinese translation","ttsCandidate":"the exact text to be spoken by TTS (same as reply, but without any Chinese characters or explanations)","naturalness":50-99,"grammarTip":"短中文文法建議","betterWay":"more natural version of learner sentence in ${targetLanguage.nativeName}","zhExplain":"短中文解釋","encouragement":"短鼓勵繁中，可加一句${targetLanguage.nativeName}"}`,
  ].filter(Boolean).join("\n");
}

export async function POST(req: Request) {
  let body: TutorRequest;
  try {
    body = (await req.json()) as TutorRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.scene || !body.userInput || !body.turn) {
    return NextResponse.json({ error: "Missing scene, userInput, or turn" }, { status: 400 });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) return fallback(body);

  const model = getGeminiModel();
  const persona = getScenePersona(body.scene, body.persona);
  const cacheKey = buildTutorReplyCacheKey(body, persona);
  const cachedFeedback = await readCachedTutorReply(cacheKey);
  if (cachedFeedback) {
    return NextResponse.json({ source: "gemini_cache", model, feedback: cachedFeedback });
  }

  try {
    const outputText = await generateWithGemini({
      prompt: buildPrompt(body, persona),
      temperature: 0.85,
      maxOutputTokens: 640,
      json: true,
    });

    const parsed = parseJsonFromModel<Partial<TutorFeedback>>(outputText);
    const local = mockAiTutorService.feedback(body.scene, body.userInput, body.turn, body.history || []);
    const feedback = normalizeTutorFeedback({
      reply: String(parsed.reply || local.reply),
      replyZh: String(parsed.replyZh || local.replyZh),
      ttsCandidate: String(parsed.ttsCandidate || parsed.reply || local.reply),
      naturalness: Math.max(45, Math.min(99, Number(parsed.naturalness || local.naturalness))),
      grammarTip: String(parsed.grammarTip || local.grammarTip),
      betterWay: String(parsed.betterWay || local.betterWay),
      zhExplain: String(parsed.zhExplain || local.zhExplain),
      encouragement: String(parsed.encouragement || local.encouragement),
    });
    await writeCachedTutorReply(cacheKey, body, persona, model, feedback);
    return NextResponse.json({ source: "gemini", model, feedback });
  } catch {
    return fallback(body);
  }
}
