import { NextRequest, NextResponse } from "next/server";
import { getTtsProviderStatus, TTS_PROVIDER_SETTING_KEY } from "@/server/tts/provider";
import { setAppSetting } from "@/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only toggle for which TTS provider powers the AI tutor voice + reading
// article audio. Google/Polly are considerably cheaper than OpenAI's TTS API,
// which this app only ever uses as a last-resort fallback. Follows the same
// "protected by the admin page's client-side email gate" pattern as the other
// /api/articles/* admin action routes in this codebase.

export async function GET() {
  try {
    const status = await getTtsProviderStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { provider?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const provider = (body.provider || "").toLowerCase();
  if (!["google", "polly", "auto"].includes(provider)) {
    return NextResponse.json({ error: "provider must be google, polly, or auto" }, { status: 400 });
  }

  try {
    // "auto" clears the override (empty string means "no DB override" to getAppSetting callers).
    await setAppSetting(TTS_PROVIDER_SETTING_KEY, provider === "auto" ? "" : provider);
    const status = await getTtsProviderStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
