import { NextResponse } from "next/server";
import type { Scene, TutorFeedback } from "@/types";
import { mockAiTutorService } from "@/services/mockAiTutorService";

export const runtime = "nodejs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_TUTOR_MODEL || "gpt-4o-mini";

interface TutorRequest {
  scene: Scene;
  userInput: string;
  turn: number;
  history?: string[];
}

function fallback(body: TutorRequest, status = 200) {
  return NextResponse.json({
    source: "local",
    feedback: mockAiTutorService.feedback(body.scene, body.userInput, body.turn, body.history || []),
  }, { status });
}

function safeJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced || trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  return JSON.parse(raw);
}

function buildPrompt({ scene, userInput, turn, history = [] }: TutorRequest) {
  const sceneLines = scene.dialogue
    .map((line) => `${line.speaker}: ${line.en} / ${line.zh}`)
    .join("\n");
  const recent = history.slice(-8).join(" | ");

  return [
    "You are a warm, realistic English speaking tutor in a mobile app for Traditional Chinese learners.",
    "Continue the roleplay like a real person, not like a generic teacher.",
    "The learner can answer in imperfect English. Understand the meaning first, then continue naturally.",
    "Keep the roleplay moving toward the scenario. Do not over-explain inside the tutor reply.",
    "Each scene ends at 7 learner turns. This request is one turn inside that limit.",
    "Return ONLY valid JSON with these exact keys:",
    '{ "reply": string, "replyZh": string, "naturalness": number, "grammarTip": string, "betterWay": string, "zhExplain": string, "encouragement": string }',
    "Rules:",
    "- reply: one natural English tutor line, 6-18 words, continuing the scenario based on the learner answer.",
    "- replyZh: Traditional Chinese translation of reply.",
    "- betterWay: a more native version of the learner's sentence, not a random sentence.",
    "- grammarTip and zhExplain: Traditional Chinese, short and useful.",
    "- naturalness: 45-99.",
    "- encouragement: Traditional Chinese with a little English, short.",
    "",
    `Scene: ${scene.name} (${scene.enName}), theme=${scene.themeId}`,
    `Goals: ${scene.goals.join(", ")}`,
    `Key patterns: ${scene.keyPatterns.map((p) => p.en).join(" | ")}`,
    "Script reference, use it for realism but adapt to the learner:",
    sceneLines,
    "",
    `Previous learner answers: ${recent || "none"}`,
    `Current turn: ${turn}/7`,
    `Learner answer: ${userInput}`,
  ].join("\n");
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback(body);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: buildPrompt(body),
        temperature: 0.8,
        max_output_tokens: 420,
      }),
    });

    if (!response.ok) return fallback(body, 200);

    const data = await response.json();
    const outputText =
      data.output_text ||
      data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
        .map((content: { text?: string }) => content.text || "")
        .join("") ||
      "";
    const parsed = safeJson(outputText);
    const local = mockAiTutorService.feedback(body.scene, body.userInput, body.turn, body.history || []);
    const feedback: TutorFeedback = {
      reply: String(parsed.reply || local.reply),
      replyZh: String(parsed.replyZh || local.replyZh),
      naturalness: Math.max(45, Math.min(99, Number(parsed.naturalness || local.naturalness))),
      grammarTip: String(parsed.grammarTip || local.grammarTip),
      betterWay: String(parsed.betterWay || local.betterWay),
      zhExplain: String(parsed.zhExplain || local.zhExplain),
      encouragement: String(parsed.encouragement || local.encouragement),
    };
    return NextResponse.json({ source: "openai", model: MODEL, feedback });
  } catch {
    return fallback(body);
  }
}
