import type { LearningLanguageCode, Word, SavedSentence } from "@/types";
import { dictionaryEntries } from "@/data/dictionary";
import { learnerDictionaryEntries } from "@/data/learnerDictionary";
import { multilingualDictionaryEntries } from "@/data/multilingualDictionary";
import { getLearningLanguage } from "@/data/learningLanguages";
import { vocabularyService } from "./vocabularyService";
import { storageService, KEYS } from "./storageService";

// Dictionary lookup. Tries the rich local dictionary first, then the larger
// learner/core word bank and vocabulary list as fallbacks. A future free
// dictionary API can be added in `lookupRemote` (see .env.example
// DICTIONARY_API_BASE_URL) with this local data kept as offline fallback.

const contractionAliases: Record<string, string[]> = {
  "i'd": ["i'd", "would"],
  "i'll": ["i'll", "will"],
  "i'm": ["i'm", "am"],
  "it'll": ["it'll", "will"],
  "it's": ["it's", "is"],
  "that's": ["that's", "that"],
  "there's": ["there's", "there"],
  "here's": ["here's", "here"],
  "what's": ["what's", "what"],
  "how's": ["how's", "how"],
  "let's": ["let's", "let"],
  "won't": ["won't", "will"],
  "can't": ["can't", "can"],
  "you're": ["you", "are"],
  "we're": ["we", "are"],
  "they're": ["they", "are"],
  "don't": ["do"],
  "doesn't": ["does"],
  "didn't": ["do"],
};

const irregularForms: Record<string, string[]> = {
  bought: ["buy"],
  brought: ["bring"],
  came: ["come"],
  found: ["find"],
  gone: ["go"],
  got: ["get"],
  made: ["make"],
  paid: ["pay"],
  said: ["say"],
  sent: ["send"],
  took: ["take"],
  went: ["go"],
};

export interface ClickableToken {
  text: string;
  lookup?: string;
}

function normalizeToken(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^a-z']+|[^a-z']+$/g, "");
}

function normalizeMultilingualToken(word: string, language: LearningLanguageCode): string {
  const clean = word
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/^[\s"'`.,!?;:()[\]{}<>「」『』（）。，、！？；：]+|[\s"'`.,!?;:()[\]{}<>「」『』（）。，、！？；：]+$/g, "");
  if (language === "it") {
    return clean
      .toLowerCase()
      .normalize("NFC")
      .replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ']+|[^A-Za-zÀ-ÖØ-öø-ÿ']+$/g, "");
  }
  return clean;
}

function candidatesFor(word: string): string[] {
  const q = normalizeToken(word);
  if (!q) return [];

  const candidates = new Set<string>([q]);
  contractionAliases[q]?.forEach((w) => candidates.add(w));
  irregularForms[q]?.forEach((w) => candidates.add(w));

  if (q.endsWith("'s")) candidates.add(q.slice(0, -2));
  if (q.endsWith("ies") && q.length > 4) candidates.add(q.slice(0, -3) + "y");
  if (q.endsWith("es") && q.length > 3) candidates.add(q.slice(0, -2));
  if (q.endsWith("s") && q.length > 3) candidates.add(q.slice(0, -1));
  if (q.endsWith("ing") && q.length > 5) {
    const base = q.slice(0, -3);
    candidates.add(base);
    candidates.add(base + "e");
    if (base.length > 2 && base.at(-1) === base.at(-2)) candidates.add(base.slice(0, -1));
  }
  if (q.endsWith("ed") && q.length > 4) {
    const base = q.slice(0, -2);
    candidates.add(base);
    candidates.add(base + "e");
    if (base.length > 2 && base.at(-1) === base.at(-2)) candidates.add(base.slice(0, -1));
  }

  return Array.from(candidates);
}

function findLocalEntry(word: string): { entry: Word | null; fromFallback: boolean } {
  const rich = dictionaryEntries.find((w) => w.word.toLowerCase() === word);
  if (rich) return { entry: rich, fromFallback: false };

  const learner = learnerDictionaryEntries.find((w) => w.word.toLowerCase() === word);
  if (learner) return { entry: learner, fromFallback: true };

  const basic = vocabularyService.find(word);
  if (basic) return { entry: basic, fromFallback: true };

  return { entry: null, fromFallback: false };
}

function findMultilingualEntry(word: string, language: Exclude<LearningLanguageCode, "en">): Word | null {
  const normalized = normalizeMultilingualToken(word, language);
  if (!normalized) return null;
  return multilingualDictionaryEntries.find(
    (entry) => entry.language === language && normalizeMultilingualToken(entry.word, language) === normalized
  ) ?? null;
}

function inferPartOfSpeech(word: string): Word["pos"] {
  if (/^(and|but|or|because|if|so)$/.test(word)) return "conj.";
  if (/^(i|you|he|she|it|we|they|me|him|her|us|them|my|your|our|their|who|which|what)$/.test(word)) return "pron.";
  if (/^(at|in|on|to|for|from|with|about|above|behind|before|after|over|under|through|toward)$/.test(word)) return "prep.";
  if (/ly$/.test(word) || /^(now|then|here|there|too|also|already|usually|soon)$/.test(word)) return "adv.";
  if (/(ing|ed)$/.test(word)) return "v.";
  if (/(ful|ous|ive|al|able|ible|ent|ant|ic|y)$/.test(word)) return "adj.";
  return "n.";
}

function learnerFallback(word: string): Word | null {
  const q = normalizeToken(word);
  if (!/^[a-z][a-z'-]*$/.test(q) || q.length < 2) return null;
  const pos = inferPartOfSpeech(q);
  const zhByPos: Record<Word["pos"], string> = {
    "n.": "情境對話常見名詞或名稱，請搭配原句理解。",
    "v.": "情境對話常見動詞或動詞變化，表示動作或狀態。",
    "adj.": "情境對話常見形容詞，用來描述人、事、物。",
    "adv.": "情境對話常見副詞，用來補充時間、程度或方式。",
    "prep.": "常見介系詞，用來表示位置、時間、方向或關係。",
    "conj.": "常見連接詞，用來連接句子或想法。",
    "interj.": "常見感嘆詞或招呼語。",
    "pron.": "常見代名詞，用來代替人、事、物。",
  };

  return {
    word: q,
    phonetic: "/-/",
    pos,
    enDef: "A common conversation word or word form used in real-life English scenes.",
    zh: zhByPos[pos],
    example: `Try using "${q}" in a complete sentence from the scene.`,
    exampleZh: `試著把「${q}」放回場景句子中完整練習。`,
    related: candidatesFor(q).filter((candidate) => candidate !== q).slice(0, 4),
  };
}

function multilingualFallback(word: string, language: Exclude<LearningLanguageCode, "en">): Word | null {
  const q = normalizeMultilingualToken(word, language);
  if (!q) return null;
  if (language === "ja" && !/[\u3040-\u30ff\u3400-\u9fff]/.test(q)) return null;
  if (language === "ko" && !/[\uac00-\ud7af]/.test(q)) return null;
  if (language === "it" && !/^[A-Za-zÀ-ÖØ-öø-ÿ']{2,}$/.test(q)) return null;

  const lang = getLearningLanguage(language);
  const examples: Record<Exclude<LearningLanguageCode, "en">, { example: string; zh: string }> = {
    ja: { example: `${q}を使って短い文を作りましょう。`, zh: `試著用「${q}」造一個短句。` },
    ko: { example: `${q}을/를 넣어서 짧은 문장을 만들어 보세요.`, zh: `試著把「${q}」放進短句裡。` },
    it: { example: `Prova a usare "${q}" in una frase breve.`, zh: `試著用「${q}」造一個短句。` },
  };

  return {
    language,
    word: q,
    phonetic: "/-/",
    pos: "n.",
    enDef: `A ${lang.nativeName} word or phrase used in real-life conversation scenes.`,
    zh: `${lang.zhName}情境對話詞，請搭配原句理解意思與用法。`,
    example: examples[language].example,
    exampleZh: examples[language].zh,
  };
}

function tokenizeWithRegex(text: string, language: LearningLanguageCode): ClickableToken[] {
  const pattern = language === "it"
    ? /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[’'][A-Za-zÀ-ÖØ-öø-ÿ]+)?/g
    : /[A-Za-z]+(?:[’'][A-Za-z]+)?/g;
  const tokens: ClickableToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const word = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) tokens.push({ text: text.slice(lastIndex, index) });
    tokens.push({ text: word, lookup: normalizeMultilingualToken(word, language) || word });
    lastIndex = index + word.length;
  }
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex) });
  return tokens.length ? tokens : [{ text }];
}

type SegmenterSegment = {
  segment: string;
  index: number;
  isWordLike?: boolean;
};

type SegmenterCtor = new (
  locale?: string,
  options?: { granularity?: "grapheme" | "word" | "sentence" }
) => { segment(input: string): Iterable<SegmenterSegment> };

function tokenizeWithSegmenter(text: string, language: Exclude<LearningLanguageCode, "en">): ClickableToken[] | null {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterCtor }).Segmenter;
  if (!Segmenter) return null;
  const locale = language === "ja" ? "ja-JP" : language === "ko" ? "ko-KR" : "it-IT";
  const segmenter = new Segmenter(locale, { granularity: "word" });
  const tokens: ClickableToken[] = [];
  let lastIndex = 0;

  Array.from(segmenter.segment(text)).forEach((part) => {
    if (part.index > lastIndex) tokens.push({ text: text.slice(lastIndex, part.index) });
    const lookup = normalizeMultilingualToken(part.segment, language);
    const isKnown = language === "it" ? Boolean(lookup) : Boolean(findMultilingualEntry(lookup, language) || multilingualFallback(lookup, language));
    tokens.push({
      text: part.segment,
      lookup: (part.isWordLike || isKnown) && lookup ? lookup : undefined,
    });
    lastIndex = part.index + part.segment.length;
  });
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex) });
  return tokens.length ? tokens : null;
}

function isTargetScript(char: string, language: Exclude<LearningLanguageCode, "en">) {
  if (language === "ja") return /[\u3040-\u30ff\u3400-\u9fff]/.test(char);
  if (language === "ko") return /[\uac00-\ud7af]/.test(char);
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(char);
}

function tokenizeWithDictionary(text: string, language: Exclude<LearningLanguageCode, "en">): ClickableToken[] {
  if (language === "it") return tokenizeWithRegex(text, language);
  const entries = multilingualDictionaryEntries
    .filter((entry) => entry.language === language)
    .map((entry) => entry.word)
    .sort((a, b) => b.length - a.length);
  const tokens: ClickableToken[] = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (!isTargetScript(char, language)) {
      tokens.push({ text: char });
      i += char.length;
      continue;
    }
    const matched = entries.find((word) => text.startsWith(word, i));
    if (matched) {
      tokens.push({ text: matched, lookup: matched });
      i += matched.length;
      continue;
    }
    let j = i + char.length;
    while (j < text.length && isTargetScript(text[j], language) && !entries.some((word) => text.startsWith(word, j))) {
      j += text[j].length;
    }
    const chunk = text.slice(i, j);
    tokens.push({ text: chunk, lookup: chunk });
    i = j;
  }
  return tokens;
}

export const dictionaryService = {
  lookup(word: string, language: LearningLanguageCode = "en"): { entry: Word | null; fromFallback: boolean } {
    if (language !== "en") {
      const entry = findMultilingualEntry(word, language);
      if (entry) return { entry, fromFallback: false };
      const fallback = multilingualFallback(word, language);
      if (fallback) return { entry: fallback, fromFallback: true };
      return { entry: null, fromFallback: false };
    }
    for (const candidate of candidatesFor(word)) {
      const result = findLocalEntry(candidate);
      if (result.entry) return result;
    }
    const fallback = learnerFallback(word);
    if (fallback) return { entry: fallback, fromFallback: true };
    return { entry: null, fromFallback: false };
  },

  tokenize(text: string, language: LearningLanguageCode = "en"): ClickableToken[] {
    if (!text) return [];
    if (language === "en") return tokenizeWithRegex(text, language);
    return tokenizeWithSegmenter(text, language) ?? tokenizeWithDictionary(text, language);
  },

  suggest(query: string, language: LearningLanguageCode = "en"): string[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (language !== "en") {
      return multilingualDictionaryEntries
        .filter((w) => w.language === language && normalizeMultilingualToken(w.word, language).startsWith(q))
        .slice(0, 8)
        .map((w) => w.word);
    }
    return vocabularyService
      .all()
      .filter((w) => w.word.toLowerCase().startsWith(q))
      .slice(0, 8)
      .map((w) => w.word);
  },

  // Placeholder for future remote API integration (kept server-side via route).
  async lookupRemote(_word: string): Promise<Word | null> {
    return null;
  },

  // ---- Saved sentences ----
  getSavedSentences(): SavedSentence[] {
    return storageService.get<SavedSentence[]>(KEYS.savedSentences, []);
  },
  toggleSentence(en: string, zh: string, source?: string): boolean {
    const list = this.getSavedSentences();
    const idx = list.findIndex((s) => s.en === en);
    if (idx >= 0) {
      list.splice(idx, 1);
      storageService.set(KEYS.savedSentences, list);
      return false;
    }
    list.unshift({ id: Math.random().toString(36).slice(2), en, zh, savedAt: new Date().toISOString(), source });
    storageService.set(KEYS.savedSentences, list);
    return true;
  },
  isSentenceSaved(en: string): boolean {
    return this.getSavedSentences().some((s) => s.en === en);
  },
};
