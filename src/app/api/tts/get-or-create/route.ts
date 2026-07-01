import { NextResponse } from "next/server";
import { getCachedTtsAsset, getOrCreateTtsAsset } from "@/server/tts/service";
import type { GetOrCreateInput, TtsAssetType } from "@/server/tts/types";

export const runtime = "nodejs";

type TtsRequestBody = Partial<GetOrCreateInput> & {
  cacheOnly?: boolean;
};

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

export async function POST(req: Request) {
  let body: TtsRequestBody;
  try {
    body = (await req.json()) as TtsRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });
  if (!body.languageCode) return NextResponse.json({ error: "Missing languageCode" }, { status: 400 });
  if (!body.assetType || !ASSET_TYPES.has(body.assetType)) {
    return NextResponse.json({ error: "Invalid assetType" }, { status: 400 });
  }

  try {
    if (body.cacheOnly) {
      const cached = await getCachedTtsAsset({
        text,
        textPart2: body.textPart2,
        languageCode: body.languageCode,
        assetType: body.assetType,
        voiceGender: body.voiceGender,
        voiceProfileId: body.voiceProfileId,
        audioFormat: body.audioFormat,
        audioVersionString: body.audioVersionString,
        sceneId: body.sceneId,
        sceneVersion: body.sceneVersion,
      });

      if (!cached) {
        return NextResponse.json(
          { error: "TTS cache miss", cached: false, cacheOnly: true },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: cached.asset.id,
        status: cached.asset.status,
        cached: true,
        cacheOnly: true,
        signedUrl: cached.signedUrl,
        durationMs: cached.asset.durationMs,
        audioFormat: cached.asset.audioFormat,
      });
    }

    const result = await getOrCreateTtsAsset({
      text,
      textPart2: body.textPart2,
      languageCode: body.languageCode,
      assetType: body.assetType,
      voiceGender: body.voiceGender,
      voiceProfileId: body.voiceProfileId,
      audioFormat: body.audioFormat,
      audioVersionString: body.audioVersionString,
      sceneId: body.sceneId,
      sceneVersion: body.sceneVersion,
    });
    return NextResponse.json({
      id: result.asset.id,
      status: result.asset.status,
      cached: result.cached,
      signedUrl: result.signedUrl,
      durationMs: result.asset.durationMs,
      audioFormat: result.asset.audioFormat,
    });
  } catch (error) {
    // Never leak provider/key details to the client.
    return NextResponse.json(
      {
        error: "TTS unavailable",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 503 }
    );
  }
}
