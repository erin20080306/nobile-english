import { NextResponse } from "next/server";
import { scenes } from "@/data/scenes";
import { prewarmScenes } from "@/server/tts/prewarm";
import type { VoiceGender } from "@/server/tts/types";

export const runtime = "nodejs";

interface Body {
  // dry-run unless confirm === true. Mirrors the CLI --dry-run / --confirm flags.
  confirm?: boolean;
  voiceGender?: VoiceGender;
}

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // Empty body is allowed -> defaults to dry-run.
  }

  const dryRun = body.confirm !== true;
  const report = await prewarmScenes(scenes, { dryRun, voiceGender: body.voiceGender });
  return NextResponse.json(report);
}
