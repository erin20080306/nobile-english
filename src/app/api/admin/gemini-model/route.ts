import { NextRequest, NextResponse } from "next/server";
import {
  GEMINI_MODEL_SETTING_KEY,
  SUPPORTED_GEMINI_MODELS,
  getGeminiFallbackModel,
  getGeminiModel,
  resolveActiveGeminiModel,
} from "@/server/gemini";
import { getAppSetting, setAppSetting } from "@/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only toggle for which Gemini model powers AI tutor replies, daily
// article generation, and dictionary AI lookups. Lets an admin switch away
// from the primary model (e.g. when it is over quota) without a redeploy.
// Follows the same "protected by the admin page's client-side email gate"
// pattern as /api/admin/tts-provider.

async function buildStatus() {
  const override = await getAppSetting(GEMINI_MODEL_SETTING_KEY);
  return {
    active: await resolveActiveGeminiModel(),
    defaultModel: getGeminiModel(),
    fallbackModel: getGeminiFallbackModel(),
    override: override || null,
    supportedModels: SUPPORTED_GEMINI_MODELS,
  };
}

export async function GET() {
  try {
    return NextResponse.json(await buildStatus());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = (body.model || "").trim();
  const isAuto = model === "" || model === "auto";
  if (!isAuto && !SUPPORTED_GEMINI_MODELS.includes(model as (typeof SUPPORTED_GEMINI_MODELS)[number])) {
    return NextResponse.json(
      { error: `model must be one of: auto, ${SUPPORTED_GEMINI_MODELS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // "auto" clears the override (empty string means "no DB override" to getAppSetting callers).
    await setAppSetting(GEMINI_MODEL_SETTING_KEY, isAuto ? "" : model);
    return NextResponse.json(await buildStatus());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
