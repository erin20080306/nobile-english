import { NextResponse } from "next/server";
import type { Scene, TutorFeedback } from "@/types";
import { mockAiTutorService } from "@/services/mockAiTutorService";
import { getLearningLanguage } from "@/data/learningLanguages";
import { generateWithGemini, getGeminiApiKey, getGeminiModel, parseJsonFromModel } from "@/server/gemini";

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


function isGarbledInput(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length < 2) return true;
  const letters = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const letterRatio = letters / trimmed.length;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount === 1 && trimmed.length <= 3 && letterRatio < 0.8) return true;
  const hasVowelOrCommonWord = /[aeiouAEIOU]|\b(the|a|is|i|you|he|she|we|do|can|my|hi|hello|yes|no|ok)\b/i.test(trimmed);
  if (trimmed.length >= 4 && letterRatio > 0.8 && !hasVowelOrCommonWord) return true;
  return false;
}

const CONFUSION_REPLIES: Array<{ en: string; zh: string }> = [
  { en: "Sorry, I didn't quite catch that. Could you say it again?", zh: "抱歉，我沒聽清楚，可以再說一次嗎？" },
  { en: "Hmm, could you repeat that? I'm not sure I understood.", zh: "嗯，可以再說一遍嗎？我不確定我聽懂了。" },
  { en: "Pardon? I missed that — mind saying it again?", zh: "什麼？我沒聽到——可以再說一次嗎？" },
  { en: "Sorry, what did you say? Could you say that a bit more clearly?", zh: "不好意思，你說什麼？可以說清楚一點嗎？" },
];

function buildPrompt({ scene, userInput, turn, history = [] }: TutorRequest, persona: string) {
  const targetLanguage = getLearningLanguage(scene.targetLanguage || "en");
  const transcript = history.slice(-8).join("\n");
  const patterns = scene.keyPatterns.slice(0, 3).map((p) => p.en).join(" | ");

  const langInstruction = targetLanguage.code === "en"
    ? "Reply in English. Casual, warm, varied sentence lengths. Natural fillers like 'Oh!', 'Sure!', 'Hmm...', 'Yeah,' welcome when they fit."
    : `Reply ONLY in ${targetLanguage.nativeName}. Never switch to English unless the learner explicitly asks for a translation. Sound like a native speaker, not a textbook.`;

  return [
    `You are ${persona}, playing the role of a real person in the scene: "${scene.name}".`,
    langInstruction,
    sceneRoleGuide(scene),
    ``,
    `## MOST IMPORTANT RULE`,
    `The learner just said: "${userInput}"`,
    `Your reply MUST directly respond to those specific words. Do NOT ignore what they said and jump to a generic next step.`,
    `- If they asked a question → answer it first.`,
    `- If they made a statement or shared information → react to the content ("Oh really?", "That sounds great!", "I see,", etc.) before moving on.`,
    `- If they used a wrong word or awkward phrase → still understand their intent and reply naturally (real people don't refuse to respond over grammar).`,
    `- If they wrote something very short or unclear → ask a natural, curious follow-up question ("Oh? What do you mean?", "Sorry, could you say a bit more?").`,
    ``,
    `## CONVERSATION FLOW`,
    transcript ? `Conversation so far:\n${transcript}\n` : "",
    `After reacting to what they said, naturally continue the ${scene.name} scenario — but only if it fits. Do NOT repeat any question or phrase already used above.`,
    `Key patterns for this scene (for context, do not force them): ${patterns}`,
    ``,
    `## STYLE`,
    `1-3 sentences. Vary your opening each turn (don't always start the same way). Sound spontaneous, not scripted.`,
    `Turn ${turn}/7.`,
    ``,
    `Return ONLY valid JSON:`,
    `{"reply":"natural in-character reply in ${targetLanguage.nativeName} — react first, then continue","replyZh":"繁體中文翻譯","ttsCandidate":"exact reply text for TTS, no Chinese characters","naturalness":50-99,"grammarTip":"短中文文法建議（如無問題可留空）","betterWay":"更自然的說法 in ${targetLanguage.nativeName}（如已很好可留空）","zhExplain":"短中文補充說明","encouragement":"短鼓勵（繁中）"}`,
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

  // Garbled/unclear input → respond like a real person asking for clarification.
  if (isGarbledInput(body.userInput)) {
    const pick = CONFUSION_REPLIES[body.turn % CONFUSION_REPLIES.length];
    const local = mockAiTutorService.feedback(body.scene, body.userInput, body.turn, body.history || []);
    return NextResponse.json({
      source: "local",
      feedback: normalizeTutorFeedback({
        ...local,
        reply: pick.en,
        replyZh: pick.zh,
        ttsCandidate: pick.en,
      }),
    });
  }

  try {
    const outputText = await generateWithGemini({
      prompt: buildPrompt(body, persona),
      temperature: 0.78,
      maxOutputTokens: 512,
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
    return NextResponse.json({ source: "gemini", model, feedback });
  } catch {
    return fallback(body);
  }
}
