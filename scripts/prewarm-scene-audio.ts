/*
 * Prewarm fixed scene audio into the site-wide TTS cache.
 *
 * Usage (requires a TS runner, e.g. tsx):
 *   npx tsx scripts/prewarm-scene-audio.ts --scene=<sceneId> [--confirm]
 *   npx tsx scripts/prewarm-scene-audio.ts --all --dry-run
 *   npx tsx scripts/prewarm-scene-audio.ts --all --confirm
 *   npx tsx scripts/prewarm-scene-audio.ts --missing --confirm
 *   optional: --gender=female|male
 *
 * Without --confirm this performs a DRY-RUN: it reports missing audio count,
 * estimated characters and estimated Google TTS cost, and generates nothing.
 * With the offline stub provider, --confirm "generates" placeholder cache rows
 * so the resume/skip-ready behaviour can be exercised without any cost.
 */
import { scenes } from "@/data/scenes";
import { prewarmScenes } from "@/server/tts/prewarm";
import type { VoiceGender } from "@/server/tts/types";

interface Args {
  sceneId?: string;
  all: boolean;
  missing: boolean;
  confirm: boolean;
  gender: VoiceGender;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { all: false, missing: false, confirm: false, gender: "female" };
  for (const raw of argv) {
    if (raw === "--all") args.all = true;
    else if (raw === "--missing") args.missing = true;
    else if (raw === "--confirm") args.confirm = true;
    else if (raw === "--dry-run") args.confirm = false;
    else if (raw.startsWith("--scene=")) args.sceneId = raw.slice("--scene=".length);
    else if (raw.startsWith("--gender=")) {
      const g = raw.slice("--gender=".length);
      if (g === "female" || g === "male" || g === "neutral") args.gender = g;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let selected = scenes;
  if (args.sceneId) {
    selected = scenes.filter((s) => s.id === args.sceneId);
    if (selected.length === 0) {
      console.error(`Scene not found: ${args.sceneId}`);
      process.exit(1);
    }
  } else if (!args.all && !args.missing) {
    console.error("Specify --scene=<id>, --all, or --missing.");
    process.exit(1);
  }

  const dryRun = !args.confirm;
  console.log(`\nPrewarm ${selected.length} scene(s) | mode: ${dryRun ? "DRY-RUN" : "CONFIRM"} | voice: ${args.gender}\n`);

  const report = await prewarmScenes(selected, { dryRun, voiceGender: args.gender });

  console.log("  total texts      :", report.totalTexts);
  console.log("  already cached   :", report.alreadyCached);
  console.log("  cache misses     :", report.missing);
  console.log("  estimated chars  :", report.estimatedChars);
  console.log("  estimated cost   : $" + report.estimatedUsd.toFixed(4));
  if (!dryRun) {
    console.log("  generated        :", report.generated);
    console.log("  failed           :", report.failed);
  }
  console.log("");
}

main().catch((err) => {
  console.error("prewarm failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
