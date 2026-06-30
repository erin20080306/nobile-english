#!/usr/bin/env node
/**
 * Seed the database vocabulary targets used by the word-review page.
 *
 * This script downloads open dictionary sources and imports a capped number of
 * rows into Supabase. It does not call OpenAI, Gemini, TTS, or any paid AI API.
 */

import { spawnSync } from "child_process";

type LanguageCode = "en" | "ja" | "ko" | "it" | "es";

interface ReviewTarget {
  language: LanguageCode;
  source: string;
  targetCount: number;
  label: string;
}

const REVIEW_TARGETS: ReviewTarget[] = [
  { language: "en", source: "wiktextract-en", targetCount: 16000, label: "English current 8,000 + 8,000 more" },
  { language: "it", source: "wiktextract-it", targetCount: 10000, label: "Italian 10,000" },
  { language: "es", source: "wiktextract-es", targetCount: 10000, label: "Spanish 10,000" },
  { language: "ja", source: "jmdict", targetCount: 10000, label: "Japanese 10,000" },
  { language: "ko", source: "wiktextract-ko", targetCount: 10000, label: "Korean 10,000" },
];

function readFlag(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  return "";
}

function run(label: string, args: string[]) {
  console.log(`\n=== ${label} ===`);
  console.log(`npx ${args.join(" ")}`);
  const result = spawnSync("npx", args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    throw new Error(`${label} failed.`);
  }
}

function selectedTargets() {
  const languageFilter = readFlag("--language");
  if (!languageFilter) return REVIEW_TARGETS;
  const requested = new Set(languageFilter.split(",").map((item) => item.trim()).filter(Boolean));
  return REVIEW_TARGETS.filter((target) => requested.has(target.language));
}

function main() {
  const confirm = process.argv.includes("--confirm");
  const skipDownload = process.argv.includes("--skip-download");
  const reportJson = process.argv.includes("--report-json");
  const batchSize = readFlag("--batch-size") || "500";
  const targets = selectedTargets();

  if (targets.length === 0) {
    console.log("No matching language targets. Use --language=en,it,es,ja,ko or omit it.");
    return;
  }

  if (!confirm) {
    console.log("Dry-run mode. Add --confirm to write to Supabase.");
  }

  console.log("Review vocabulary targets:");
  for (const target of targets) {
    console.log(`- ${target.label}: ${target.source}, limit ${target.targetCount.toLocaleString()}`);
  }

  for (const target of targets) {
    if (!skipDownload) {
      run(`Download ${target.label}`, [
        "tsx",
        "scripts/dictionary-download.ts",
        `--language=${target.language}`,
        `--source=${target.source}`,
        ...(confirm ? [] : ["--dry-run"]),
      ]);
    }

    if (!confirm) {
      console.log(`Skipping Supabase import for ${target.label}; add --confirm after env vars are configured.`);
      continue;
    }

    run(`${confirm ? "Import" : "Dry-run import"} ${target.label}`, [
      "tsx",
      "scripts/dictionary-import.ts",
      `--language=${target.language}`,
      `--source=${target.source}`,
      `--limit=${target.targetCount}`,
      `--batch-size=${batchSize}`,
      "--retry=2",
      "--resume",
      ...(reportJson ? ["--report-json"] : []),
      "--confirm",
    ]);
  }
}

main();
