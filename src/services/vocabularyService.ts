import type { LearningLanguageCode, Word, SavedWord } from "@/types";
import { vocabulary } from "@/data/vocabulary";
import { dictionaryEntries } from "@/data/dictionary";
import { learnerDictionaryEntries } from "@/data/learnerDictionary";
import { multilingualDictionaryEntries } from "@/data/multilingualDictionary";
import { storageService, KEYS } from "./storageService";

const allWords: Word[] = (() => {
  const map = new Map<string, Word>();
  [...dictionaryEntries, ...learnerDictionaryEntries, ...vocabulary].forEach((w) => {
    const k = w.word.toLowerCase();
    if (!map.has(k)) map.set(k, w);
  });
  return Array.from(map.values());
})();

export const vocabularyService = {
  all(language: LearningLanguageCode = "en"): Word[] {
    if (language !== "en") return multilingualDictionaryEntries.filter((w) => w.language === language);
    return allWords;
  },

  count(language: LearningLanguageCode = "en"): number {
    return this.all(language).length;
  },

  find(word: string): Word | undefined {
    return allWords.find((w) => w.word.toLowerCase() === word.toLowerCase());
  },

  // Same-ending search. English/Latin languages use letters; Japanese/Korean use final characters.
  sameEnding(input: string, length: number, language: LearningLanguageCode = "en"): Word[] {
    const w = input.trim().toLowerCase().normalize("NFC");
    const chars = Array.from(w);
    if (chars.length < length) return [];
    const suffix = chars.slice(-length).join("");
    return this.all(language)
      .filter((x) => {
        const candidate = x.word.toLowerCase().normalize("NFC");
        return candidate !== w && candidate.endsWith(suffix);
      })
      .sort((a, b) => a.word.length - b.word.length);
  },

  search(query: string, language: LearningLanguageCode = "en"): Word[] {
    const q = query.trim().toLowerCase();
    const words = this.all(language);
    if (!q) return words.slice(0, 30);
    return words.filter(
      (w) => w.word.toLowerCase().includes(q) || w.zh.includes(query)
    );
  },

  // ---- Saved words ----
  getSaved(): SavedWord[] {
    return storageService.get<SavedWord[]>(KEYS.savedWords, []);
  },
  isSaved(word: string): boolean {
    return this.getSaved().some((w) => w.word.toLowerCase() === word.toLowerCase());
  },
  toggleSave(word: Word, source?: string): boolean {
    const saved = this.getSaved();
    const idx = saved.findIndex((w) => w.word.toLowerCase() === word.word.toLowerCase());
    if (idx >= 0) {
      saved.splice(idx, 1);
      storageService.set(KEYS.savedWords, saved);
      return false;
    }
    saved.unshift({ ...word, savedAt: new Date().toISOString(), inReview: false, source });
    storageService.set(KEYS.savedWords, saved);
    return true;
  },
  toggleReview(word: string): void {
    const saved = this.getSaved().map((w) =>
      w.word.toLowerCase() === word.toLowerCase() ? { ...w, inReview: !w.inReview } : w
    );
    storageService.set(KEYS.savedWords, saved);
  },
  addToReview(word: Word, source?: string) {
    const saved = this.getSaved();
    const existing = saved.find((w) => w.word.toLowerCase() === word.word.toLowerCase());
    if (existing) {
      existing.inReview = true;
    } else {
      saved.unshift({ ...word, savedAt: new Date().toISOString(), inReview: true, source });
    }
    storageService.set(KEYS.savedWords, saved);
  },
};
