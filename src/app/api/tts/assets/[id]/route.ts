import { NextResponse } from "next/server";
import { getTtsAssetStore } from "@/server/tts/store";
import { buildSignedUrl } from "@/server/tts/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const asset = await getTtsAssetStore().getById(id);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: asset.id,
    status: asset.status,
    signedUrl: buildSignedUrl(asset),
    durationMs: asset.durationMs,
    audioFormat: asset.audioFormat,
    assetType: asset.assetType,
    languageCode: asset.languageCode,
  });
}
