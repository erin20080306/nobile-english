import { NextResponse } from "next/server";
import { getOrCreateTtsAsset } from "@/server/tts/service";
import type { AudioFormat, TtsAssetType, VoiceGender } from "@/server/tts/types";

export const runtime = "nodejs";

interface TtsRequest {
  input?: string;
  text?: string;
  languageCode?: string;
  lang?: string;
  voice?: string;
  voiceGender?: VoiceGender;
  voiceProfileId?: string;
  assetType?: TtsAssetType;
  audioFormat?: AudioFormat;
  speed?: number;
}

const ASSET_TYPES = new Set<TtsAssetType>([
  "practice_sentence",
  "tutor_reply",
  "tutor_pass",
  "tutor_minor_correction",
  "tutor_retry",
  "tutor_hint",
  "tutor_complete",
  "word_pronunciation",
  "dynamic_tutor_reply",
  "reading_sentence",
]);

function inferGender(voice?: string): VoiceGender {
  const lower = (voice || "").toLowerCase();
  if (["echo", "onyx", "ash", "cedar"].includes(lower)) return "male";
  return "female";
}

function normalizeLanguageCode(value?: string) {
  const lower = (value || "").toLowerCase();
  if (lower === "ja" || lower.startsWith("ja-")) return "ja-JP";
  if (lower === "ko" || lower.startsWith("ko-")) return "ko-KR";
  if (lower === "it" || lower.startsWith("it-")) return "it-IT";
  if (lower === "es" || lower.startsWith("es-")) return "es-ES";
  if (lower.startsWith("en-gb")) return "en-GB";
  if (lower.startsWith("cmn") || lower.startsWith("zh")) return "cmn-CN";
  return "en-US";
}

function mimeForAudioFormat(format?: AudioFormat) {
  if (format === "wav") return "audio/wav";
  if (format === "m4a") return "audio/mp4";
  return "audio/mpeg";
}

function statusForError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = message.match(/\((\d{3})\)/);
  const providerStatus = statusMatch ? Number(statusMatch[1]) : null;
  if (providerStatus === 429) return 429;
  if (message.includes("Missing GEMINI_API_KEY")) return 503;
  return 503;
}

export async function POST(req: Request) {
  let body: TtsRequest;
  try {
    body = (await req.json()) as TtsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = (body.input || body.text || "").trim();
  if (!input) return NextResponse.json({ error: "Missing input" }, { status: 400 });

  const assetType = body.assetType && ASSET_TYPES.has(body.assetType) ? body.assetType : "practice_sentence";

  try {
    const result = await getOrCreateTtsAsset({
      text: input.slice(0, 3600),
      languageCode: normalizeLanguageCode(body.languageCode || body.lang),
      assetType,
      voiceGender: body.voiceGender || inferGender(body.voice),
      voiceProfileId: body.voiceProfileId,
      audioFormat: body.audioFormat,
    });

    const contentType = mimeForAudioFormat(result.asset.audioFormat);
    if (result.audioBase64) {
      const audio = Buffer.from(result.audioBase64, "base64");
      if (!audio.byteLength) return NextResponse.json({ error: "Gemini TTS returned empty audio blob" }, { status: 502 });
      return new Response(audio, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
        },
      });
    }

    if (!result.signedUrl || result.signedUrl.startsWith("stub://")) {
      return NextResponse.json({ error: "Gemini TTS audio URL unavailable" }, { status: 503 });
    }

    const audioResponse = await fetch(result.signedUrl);
    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: "Gemini TTS cached audio fetch failed", providerStatus: audioResponse.status },
        { status: audioResponse.status === 429 ? 429 : 503 }
      );
    }
    const audio = await audioResponse.arrayBuffer();
    if (!audio.byteLength) return NextResponse.json({ error: "Gemini TTS returned empty audio blob" }, { status: 502 });
    return new Response(audio, {
      headers: {
        "Content-Type": audioResponse.headers.get("Content-Type") || contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Gemini TTS unavailable", message },
      { status: statusForError(error) }
    );
  }
}
