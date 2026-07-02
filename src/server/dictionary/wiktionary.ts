import type { DictionaryEntry, LearningLanguageCode } from "@/types";

const WIKTIONARY_API_URL = "https://en.wiktionary.org/api/rest_v1/page/definition/";

interface WiktionarySense {
  definition: string;
  parsedExamples?: { example: string; translation?: string }[];
  examples?: string[];
  tags?: string[];
}

interface WiktionaryPartOfSpeech {
  partOfSpeech: string;
  definitions: WiktionarySense[];
}

interface WiktionaryEntry {
  etymology?: string;
  language: string;
  partOfSpeech: string;
  definitions: WiktionarySense[];
}

/**
 * Query Wiktionary API for Spanish, Italian, and Korean words
 * @param word - The word to look up
 * @param language - 'es' for Spanish, 'it' for Italian, 'ko' for Korean
 * @returns DictionaryEntry or null if not found
 */
export async function queryWiktionary(word: string, language: "es" | "it" | "ko"): Promise<DictionaryEntry | null> {
  try {
    const response = await fetch(`${WIKTIONARY_API_URL}${encodeURIComponent(word)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // Word not found
      }
      throw new Error(`Wiktionary API error: ${response.status}`);
    }

    const data: Record<string, WiktionaryEntry[]> = await response.json();
    
    // Get entries for the target language (Wiktionary uses ISO codes: es, it)
    const langCode = language; // "es" or "it"
    const entries = data[langCode] || [];

    if (!entries || entries.length === 0) {
      return null;
    }

    const entry = entries[0];

    // Collect definitions and examples
    const definitions: string[] = [];
    const examples: { text: string; translation?: string }[] = [];
    const posTags: string[] = [];

    posTags.push(entry.partOfSpeech);
    
    for (const sense of entry.definitions) {
      if (sense.definition) {
        definitions.push(sense.definition);
      }
      if (sense.parsedExamples && sense.parsedExamples.length > 0) {
        for (const example of sense.parsedExamples) {
          if (example.example) {
            examples.push({ text: example.example, translation: example.translation });
          }
        }
      } else if (sense.examples && sense.examples.length > 0) {
        for (const example of sense.examples) {
          if (example) {
            examples.push({ text: example });
          }
        }
      }
    }

    // External URLs for official dictionaries
    let externalUrl: string;
    if (language === "es") {
      externalUrl = `https://dle.rae.es/${encodeURIComponent(word)}`;
    } else if (language === "it") {
      externalUrl = `https://www.treccani.it/vocabolario/${encodeURIComponent(word)}/`;
    } else if (language === "ko") {
      externalUrl = `https://krdict.korean.go.kr/dictSearch/details?nationCode=0000&keyword=${encodeURIComponent(word)}`;
    } else {
      externalUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`;
    }

    return {
      word: word,
      language: language as LearningLanguageCode,
      pos: posTags[0] || undefined,
      definitions: definitions.slice(0, 5),
      definitionsZhTw: [], // Wiktionary doesn't provide Chinese, will be filled by AI if needed
      examples: examples.slice(0, 3),
      source: "wiktionary",
      externalUrl: externalUrl,
      sourceAttribution: "Data from Wiktionary (CC BY-SA 3.0)",
    };
  } catch (error) {
    console.error("Error querying Wiktionary API:", error);
    return null;
  }
}
