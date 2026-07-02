import { NextResponse } from "next/server";
import type { LearningLanguageCode, DictionaryEntry } from "@/types";
import { getCachedEntry, setCachedEntry } from "@/server/dictionary/cache";
import { queryFreeDictionary } from "@/server/dictionary/freeDictionary";
import { queryJMdict } from "@/server/dictionary/jmdict";
import { queryUrimalSaem } from "@/server/dictionary/urimalSaem";
import { queryWiktionary } from "@/server/dictionary/wiktionary";

export const runtime = "nodejs";

interface PublicDictionaryRequest {
  word: string;
  language: LearningLanguageCode;
}

/**
 * Unified public dictionary API endpoint
 * Routes to appropriate dictionary source based on language
 * Uses cache to reduce external API calls
 */
export async function POST(req: Request) {
  let body: PublicDictionaryRequest;
  try {
    body = (await req.json()) as PublicDictionaryRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.word || !body.language) {
    return NextResponse.json({ error: "Missing word or language" }, { status: 400 });
  }

  const { word, language } = body;

  // Check cache first
  const cached = await getCachedEntry(language, word);
  if (cached) {
    return NextResponse.json({ entry: cached, source: "cache" });
  }

  // Query appropriate external API based on language
  let entry: DictionaryEntry | null = null;
  let source: string = "local";

  switch (language) {
    case "en":
      entry = await queryFreeDictionary(word);
      source = "free_dictionary";
      break;
    case "ja":
      entry = await queryJMdict(word);
      source = "jmdict";
      break;
    case "ko":
      entry = await queryUrimalSaem(word);
      source = "urimal_saem";
      break;
    case "es":
      entry = await queryWiktionary(word, "es");
      source = "wiktionary";
      break;
    case "it":
      entry = await queryWiktionary(word, "it");
      source = "wiktionary";
      break;
    default:
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  if (!entry) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  // Cache the result
  await setCachedEntry(language, word, entry, source as any);

  return NextResponse.json({ entry, source });
}
