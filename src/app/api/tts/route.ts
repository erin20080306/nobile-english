import { NextResponse } from "next/server";
import { incrementApiUsage } from "@/server/apiUsage";

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

async function requestSpeech({
  apiKey,
  model,
  voice,
  input,
  instructions,
  speed,
}: {
  apiKey: string;
  model: string;
  voice: string;
  input: string;
  instructions?: string;
  speed?: number;
}) {
  const body: Record<string, unknown> = {
    model,
    voice,
    input: input.slice(0, 3600),
    response_format: "mp3",
    speed: clampSpeed(speed),
  };
  if (instructions && model.includes("gpt-4o")) body.instructions = instructions.slice(0, 600);
  void incrementApiUsage(`tts:openai-${model}`);
  return fetch(OPENAI_SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function readProviderMessage(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return "";
  try {
    const json = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return json.error?.message || json.message || text.slice(0, 500);
  } catch {
    return text.slice(0, 500);
  }
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
  if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 503 });

  const requestedVoice = body.voice || "nova";
  const voice = VOICES.has(requestedVoice) ? requestedVoice : "nova";

  try {
    let response = await requestSpeech({
      apiKey,
      model: MODEL,
      voice,
      input,
      instructions: body.instructions,
      speed: body.speed,
    });
    let providerStatus = response.status;
    let providerMessage = response.ok ? "" : await readProviderMessage(response);
    const firstAttempt = {
      model: MODEL,
      status: providerStatus,
      message: providerMessage,
    };

    if (!response.ok && MODEL !== "tts-1") {
      response = await requestSpeech({
        apiKey,
        model: "tts-1",
        voice,
        input,
        speed: body.speed,
      });
      providerStatus = response.status;
      providerMessage = response.ok ? "" : await readProviderMessage(response);
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "OpenAI TTS request failed",
          model: MODEL,
          fallbackModel: MODEL !== "tts-1" ? "tts-1" : null,
          voice,
          providerStatus,
          providerMessage,
          firstAttempt,
        },
        { status: 502 }
      );
    }

    const audio = await response.arrayBuffer();
    if (!audio.byteLength) {
      return NextResponse.json({ error: "OpenAI TTS returned empty audio blob" }, { status: 502 });
    }
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "TTS service unavailable", message: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
