import type { LearningLanguageCode, Word, SavedWord } from "@/types";
import { vocabulary } from "@/data/vocabulary";
import { dictionaryEntries } from "@/data/dictionary";
import { learnerDictionaryEntries } from "@/data/learnerDictionary";
import { multilingualDictionaryEntries } from "@/data/multilingualDictionary";
import { expandedVocabulary } from "@/data/expandedVocabulary";
import { expandedMultilingualDictionaryEntries } from "@/data/expandedMultilingualDictionary";
import { expandedMultilingualPart1a } from "@/data/expandedMultilingualPart1a";
import { expandedMultilingualPart1b } from "@/data/expandedMultilingualPart1b";
import { expandedMultilingualPart1c } from "@/data/expandedMultilingualPart1c";
import { expandedVocabularyPart2a } from "@/data/expandedVocabularyPart2a";
import { expandedVocabularyPart2b } from "@/data/expandedVocabularyPart2b";
import { expandedVocabularyPart2c } from "@/data/expandedVocabularyPart2c";
import { expandedVocabularyPart3a } from "@/data/expandedVocabularyPart3a";
import { expandedVocabularyPart3b } from "@/data/expandedVocabularyPart3b";
import { expandedVocabularyPart3c } from "@/data/expandedVocabularyPart3c";
import { expandedVocabularyPart4a } from "@/data/expandedVocabularyPart4a";
import { expandedVocabularyPart4b } from "@/data/expandedVocabularyPart4b";
import { expandedVocabularyPart4c } from "@/data/expandedVocabularyPart4c";
import { expandedVocabularyPart5a } from "@/data/expandedVocabularyPart5a";
import { expandedVocabularyPart5b } from "@/data/expandedVocabularyPart5b";
import { expandedVocabularyPart5c } from "@/data/expandedVocabularyPart5c";
import { expandedVocabularyPart5d } from "@/data/expandedVocabularyPart5d";
import { expandedVocabularyPart5e } from "@/data/expandedVocabularyPart5e";
import { storageService, KEYS } from "./storageService";

function tupleToWord(t: [string, string, string, string, string, string]): Word {
  return { word: t[0], phonetic: t[1], pos: t[2] as Word["pos"], enDef: t[3], zh: t[4], example: t[5], language: "en" };
}

const allWords: Word[] = (() => {
  const map = new Map<string, Word>();
  [
    ...dictionaryEntries,
    ...learnerDictionaryEntries,
    ...vocabulary,
    ...expandedVocabulary,
    ...expandedVocabularyPart2a,
    ...expandedVocabularyPart2b,
    ...expandedVocabularyPart2c,
    ...expandedVocabularyPart3a,
    ...expandedVocabularyPart3b,
    ...(expandedVocabularyPart3c as any[]).map(tupleToWord),
    ...(expandedVocabularyPart4a as any[]).map(tupleToWord),
    ...(expandedVocabularyPart4b as any[]).map(tupleToWord),
    ...(expandedVocabularyPart4c as any[]).map(tupleToWord),
    ...(expandedVocabularyPart5a as any[]).map(tupleToWord),
    ...(expandedVocabularyPart5b as any[]).map(tupleToWord),
    ...(expandedVocabularyPart5c as any[]).map(tupleToWord),
    ...(expandedVocabularyPart5d as any[]).map(tupleToWord),
    ...(expandedVocabularyPart5e as any[]).map(tupleToWord),
  ].forEach((w: any) => {
    if (!w || !w.word) return;
    const k = (w.word as string).toLowerCase();
    if (!map.has(k)) map.set(k, w as Word);
  });
  return Array.from(map.values());
})();

export const allMultilingualEntries: Word[] = [
  ...multilingualDictionaryEntries,
  ...expandedMultilingualDictionaryEntries,
  ...expandedMultilingualPart1a,
  ...expandedMultilingualPart1b,
  ...expandedMultilingualPart1c,
];

export const vocabularyService = {
  all(language: LearningLanguageCode = "en"): Word[] {
    if (language !== "en") return allMultilingualEntries.filter((w) => w.language === language);
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
    const words = this.all(language);
    if (!Array.isArray(words)) return [];
    return words
      .filter((x) => {
        if (!x || !x.word) return false;
        const candidate = x.word.toLowerCase().normalize("NFC");
        return candidate !== w && candidate.endsWith(suffix);
      })
      .sort((a, b) => a.word.length - b.word.length);
  },

  search(query: string, language: LearningLanguageCode = "en"): Word[] {
    const q = query.trim().toLowerCase();
    const words = this.all(language);
    if (!Array.isArray(words)) return [];
    if (!q) return words.slice(0, 30);
    return words.filter(
      (w) => w && w.word && (w.word.toLowerCase().includes(q) || w.zh.includes(query))
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
