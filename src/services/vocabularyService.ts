import type { Word, SavedWord } from "@/types";
import { vocabulary } from "@/data/vocabulary";
import { dictionaryEntries } from "@/data/dictionary";
import { learnerDictionaryEntries } from "@/data/learnerDictionary";
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
  all(): Word[] {
    return allWords;
  },

  count(): number {
    return allWords.length;
  },

  find(word: string): Word | undefined {
    return allWords.find((w) => w.word.toLowerCase() === word.toLowerCase());
  },

  // Same-ending search. length = 2..5 letters.
  sameEnding(input: string, length: number): Word[] {
    const w = input.trim().toLowerCase();
    if (w.length < length) return [];
    const suffix = w.slice(-length);
    return allWords
      .filter((x) => x.word.toLowerCase() !== w && x.word.toLowerCase().endsWith(suffix))
      .sort((a, b) => a.word.length - b.word.length);
  },

  search(query: string): Word[] {
    const q = query.trim().toLowerCase();
    if (!q) return allWords.slice(0, 30);
    return allWords.filter(
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
