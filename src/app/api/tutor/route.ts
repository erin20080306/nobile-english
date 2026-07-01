import { NextResponse } from "next/server";
import { createHash } from "crypto";
import type {
  Scene,
  TutorApiFailure,
  TutorApiResponse,
  TutorApiSuccess,
  TutorConversationState,
  TutorFeedback,
} from "@/types";
import { mockAiTutorService } from "@/services/mockAiTutorService";
import { getLearningLanguage } from "@/data/learningLanguages";
import {
  generateWithGemini,
  getGeminiApiKey,
  getGeminiModel,
  parseJsonFromModel,
} from "@/server/gemini";
import { getSupabaseServerClient } from "@/server/supabaseClient";
import {
  advanceTutorStateFromUser,
  createInitialTutorState,
  mergeTutorState,
  normalizeTutorState,
  stateForPrompt,
} from "@/server/tutor/conversationState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERSONAS: Record<string, string[]> = {
  daily: ["Alex (local helper)", "Jordan (neighbor)", "Taylor (local guide)"],
  travel: ["Morgan (local passerby)", "Riley (tourist information guide)", "Alex (helpful local)"],
  cafe: ["Mia (barista)", "Leo (cafe owner)", "Sophie (barista)"],
  airport: ["Jake (check-in staff)", "Emma (gate agent)", "Ryan (airline rep)"],
  hotel: ["Olivia (front desk)", "Liam (concierge)", "Ava (receptionist)"],
  shopping: ["Noah (sales staff)", "Chloe (store clerk)", "Ethan (shopkeeper)"],
  interview: ["Dr. Carter (interviewer)", "Ms. Lee (HR manager)", "Mr. Brown (hiring manager)"],
  hospital: ["Dr. Kim (doctor)", "Nurse Lily (nurse)", "Dr. Sam (physician)"],
  restaurant: ["Lucas (waiter)", "Isabella (server)", "Mason (host)"],
  default: ["Alex", "Jordan", "Taylor", "Morgan", "Riley"],
};

interface TutorRequest {
  scene: Scene;
  userInput: string;
  turn: number;
  history?: string[];
  persona?: string;
  state?: Partial<TutorConversationState> | null;
}

interface GeminiTutorPayload extends Partial<TutorFeedback> {
  state?: Partial<TutorConversationState>;
}

class GeminiInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiInvalidResponseError";
  }
}

class GeminiRequestFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiRequestFailedError";
  }
}

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

function isMockTutorAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_MOCK_TUTOR === "true";
}

function sceneRoleGuide(scene: Scene) {
  const title = `${scene.name} ${scene.enName} ${scene.intro}`.toLowerCase();
  if (title.includes("問路") || title.includes("direction")) {
    return [
      "You are a helpful local passerby or local guide giving directions.",
      "You are NOT a shop clerk and you are not selling anything.",
      "If the learner mentions food, shops, groceries, or asks whether you sell something, stay in role: say you do not sell it and point them to a nearby place.",
    ].join(" ");
  }
  if (scene.themeId === "travel") {
    return "You are a helpful local or travel staff member. Keep the conversation about travel, locations, transport, tickets, directions, or local help.";
  }
  if (scene.themeId === "cafe") {
    return "You are cafe staff. Progress through a realistic cafe flow: item, size, hot/iced, sweetness or ice if relevant, for-here/to-go, name, payment, pickup.";
  }
  if (scene.themeId === "custom" && /餐廳|點餐|restaurant|ordering/i.test(`${scene.name} ${scene.enName} ${scene.intro}`)) {
    return "You are restaurant host/server staff, never the customer. Progress through party size, seating or reservation, menu, order, drinks, extras, bill/payment.";
  }
  if (scene.themeId === "shopping") {
    return "You are store staff. Progress through product need, size/color, stock, price/discount, fitting room, payment, returns.";
  }
  if (scene.themeId === "airport") {
    return "You are airport or hotel staff. Progress through passport/booking, luggage, seat/room preference, gate/room details, next instructions.";
  }
  if (scene.themeId === "interview") {
    return "You are an interviewer. Progress through greeting, background, experience, strengths, examples, motivation, closing.";
  }
  return "Stay strictly inside the current scenario. If the learner goes off topic, acknowledge briefly and guide them back to the scenario in character.";
}

function uniqueTexts(items: string[], max = 12) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const text = item.trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    result.push(text);
    if (result.length >= max) break;
  }
  return result;
}

function deriveAskedQuestionsFromHistory(history: string[]) {
  return uniqueTexts(
    history
      .filter((line) => /^Tutor:/i.test(line))
      .map((line) => line.replace(/^Tutor:\s*/i, "").trim())
      .filter((line) => /[?？]$/.test(line) || /please|which|what|where|when|how|would|do you|ご|ますか|세요|나요|vuoi|quiere/i.test(line))
      .slice(-8)
  );
}

function nextTutorMoveGuide(scene: Scene, state: TutorConversationState, userInput: string) {
  const key = `${scene.themeId} ${scene.name} ${scene.enName} ${scene.intro}`.toLowerCase();
  const missing = new Set(state.missingInfo);
  const known = state.knownInfo;
  const latest = userInput.trim();

  if (key.includes("cafe") || key.includes("coffee") || key.includes("咖啡")) {
    if (known.order_item && missing.has("size")) return `Acknowledge "${known.order_item}" naturally, then ask only about size.`;
    if (known.order_item && missing.has("temperature")) return `Acknowledge "${known.order_item}" and ask whether it should be hot or iced.`;
    if (known.order_item && missing.has("dining_option")) return "Ask whether it is for here or to go; do not ask what they want again.";
    if (known.order_item && missing.has("payment_method")) return "Confirm the order briefly, then ask how they would like to pay.";
    if (!known.order_item) return `React to the learner's latest words "${latest}" and ask what drink or food they want.`;
    return "Confirm the order in character and give a realistic next step such as name, total, or pickup.";
  }

  if (key.includes("restaurant") || key.includes("餐廳")) {
    if (missing.has("party_size")) return "As the host/server, ask for the party size or reservation status.";
    if (missing.has("seating_preference")) return "Offer a natural seating choice or guide them to a table.";
    if (missing.has("order_item")) return "Move into ordering: offer the menu or ask what they would like to order.";
    if (missing.has("drink")) return "Ask for a drink or side in a server-like way.";
    if (missing.has("payment_method")) return "Confirm the meal/order and move toward the bill or payment.";
    return "Close the restaurant exchange naturally without sounding like a teacher.";
  }

  if (key.includes("direction") || key.includes("travel") || key.includes("問路")) {
    if (missing.has("destination")) return `Use the latest message "${latest}" to identify where they want to go; ask for the destination only if unclear.`;
    if (missing.has("transport_preference")) return "Give one useful direction, then ask whether they prefer walking, transit, or taxi.";
    return "Give specific next-step directions and one practical landmark.";
  }

  if (key.includes("shopping")) {
    if (missing.has("product")) return "Ask what product they are looking for, or respond to the product they named.";
    if (missing.has("size")) return "Ask about size/color/fit, not a generic follow-up.";
    if (missing.has("payment_method")) return "Move toward checkout or payment.";
    return "Respond like store staff and move one realistic step forward.";
  }

  if (key.includes("interview")) {
    return "Respond as an interviewer: ask a specific follow-up based on the candidate's latest answer, not generic encouragement.";
  }

  return `React concretely to "${latest}", reuse knownInfo if useful, and ask one scene-specific next question only if needed.`;
}

function learnerAnswerStyleGuide(userInput: string) {
  const text = userInput.trim();
  const shortAnswer = Array.from(text).length <= 12;
  const unsure = /\b(i don't know|not sure|maybe|sorry|help|what|how)\b|不知道|不會|抱歉|すみません|わかりません|잘 모르|미안|non so|scusa|no sé|perdón/i.test(text);
  const hasLikelyGrammarNoise = /\b(i want go|i no|me want|can has|want coffee large|where is go)\b/i.test(text);

  if (unsure) {
    return "The learner sounds unsure. In the role reply, be patient and human: reassure them briefly, offer two concrete choices or a simple next step, and keep the scene moving.";
  }
  if (shortAnswer) {
    return "The learner gave a short or incomplete answer. Treat it as useful partial information, acknowledge what you understood, then ask one concrete clarifying question. Do not say it is incomplete.";
  }
  if (hasLikelyGrammarNoise) {
    return "The learner's meaning is understandable but the wording is unnatural. In the role reply, respond to the meaning like a real person; put any correction only in grammarTip/betterWay.";
  }
  return "If the learner's sentence is imperfect but understandable, respond to the intended meaning first. Be warm, specific, and in character.";
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function buildTutorReplyCacheKey(body: TutorRequest, persona: string, state: TutorConversationState) {
  const languageCode = body.scene.targetLanguage || "en";
  const recentHistory = (body.history || []).slice(-10).join("\n").trim();
  const normalizedInput = body.userInput.trim().replace(/\s+/g, " ").toLowerCase();
  return hashText(
    JSON.stringify({
      version: 6,
      sceneId: body.scene.id,
      languageCode,
      persona,
      phase: state.phase,
      knownInfo: state.knownInfo,
      missingInfo: state.missingInfo,
      askedQuestions: state.askedQuestions.slice(-8),
      turn: body.turn,
      userInput: normalizedInput,
      historyHash: hashText(recentHistory),
    })
  );
}

async function readCachedTutorReply(
  cacheKey: string,
  scene: Scene,
  persona: string
): Promise<{ feedback: TutorFeedback; state: TutorConversationState } | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("tutor_reply_cache")
      .select("feedback,state")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data?.feedback || !data?.state) return null;
    return {
      feedback: normalizeTutorFeedback(data.feedback as Partial<TutorFeedback>),
      state: normalizeTutorState(scene, persona, data.state as Partial<TutorConversationState>),
    };
  } catch {
    return null;
  }
}

async function writeCachedTutorReply(
  cacheKey: string,
  body: TutorRequest,
  persona: string,
  model: string,
  sourceState: TutorConversationState,
  feedback: TutorFeedback,
  state: TutorConversationState
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
        history_hash: hashText((body.history || []).slice(-10).join("\n").trim()),
        state_hash: hashText(stateForPrompt(sourceState)),
        source: "gemini",
        model,
        feedback,
        state,
      },
      { onConflict: "cache_key" }
    );
  } catch {
    // Cache is optional. Missing migration or schema drift must not break the API.
  }
}

function normalizeTutorFeedback(feedback: Partial<TutorFeedback>): TutorFeedback {
  const reply = String(feedback.reply || "").trim();
  const replyZh = String(feedback.replyZh || "").trim();
  const naturalness = Number(feedback.naturalness);

  return {
    reply,
    replyZh,
    ttsCandidate: String(feedback.ttsCandidate || reply || "").trim(),
    naturalness: Number.isFinite(naturalness) ? Math.max(1, Math.min(100, naturalness)) : 70,
    grammarTip: String(feedback.grammarTip || ""),
    betterWay: String(feedback.betterWay || ""),
    zhExplain: String(feedback.zhExplain || ""),
    encouragement: String(feedback.encouragement || ""),
  };
}

function failure(
  status: number,
  errorCode: TutorApiFailure["errorCode"],
  message: string,
  retryable: boolean
) {
  return NextResponse.json<TutorApiResponse>(
    { ok: false, source: "unavailable", errorCode, message, retryable },
    { status }
  );
}

function success(response: Omit<TutorApiSuccess, "ok">) {
  return NextResponse.json<TutorApiResponse>({ ok: true, ...response });
}

function mockSuccess(body: TutorRequest, persona: string, state: TutorConversationState) {
  const feedback = normalizeTutorFeedback(
    mockAiTutorService.feedback(body.scene, body.userInput, body.turn, body.history || [])
  );
  return success({
    source: "mock",
    feedback,
    state: {
      ...state,
      lastTutorAction: "mock_basic_practice",
      summary: "Mock tutor mode is active. This is a basic practice reply, not a live AI tutor.",
    },
  });
}

function buildPrompt(body: TutorRequest, persona: string, state: TutorConversationState) {
  const { scene, userInput, history = [] } = body;
  const targetLanguage = getLearningLanguage(scene.targetLanguage || "en");
  const transcript = history.slice(-12).join("\n");
  const patterns = scene.keyPatterns.slice(0, 4).map((p) => p.en).join(" | ");
  const tutorLines = scene.dialogue
    .filter((d) => d.speaker === "tutor")
    .slice(0, 4)
    .map((d) => d.en)
    .join(" / ");

  return [
    `You are ${persona}, playing the NON-LEARNER role in scene: "${scene.name}" (${scene.enName}).`,
    `Target learning language: ${targetLanguage.label} / ${targetLanguage.nativeName}.`,
    targetLanguage.code === "en"
      ? "Use natural English for reply, ttsCandidate, and betterWay."
      : `Use natural ${targetLanguage.nativeName} for reply, ttsCandidate, and betterWay. Do not answer in English unless the learner explicitly asks for English.`,
    sceneRoleGuide(scene),
    "You are a scene character first, not an English teacher. Do NOT keep saying Great job, Nice English, Try saying, Could you tell me more, or generic teaching praise.",
    "Keep the ROLE reply separate from teaching feedback. The reply and ttsCandidate must be only what the character would actually say out loud in the scene.",
    "Move the scene forward based on the current state. Remember knownInfo, do not ask for information already collected, and do not repeat askedQuestions.",
    `Recommended next tutor move: ${nextTutorMoveGuide(scene, state, userInput)}`,
    `Human handling guide for imperfect learner answers: ${learnerAnswerStyleGuide(userInput)}`,
    "Your reply must react to a concrete detail from the learner's latest message or knownInfo whenever one exists.",
    "If the learner answer is incomplete, do NOT lecture. Use a natural character line like: acknowledge, gently confirm, offer options, then ask one concrete next question.",
    "Do not ask a vague 'tell me more' question when a concrete scene step is available.",
    "Ask at most ONE natural follow-up question unless you are confirming or closing.",
    "There is no forced 7-turn ending. Continue naturally until the learner ends or the state is readyToClose.",
    `Example script lines are style hints only; never copy them verbatim: ${tutorLines}`,
    `Useful learner patterns: ${patterns}`,
    `Current conversation state JSON:\n${stateForPrompt(state)}`,
    transcript ? `Recent transcript:\n${transcript}` : "",
    `Learner just said: "${userInput}"`,
    "",
    `Return ONLY valid JSON with this exact shape:`,
    `{"feedback":{"reply":"in-character ${targetLanguage.nativeName} reply, 1-2 short sentences","replyZh":"Traditional Chinese translation of reply","ttsCandidate":"exact target-language role reply to speak; no grammar tips; no Chinese unless the target language itself is Chinese, which it is not here","naturalness":50-99,"grammarTip":"短繁中文文法/自然度建議，可空字串但不要放進 reply","betterWay":"more natural learner sentence in ${targetLanguage.nativeName}","zhExplain":"短繁中文解釋","encouragement":"短繁中鼓勵"},"state":{"sceneId":"${scene.id}","languageCode":"${targetLanguage.code}","persona":"${persona}","phase":"opening|collecting_info|clarifying|confirming|closing","turnCount":${state.turnCount},"knownInfo":{},"askedQuestions":[],"missingInfo":[],"lastUserIntent":"","lastTutorAction":"","summary":"","readyToClose":false}}`,
  ].filter(Boolean).join("\n");
}

function buildRepairPrompt(raw: string, body: TutorRequest, persona: string, state: TutorConversationState) {
  const targetLanguage = getLearningLanguage(body.scene.targetLanguage || "en");
  return [
    "Repair the previous response into strict JSON only. No markdown, no prose.",
    "The response must include non-empty feedback.reply and a valid state object.",
    "Do not invent a scripted fixed line. Use the learner's latest message and current state.",
    `Target language: ${targetLanguage.nativeName}. Persona: ${persona}.`,
    `Current state JSON: ${stateForPrompt(state)}`,
    `Learner latest message: "${body.userInput}"`,
    `Previous invalid output:\n${raw.slice(0, 3000)}`,
    `Required JSON shape: {"feedback":{"reply":"","replyZh":"","ttsCandidate":"","naturalness":80,"grammarTip":"","betterWay":"","zhExplain":"","encouragement":""},"state":{"sceneId":"${body.scene.id}","languageCode":"${targetLanguage.code}","persona":"${persona}","phase":"collecting_info","turnCount":${state.turnCount},"knownInfo":{},"askedQuestions":[],"missingInfo":[],"lastUserIntent":"","lastTutorAction":"","summary":"","readyToClose":false}}`,
  ].join("\n");
}

function parseAndValidateTutorPayload(
  raw: string,
  scene: Scene,
  persona: string,
  localState: TutorConversationState
): { feedback: TutorFeedback; state: TutorConversationState } {
  let parsed: unknown;
  try {
    parsed = parseJsonFromModel<unknown>(raw);
  } catch (error) {
    throw new GeminiInvalidResponseError(`Gemini JSON parse failed: ${error}`);
  }

  const payload = parsed as GeminiTutorPayload & { feedback?: Partial<TutorFeedback> };
  const feedbackInput = payload.feedback || payload;
  if (!feedbackInput || typeof feedbackInput !== "object") {
    throw new GeminiInvalidResponseError("Gemini response missing feedback object");
  }

  const reply = String(feedbackInput.reply || "").trim();
  if (!reply) throw new GeminiInvalidResponseError("Gemini response missing reply");
  if (!payload.state || typeof payload.state !== "object") {
    throw new GeminiInvalidResponseError("Gemini response missing state");
  }

  const feedback = normalizeTutorFeedback({
    reply,
    replyZh: feedbackInput.replyZh,
    ttsCandidate: feedbackInput.ttsCandidate || reply,
    naturalness: feedbackInput.naturalness,
    grammarTip: feedbackInput.grammarTip || "",
    betterWay: feedbackInput.betterWay || "",
    zhExplain: feedbackInput.zhExplain || "",
    encouragement: feedbackInput.encouragement || "",
  });

  const state = mergeTutorState(scene, persona, localState, payload.state);
  if (!state.phase || !state.sceneId || state.sceneId !== scene.id) {
    throw new GeminiInvalidResponseError("Gemini response state is invalid");
  }

  return { feedback, state };
}

async function generateTutorPayload(
  body: TutorRequest,
  persona: string,
  localState: TutorConversationState
): Promise<{ feedback: TutorFeedback; state: TutorConversationState }> {
  let raw = "";
  try {
    raw = await generateWithGemini({
      prompt: buildPrompt(body, persona, localState),
      temperature: 0.65,
      maxOutputTokens: 900,
      json: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("empty output")) throw new GeminiInvalidResponseError(message);
    throw new GeminiRequestFailedError(message);
  }

  try {
    return parseAndValidateTutorPayload(raw, body.scene, persona, localState);
  } catch (firstError) {
    if (!(firstError instanceof GeminiInvalidResponseError)) throw firstError;

    let repaired = "";
    try {
      repaired = await generateWithGemini({
        prompt: buildRepairPrompt(raw, body, persona, localState),
        temperature: 0.2,
        maxOutputTokens: 900,
        json: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("empty output")) throw new GeminiInvalidResponseError(message);
      throw new GeminiRequestFailedError(message);
    }

    return parseAndValidateTutorPayload(repaired, body.scene, persona, localState);
  }
}

function isValidTutorRequest(body: Partial<TutorRequest>): body is TutorRequest {
  return Boolean(
    body.scene &&
      typeof body.scene === "object" &&
      typeof body.userInput === "string" &&
      body.userInput.trim() &&
      Number.isFinite(Number(body.turn)) &&
      Number(body.turn) > 0
  );
}

export async function POST(req: Request) {
  let body: TutorRequest;
  try {
    body = (await req.json()) as TutorRequest;
  } catch {
    return failure(400, "INVALID_TUTOR_REQUEST", "Invalid JSON", false);
  }

  if (!isValidTutorRequest(body)) {
    return failure(400, "INVALID_TUTOR_REQUEST", "Missing scene, userInput, or turn", false);
  }

  body.userInput = body.userInput.trim();
  body.turn = Number(body.turn);
  body.history = Array.isArray(body.history)
    ? body.history.filter((item): item is string => typeof item === "string").slice(-20)
    : [];

  const persona = getScenePersona(body.scene, body.persona);
  const previousState = normalizeTutorState(
    body.scene,
    persona,
    body.state || createInitialTutorState(body.scene, persona)
  );
  previousState.askedQuestions = uniqueTexts([
    ...previousState.askedQuestions,
    ...deriveAskedQuestionsFromHistory(body.history),
  ]);
  const localState = advanceTutorStateFromUser(
    body.scene,
    persona,
    previousState,
    body.userInput,
    body.turn
  );

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    if (isMockTutorAllowed()) return mockSuccess(body, persona, localState);
    return failure(503, "MISSING_GEMINI_KEY", "Gemini API key is not configured.", true);
  }

  const model = getGeminiModel();
  const cacheKey = buildTutorReplyCacheKey(body, persona, localState);
  const cached = await readCachedTutorReply(cacheKey, body.scene, persona);
  if (cached) {
    return success({ source: "gemini_cache", model, feedback: cached.feedback, state: cached.state });
  }

  try {
    const { feedback, state } = await generateTutorPayload(body, persona, localState);
    await writeCachedTutorReply(cacheKey, body, persona, model, localState, feedback, state);
    return success({ source: "gemini", model, feedback, state });
  } catch (error) {
    if (isMockTutorAllowed()) return mockSuccess(body, persona, localState);

    if (error instanceof GeminiInvalidResponseError) {
      return failure(422, "GEMINI_INVALID_RESPONSE", "Gemini returned an invalid tutor response.", true);
    }
    return failure(502, "GEMINI_REQUEST_FAILED", "Gemini request failed.", true);
  }
}
