import type { DictionaryEntry, LearningLanguageCode } from "@/types";
import { incrementApiUsage } from "@/server/apiUsage";

const URIMAL_SAEM_API_URL = "https://opendict.korean.go.kr/api/search";
const API_KEY = process.env.KOREAN_DICTIONARY_API_KEY;

interface UrimalSaemSense {
  definition: string;
  pos?: string;
  example?: string;
}

interface UrimalSaemEntry {
  word: string;
  original_word: string;
  pronunciation?: string;
  hanja?: string;
  pos?: string;
  senses: UrimalSaemSense[];
}

/**
 * Query Urimal Saem (우리말샘) Open API for Korean words
 * @param word - The word to look up
 * @returns DictionaryEntry or null if not found
 */
export async function queryUrimalSaem(word: string): Promise<DictionaryEntry | null> {
  if (!API_KEY) {
    console.warn("KOREAN_DICTIONARY_API_KEY not set, Urimal Saem API unavailable");
    return null;
  }

  try {
    const url = new URL(URIMAL_SAEM_API_URL);
    url.searchParams.append("key", API_KEY);
    url.searchParams.append("q", word);
    url.searchParams.append("type_search", "search");
    url.searchParams.append("req_type", "json");
    url.searchParams.append("method", "WORD_INFO");

    void incrementApiUsage("dictionary:urimal-saem");
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Urimal Saem API error: ${response.status}`);
    }

    const data = await response.json();

    // Urimal Saem API response structure may vary, adjust as needed
    const items = data.channel?.item || data.item || [];

    if (!items || items.length === 0) {
      return null;
    }

    const item = Array.isArray(items) ? items[0] : items;

    // Extract information
    const koreanWord = item.word || item.target_code || word;
    const pronunciation = item.pronunciation || item.sound || undefined;
    const hanja = item.hanja || item.origin || undefined;
    const pos = item.pos || item.part_of_speech || undefined;

    // Extract definitions and examples
    const definitions: string[] = [];
    const definitionsZhTw: string[] = [];
    const examples: { text: string; translation?: string }[] = [];

    // Handle different response structures
    const senses = item.sense_info || item.senses || item.definition ? 
      (Array.isArray(item.sense_info) ? item.sense_info : 
       Array.isArray(item.senses) ? item.senses :
       [{ definition: item.definition }]) : [];

    for (const sense of senses) {
      const def = sense.definition || sense.meaning;
      if (def) {
        definitions.push(def);
      }
      
      const example = sense.example || sense.sentence;
      if (example) {
        examples.push({ text: example });
      }
    }

    // Note: Urimal Saem doesn't provide Chinese translations directly
    // These would need to be added via AI translation if needed

    return {
      word: koreanWord,
      language: "ko" as LearningLanguageCode,
      phonetic: pronunciation || hanja,
      pos: pos,
      definitions: definitions.slice(0, 5),
      definitionsZhTw: [], // Korean API doesn't provide Chinese, will be filled by AI if needed
      examples: examples.slice(0, 3),
      source: "urimal_saem",
      sourceAttribution: "Data from National Institute of Korean Language Urimal Saem Open API",
    };
  } catch (error) {
    console.error("Error querying Urimal Saem API:", error);
    return null;
  }
}
