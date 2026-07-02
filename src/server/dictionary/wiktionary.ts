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
  pos: WiktionaryPartOfSpeech[];
}

/**
 * Query Wiktionary API for Spanish and Italian words
 * @param word - The word to look up
 * @param language - 'es' for Spanish, 'it' for Italian
 * @returns DictionaryEntry or null if not found
 */
export async function queryWiktionary(word: string, language: "es" | "it"): Promise<DictionaryEntry | null> {
  try {
    const response = await fetch(`${WIKTIONARY_API_URL}${encodeURIComponent(word)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // Word not found
      }
      throw new Error(`Wiktionary API error: ${response.status}`);
    }

    const data: Record<string, WiktionaryEntry[]> = await response.json();
    
    // Get entries for the target language
    const langCode = language === "es" ? "Spanish" : "Italian";
    const entries = data[langCode] || [];

    if (!entries || entries.length === 0) {
      return null;
    }

    const entry = entries[0];

    // Collect definitions and examples
    const definitions: string[] = [];
    const examples: { text: string; translation?: string }[] = [];
    const posTags: string[] = [];

    for (const pos of entry.pos) {
      posTags.push(pos.partOfSpeech);
      for (const sense of pos.definitions) {
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
    }

    // External URLs for official dictionaries
    const externalUrl = language === "es" 
      ? `https://dle.rae.es/${encodeURIComponent(word)}`
      : `https://www.treccani.it/vocabolario/${encodeURIComponent(word)}/`;

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
