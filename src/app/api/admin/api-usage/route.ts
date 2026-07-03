import { NextResponse } from "next/server";
import { getApiUsageSummary } from "@/server/apiUsage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only view of external API call volume (Gemini models, TTS
// providers, etc.) over the last 30 days, so an admin can see call volume
// trending up before hitting a paid quota and proactively switch models.

export async function GET() {
  try {
    const usage = await getApiUsageSummary();
    return NextResponse.json({ usage });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
