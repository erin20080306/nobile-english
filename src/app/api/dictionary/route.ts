import { NextResponse } from "next/server";
import type { LearningLanguageCode, Word } from "@/types";
import { getLearningLanguage } from "@/data/learningLanguages";

export const runtime = "nodejs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_DICTIONARY_MODEL || process.env.OPENAI_TUTOR_MODEL || "gpt-5.4-nano";
const GEMINI_MODEL = process.env.GEMINI_DICTIONARY_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

interface DictionaryAiRequest {
  word: string;
  language: LearningLanguageCode;
  sentence?: string;
  localEntry?: Word | null;
  fromFallback?: boolean;
}

type DictionaryAiResponse = Word & {
  confidence?: number;
};

function safeJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced || trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  return JSON.parse(raw);
}

function sanitizeWord(input: Partial<DictionaryAiResponse>, body: DictionaryAiRequest): Word {
  const local = body.localEntry;
  const language = body.language;
  const pos = ["n.", "v.", "adj.", "adv.", "prep.", "conj.", "interj.", "pron."].includes(String(input.pos))
    ? input.pos as Word["pos"]
    : local?.pos || "n.";
  return {
    language,
    word: String(input.word || local?.word || body.word).trim(),
    phonetic: String(input.phonetic || local?.phonetic || "/-/").trim(),
    pos,
    enDef: String(input.enDef || local?.enDef || "Context-aware dictionary explanation.").trim(),
    zh: String(input.zh || local?.zh || "請搭配原句理解意思與用法。").trim(),
    example: String(input.example || local?.example || body.sentence || body.word).trim(),
    exampleZh: input.exampleZh ? String(input.exampleZh).trim() : local?.exampleZh,
    synonyms: Array.isArray(input.synonyms) ? input.synonyms.map(String).slice(0, 5) : local?.synonyms,
    antonyms: Array.isArray(input.antonyms) ? input.antonyms.map(String).slice(0, 5) : local?.antonyms,
    related: Array.isArray(input.related) ? input.related.map(String).slice(0, 6) : local?.related,
  };
}

function buildPrompt(body: DictionaryAiRequest) {
  const lang = getLearningLanguage(body.language);
  const sentence = body.sentence?.trim() || "";
  const local = body.localEntry
    ? `Local rough entry: ${JSON.stringify({
        word: body.localEntry.word,
        pos: body.localEntry.pos,
        zh: body.localEntry.zh,
        enDef: body.localEntry.enDef,
      })}`
    : "No reliable local entry.";
  return [
    "You are a professional multilingual dictionary editor for a language learning app.",
    `Target language: ${lang.zhName} / ${lang.nativeName} (${body.language}).`,
    `Learner UI language: Traditional Chinese.`,
    `Lookup word or phrase: ${body.word}`,
    sentence ? `Full sentence context: ${sentence}` : "",
    local,
    "Explain the meaning in this sentence context first. If the word has several meanings, choose the most likely one from context.",
    "For Japanese and Korean, explain conjugation or polite ending when relevant. For Italian and Spanish, explain inflection, gender/number, or verb form when relevant. For English, explain tense, part of speech, and common collocation when useful.",
    "Return ONLY valid JSON with this exact shape:",
    JSON.stringify({
      word: "surface form or dictionary form when clearer",
      phonetic: "pronunciation, romanization, or /-/",
      pos: "n.|v.|adj.|adv.|prep.|conj.|interj.|pron.",
      enDef: "short definition in the target language or English, context-aware",
      zh: "完整繁體中文解釋，包含此句意思與用法",
      example: "natural short example in target language",
      exampleZh: "example translation in Traditional Chinese",
      related: ["related useful words"],
      synonyms: ["optional synonyms"],
      antonyms: ["optional antonyms"],
      confidence: 0.9,
    }),
  ].filter(Boolean).join("\n");
}

async function askOpenAi(body: DictionaryAiRequest): Promise<Word | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: buildPrompt(body),
      temperature: 0.2,
      max_output_tokens: 520,
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const outputText =
    data.output_text ||
    data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
      .map((content: { text?: string }) => content.text || "")
      .join("") ||
    "";
  if (!outputText) return null;
  return sanitizeWord(safeJson(outputText), body);
}

async function askGemini(body: DictionaryAiRequest): Promise<Word | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(body) }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 520,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const outputText = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
  if (!outputText) return null;
  return sanitizeWord(safeJson(outputText), body);
}

export async function POST(req: Request) {
  let body: DictionaryAiRequest;
  try {
    body = (await req.json()) as DictionaryAiRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.word || !body.language) {
    return NextResponse.json({ error: "Missing word or language" }, { status: 400 });
  }

  try {
    const gemini = await askGemini(body);
    if (gemini) return NextResponse.json({ source: "gemini", model: GEMINI_MODEL, entry: gemini });

    const openai = await askOpenAi(body);
    if (openai) return NextResponse.json({ source: "openai", model: OPENAI_MODEL, entry: openai });
  } catch {
    // Keep the app usable with the local dictionary when provider calls fail.
  }

  return NextResponse.json({ source: "local", entry: body.localEntry || null });
}
