import { createClient } from "@supabase/supabase-js";
import type { DictionaryEntry, LearningLanguageCode } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface JMdictSense {
  glosses: { lang: string; text: string }[];
  pos?: string[];
  field?: string[];
  misc?: string[];
}

interface JMdictEntry {
  id: string;
  entry_seq: number;
  kanji_elements: string[];
  reading_elements: string[];
  pos_tags: string[];
  senses_json: JMdictSense[];
  priority: number;
}

/**
 * Query JMdict database for Japanese words
 * @param word - The word to look up (kanji or kana)
 * @returns DictionaryEntry or null if not found
 */
export async function queryJMdict(word: string): Promise<DictionaryEntry | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Search for exact match in kanji or reading elements
    const { data: entries, error } = await supabase
      .from("jmdict_entries")
      .select("*")
      .or(`kanji_elements.cs.{${word}},reading_elements.cs.{${word}}`)
      .order("priority", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error querying JMdict:", error);
      return null;
    }

    if (!entries || entries.length === 0) {
      return null;
    }

    const entry = entries[0] as JMdictEntry;

    // Get primary kanji and reading
    const kanji = entry.kanji_elements[0] || entry.reading_elements[0];
    const reading = entry.reading_elements[0] || "";

    // Get English glosses and Chinese glosses
    const englishGlosses: string[] = [];
    const chineseGlosses: string[] = [];
    const examples: { text: string; translation?: string }[] = [];

    for (const sense of entry.senses_json) {
      for (const gloss of sense.glosses) {
        if (gloss.lang === "eng" && gloss.text) {
          englishGlosses.push(gloss.text);
        } else if ((gloss.lang === "chi" || gloss.lang === "zho") && gloss.text) {
          chineseGlosses.push(gloss.text);
        }
      }
    }

    // Get part of speech
    const pos = entry.pos_tags[0] || undefined;

    // Convert to DictionaryEntry format
    return {
      word: kanji,
      language: "ja" as LearningLanguageCode,
      phonetic: reading, // Use kana as phonetic/reading
      pos: pos,
      definitions: englishGlosses.slice(0, 5),
      definitionsZhTw: chineseGlosses.slice(0, 5),
      examples: examples.slice(0, 2),
      source: "jmdict",
      sourceAttribution: "Data from JMdict/EDICT (CC BY-SA 4.0, Electronic Dictionary Research and Development Group)",
    };
  } catch (error) {
    console.error("Error querying JMdict:", error);
    return null;
  }
}
