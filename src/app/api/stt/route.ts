import { NextResponse } from "next/server";
import { getGoogleAccessToken, hasGoogleServiceAccount } from "@/server/google/auth";

export const runtime = "nodejs";

const GOOGLE_STT_URL = "https://speech.googleapis.com/v1/speech:recognize";
// Google Cloud Speech-to-Text supports up to 3 alternative language codes
// per request (1 primary + up to 3 alternatives). We only ever need at most
// 2 total (target language + Traditional Chinese) for the "free chat" mode.
const MAX_ALTERNATIVE_LANGUAGES = 3;

function pickEncoding(mimeType: string): string {
  if (mimeType.includes("webm")) return "WEBM_OPUS";
  if (mimeType.includes("ogg")) return "OGG_OPUS";
  if (mimeType.includes("wav")) return "LINEAR16";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "MP3"; // best-effort fallback
  return "WEBM_OPUS";
}

export async function POST(req: Request) {
  // Note: we intentionally do NOT use GOOGLE_TTS_API_KEY here even if set.
  // That key is provisioned (and often API-restricted in Google Cloud
  // Console) for Text-to-Speech only, so calling Speech-to-Text with it
  // fails with "Requests to this API ... are blocked." Speech-to-Text
  // always goes through the service account's OAuth token instead.
  if (!hasGoogleServiceAccount()) {
    return NextResponse.json({ error: "Missing GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON" }, { status: 503 });
  }

  let audioBlob: Blob | null = null;
  let languageCode = "en-US";
  let alternativeLanguageCodes: string[] = [];
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (file instanceof Blob) audioBlob = file;
    const lang = form.get("languageCode");
    if (typeof lang === "string" && lang.trim()) languageCode = lang.trim();
    const alt = form.get("alternativeLanguageCodes");
    if (typeof alt === "string" && alt.trim()) {
      alternativeLanguageCodes = alt
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && s !== languageCode)
        .slice(0, MAX_ALTERNATIVE_LANGUAGES);
    }
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  if (!audioBlob || !audioBlob.size) {
    return NextResponse.json({ error: "Missing audio" }, { status: 400 });
  }

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContent = Buffer.from(arrayBuffer).toString("base64");
    const encoding = pickEncoding(audioBlob.type || "audio/webm");

    const config: Record<string, unknown> = {
      encoding,
      languageCode,
      enableAutomaticPunctuation: true,
      model: "latest_short",
    };
    if (alternativeLanguageCodes.length > 0) {
      config.alternativeLanguageCodes = alternativeLanguageCodes;
    }

    const token = await getGoogleAccessToken();
    const response = await fetch(GOOGLE_STT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ config, audio: { content: audioContent } }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      results?: { alternatives?: { transcript?: string; confidence?: number }[]; languageCode?: string }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: "Google STT request failed", message: data.error?.message },
        { status: 502 }
      );
    }

    const text = (data.results || [])
      .map((r) => r.alternatives?.[0]?.transcript || "")
      .join(" ")
      .trim();
    const detectedLanguageCode = data.results?.[0]?.languageCode;

    return NextResponse.json({ text, languageCode: detectedLanguageCode || languageCode });
  } catch (error) {
    return NextResponse.json(
      { error: "STT service unavailable", message: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
