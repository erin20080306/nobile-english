import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";
const MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

interface TtsRequest {
  input?: string;
  voice?: string;
  instructions?: string;
  speed?: number;
}

function clampSpeed(speed?: number) {
  if (!Number.isFinite(speed)) return 1;
  return Math.max(0.75, Math.min(1.25, Number(speed)));
}

export async function POST(req: Request) {
  let body: TtsRequest;
  try {
    body = (await req.json()) as TtsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = body.input?.trim();
  if (!input) return NextResponse.json({ error: "Missing input" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "TTS key unavailable" }, { status: 503 });

  const requestedVoice = body.voice || "nova";
  const voice = VOICES.has(requestedVoice) ? requestedVoice : "nova";

  try {
    const response = await fetch(OPENAI_SPEECH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        voice,
        input: input.slice(0, 3600),
        instructions: body.instructions?.slice(0, 600),
        response_format: "mp3",
        speed: clampSpeed(body.speed),
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "TTS request failed" }, { status: 502 });
    }

    const audio = await response.arrayBuffer();
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "TTS service unavailable" }, { status: 502 });
  }
}
