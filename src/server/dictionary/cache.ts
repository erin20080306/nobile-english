import { createClient } from "@supabase/supabase-js";
import type { DictionaryEntry, DictionaryCacheEntry, LearningLanguageCode } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cache duration: 30 days
const CACHE_DURATION_DAYS = 30;

/**
 * Normalize word for cache key (lowercase, trim)
 */
function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

/**
 * Get cache entry for a word
 */
export async function getCachedEntry(
  language: LearningLanguageCode,
  word: string
): Promise<DictionaryEntry | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const normalized = normalizeWord(word);

    const { data, error } = await supabase
      .from("dictionary_cache")
      .select("entry_json, expires_at")
      .eq("language", language)
      .eq("normalized_word", normalized)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      console.error("Error getting cache entry:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Check if cache is expired
    if (new Date(data.expires_at) < new Date()) {
      // Delete expired entry
      await supabase
        .from("dictionary_cache")
        .delete()
        .eq("language", language)
        .eq("normalized_word", normalized);
      return null;
    }

    return data.entry_json as DictionaryEntry;
  } catch (error) {
    console.error("Error getting cache entry:", error);
    return null;
  }
}

/**
 * Set cache entry for a word
 */
export async function setCachedEntry(
  language: LearningLanguageCode,
  word: string,
  entry: DictionaryEntry,
  source: DictionaryCacheEntry["source"]
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const normalized = normalizeWord(word);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_DURATION_DAYS);

    const { error } = await supabase
      .from("dictionary_cache")
      .upsert({
        language,
        normalized_word: normalized,
        entry_json: entry,
        source,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Error setting cache entry:", error);
    }
  } catch (error) {
    console.error("Error setting cache entry:", error);
  }
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase.rpc("cleanup_expired_dictionary_cache");

    if (error) {
      console.error("Error cleaning up expired cache:", error);
    }
  } catch (error) {
    console.error("Error cleaning up expired cache:", error);
  }
}
