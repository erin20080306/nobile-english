import { NextResponse } from "next/server";
import { scenes } from "@/data/scenes";
import { prewarmScenes } from "@/server/tts/prewarm";
import type { VoiceGender } from "@/server/tts/types";

export const runtime = "nodejs";

interface Body {
  sceneId?: string;
  dryRun?: boolean;
  voiceGender?: VoiceGender;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.sceneId) return NextResponse.json({ error: "Missing sceneId" }, { status: 400 });
  const scene = scenes.find((s) => s.id === body.sceneId);
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  // Default to dry-run; pass dryRun:false explicitly to actually generate.
  const dryRun = body.dryRun !== false;
  const report = await prewarmScenes([scene], { dryRun, voiceGender: body.voiceGender });
  return NextResponse.json(report);
}
