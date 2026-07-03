import { NextResponse } from "next/server";
import type { LearningLanguageCode, DictionaryEntry } from "@/types";
import { getCachedEntry, setCachedEntry } from "@/server/dictionary/cache";
import { queryFreeDictionary } from "@/server/dictionary/freeDictionary";
import { queryJMdict } from "@/server/dictionary/jmdict";
import { queryUrimalSaem } from "@/server/dictionary/urimalSaem";
import { queryWiktionary } from "@/server/dictionary/wiktionary";
import { generateJsonWithGemini } from "@/server/gemini";

export const runtime = "nodejs";

interface PublicDictionaryRequest {
  word: string;
  language: LearningLanguageCode;
  sourceLanguage?: "zh" | "en" | "ja" | "ko" | "it" | "es";
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

  const { word, language, sourceLanguage } = body;

  let targetWord = word;
  let usedTranslation = false;

  // If source language is Chinese, translate to target language first
  if (sourceLanguage === "zh" && language !== "zh") {
    try {
      const languageNames: Record<LearningLanguageCode, string> = {
        en: "English",
        ja: "Japanese",
        ko: "Korean",
        it: "Italian",
        es: "Spanish",
        zh: "Chinese",
      };

      const translationPrompt = `Translate the following Chinese word or phrase to ${languageNames[language]}. Return ONLY a JSON object with this exact shape, no explanation: {"translatedWord": "the translated word"}\n\nChinese word: ${word}`;

      const translation = await generateJsonWithGemini<{ translatedWord: string }>({
        prompt: translationPrompt,
        temperature: 0.3,
        maxOutputTokens: 200,
      });

      console.log(`Translation result for "${word}" to ${language}:`, translation);

      if (translation && translation.translatedWord) {
        targetWord = translation.translatedWord.trim();
        usedTranslation = true;
      }
    } catch (error) {
      console.error("Translation error:", error);
      // Fall back to original word if translation fails
    }
  }

  // Check cache first
  const cached = await getCachedEntry(language, targetWord);
  if (cached) {
    return NextResponse.json({ 
      entry: { ...cached, originalQuery: word }, 
      source: "cache",
      translated: usedTranslation 
    });
  }

  // Query appropriate external API based on language
  let entry: DictionaryEntry | null = null;
  let source: string = "local";

  switch (language) {
    case "en":
      entry = await queryFreeDictionary(targetWord);
      source = "free_dictionary";
      break;
    case "ja":
      entry = await queryJMdict(targetWord);
      source = "jmdict";
      break;
    case "ko":
      entry = await queryUrimalSaem(targetWord);
      if (!entry) {
        // Fallback to Wiktionary if Urimal Saem fails
        entry = await queryWiktionary(targetWord, "ko");
        if (!entry) {
          // Try lowercase version
          entry = await queryWiktionary(targetWord.toLowerCase(), "ko");
        }
        source = "wiktionary";
      } else {
        source = "urimal_saem";
      }
      break;
    case "es":
      entry = await queryWiktionary(targetWord, "es");
      if (!entry) {
        // Try lowercase version
        entry = await queryWiktionary(targetWord.toLowerCase(), "es");
      }
      source = "wiktionary";
      break;
    case "it":
      entry = await queryWiktionary(targetWord, "it");
      if (!entry) {
        // Try lowercase version
        entry = await queryWiktionary(targetWord.toLowerCase(), "it");
      }
      source = "wiktionary";
      break;
    case "zh":
      // For Chinese, we can use a simple response since we don't have a Chinese dictionary API yet
      entry = {
        word: targetWord,
        language: "zh",
        definitions: ["Chinese word (no external dictionary API configured)"],
        definitionsZhTw: [targetWord],
        examples: [],
        source: "local",
      };
      source = "local";
      break;
    default:
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  if (!entry) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  // Cache the result
  await setCachedEntry(language, targetWord, entry, source as any);

  return NextResponse.json({ 
    entry: { ...entry, originalQuery: word }, 
    source,
    translated: usedTranslation 
  });
}
