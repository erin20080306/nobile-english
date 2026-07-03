import type { DictionaryEntry, LearningLanguageCode } from "@/types";
import { incrementApiUsage } from "@/server/apiUsage";

const FREE_DICTIONARY_API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";

interface FreeDictionaryPhonetic {
  text?: string;
  audio?: string;
}

interface FreeDictionaryMeaning {
  partOfSpeech: string;
  definitions: Array<{
    definition: string;
    example?: string;
    synonyms?: string[];
    antonyms?: string[];
  }>;
}

interface FreeDictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: FreeDictionaryPhonetic[];
  meanings: FreeDictionaryMeaning[];
}

/**
 * Query Free Dictionary API for English words
 * @param word - The word to look up
 * @returns DictionaryEntry or null if not found
 */
export async function queryFreeDictionary(word: string): Promise<DictionaryEntry | null> {
  try {
    void incrementApiUsage("dictionary:free-dictionary");
    const response = await fetch(`${FREE_DICTIONARY_API_URL}${encodeURIComponent(word)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // Word not found
      }
      throw new Error(`Free Dictionary API error: ${response.status}`);
    }

    const data: FreeDictionaryEntry[] = await response.json();
    
    if (!data || data.length === 0) {
      return null;
    }

    const entry = data[0];
    
    // Get phonetic (prefer text, fallback to audio URL for display)
    const phonetic = entry.phonetic || 
                     entry.phonetics.find(p => p.text)?.text || 
                     entry.phonetics.find(p => p.audio)?.audio;
    
    // Get audio URL (prefer US audio)
    const audioUrl = entry.phonetics.find(p => p.audio && p.audio.includes("us"))?.audio ||
                     entry.phonetics.find(p => p.audio)?.audio;

    // Collect all definitions and examples
    const definitions: string[] = [];
    const examples: { text: string; translation?: string }[] = [];
    const synonyms: string[] = [];
    const antonyms: string[] = [];

    for (const meaning of entry.meanings) {
      for (const def of meaning.definitions) {
        if (def.definition) {
          definitions.push(`${meaning.partOfSpeech} ${def.definition}`);
        }
        if (def.example) {
          examples.push({ text: def.example });
        }
        if (def.synonyms && def.synonyms.length > 0) {
          synonyms.push(...def.synonyms);
        }
        if (def.antonyms && def.antonyms.length > 0) {
          antonyms.push(...def.antonyms);
        }
      }
    }

    // Remove duplicates and limit
    const uniqueSynonyms = Array.from(new Set(synonyms)).slice(0, 10);
    const uniqueAntonyms = Array.from(new Set(antonyms)).slice(0, 10);

    return {
      word: entry.word,
      language: "en" as LearningLanguageCode,
      phonetic: phonetic || undefined,
      pos: entry.meanings[0]?.partOfSpeech || undefined,
      definitions: definitions.slice(0, 5),
      definitionsZhTw: [], // Free Dictionary doesn't provide Chinese, will be filled by AI if needed
      examples: examples.slice(0, 3),
      synonyms: uniqueSynonyms.length > 0 ? uniqueSynonyms : undefined,
      antonyms: uniqueAntonyms.length > 0 ? uniqueAntonyms : undefined,
      audioUrl: audioUrl || undefined,
      source: "free_dictionary",
      sourceAttribution: "Data from Free Dictionary API (https://dictionaryapi.dev/)",
    };
  } catch (error) {
    console.error("Error querying Free Dictionary API:", error);
    return null;
  }
}
