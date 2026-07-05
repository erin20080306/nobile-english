import type { EnglishLevel, LearningLanguageCode, Word } from "@/types";
import { scenes } from "@/data/scenes";
import { vocabularyService } from "./vocabularyService";
import { learningService } from "./learningService";
import { storageService, KEYS } from "./storageService";

export interface WordReviewOptions {
  language: LearningLanguageCode;
  level: EnglishLevel;
  count: number;
  learnedPercent: number;
}

export type WordReviewQuestionKind = "meaningChoice" | "wordChoice" | "wordFill";

export interface WordReviewItem {
  word: Word;
  source: "learned" | "level";
  dueReason: "new" | "due" | "missed" | "saved";
  questionKind: WordReviewQuestionKind;
}

export interface WordReviewAnswer {
  word: string;
  correct: boolean;
  selectedText: string;
  correctText: string;
  questionKind: WordReviewQuestionKind;
  selectedZh: string;
  correctZh: string;
  answeredAt: string;
}

export interface WordReviewSession {
  id: string;
  language: LearningLanguageCode;
  level: EnglishLevel;
  count: number;
  learnedPercent: number;
  startedAt: string;
  words: WordReviewItem[];
  answers: WordReviewAnswer[];
}

export interface WordReviewScore {
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  wordsReviewed: string[];
  nextReviewCount: number;
}

export interface WordReviewDatabaseSessionResult {
  session: WordReviewSession;
  source: "database" | "local";
  poolSize: number;
  targetCount?: number;
  reason?: string;
}

interface ReviewPoolApiResponse {
  source?: "database" | "local";
  words?: Word[];
  poolSize?: number;
  targetCount?: number;
  reason?: string;
}

interface WordMemory {
  word: string;
  language: LearningLanguageCode;
  seen: number;
  correct: number;
  wrong: number;
  streak: number;
  learned: boolean;
  lastReviewedAt?: string;
  nextDueAt?: string;
}

interface WordReviewMemory {
  version: 1;
  byWord: Record<string, WordMemory>;
  recentQueue: string[];
  lastOptions?: Pick<WordReviewOptions, "language" | "count" | "learnedPercent">;
}

const LEVEL_LIMITS: Record<LearningLanguageCode, Record<EnglishLevel, number>> = {
  en: {
    Beginner: 650,
    Elementary: 1800,
    Intermediate: 4000,
    "Upper-Intermediate": 6000,
    Advanced: 16000,
  },
  ja: {
    Beginner: 1500,
    Elementary: 2500,
    Intermediate: 4000,
    "Upper-Intermediate": 6000,
    Advanced: 10000,
  },
  ko: {
    Beginner: 1500,
    Elementary: 2500,
    Intermediate: 4000,
    "Upper-Intermediate": 6000,
    Advanced: 10000,
  },
  it: {
    Beginner: 1500,
    Elementary: 2500,
    Intermediate: 4000,
    "Upper-Intermediate": 6000,
    Advanced: 10000,
  },
  es: {
    Beginner: 1500,
    Elementary: 2500,
    Intermediate: 4000,
    "Upper-Intermediate": 6000,
    Advanced: 10000,
  },
  zh: {
    Beginner: 1500,
    Elementary: 2500,
    Intermediate: 4000,
    "Upper-Intermediate": 6000,
    Advanced: 10000,
  },
};

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function wordKey(language: LearningLanguageCode, word: string) {
  return `${language}:${word.trim().toLowerCase().normalize("NFC")}`;
}

function emptyMemory(): WordReviewMemory {
  return { version: 1, byWord: {}, recentQueue: [] };
}

function getMemory(): WordReviewMemory {
  const raw = storageService.get<WordReviewMemory | null>(KEYS.wordReviewMemory, null);
  if (!raw || raw.version !== 1 || !raw.byWord) return emptyMemory();
  return raw;
}

function saveMemory(memory: WordReviewMemory) {
  storageService.set(KEYS.wordReviewMemory, memory);
}

function matchesLanguage(word: Word, language: LearningLanguageCode) {
  return language === "en" ? !word.language || word.language === "en" : word.language === language;
}

function uniqueWords(words: Word[]) {
  const seen = new Set<string>();
  return words.filter((word) => {
    const key = wordKey(word.language || "en", word.word);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function levelWords(language: LearningLanguageCode, level: EnglishLevel) {
  const all = uniqueWords(vocabularyService.all(language).filter((word) => matchesLanguage(word, language)));
  const limit = Math.min(all.length, LEVEL_LIMITS[language]?.[level] || all.length);
  return all.slice(0, limit);
}

function normalizePoolWords(words: Word[], language: LearningLanguageCode) {
  return uniqueWords(words.filter((word) => matchesLanguage(word, language)));
}

function containsCjk(text?: string) {
  return /[\u3400-\u9fff]/.test(text || "");
}

function wordCount(text = "") {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function shortText(text = "", max = 72) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sentence = clean.split(/[.!?。！？]/)[0]?.trim();
  if (sentence && sentence.length <= max) return sentence;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function shortMeaning(word: Word) {
  const zh = String(word.zh || "").trim();
  if (containsCjk(zh)) {
    // Split by common separators and take the first meaning, excluding scenario context
    const meanings = zh.split(/[；;,，、]/);
    // Filter out scenario-related phrases
    const cleanMeaning = meanings[0]?.replace(/場景|情境|短句|練習|使用/g, "").trim() || zh;
    return shortText(cleanMeaning, 30);
  }
  const def = String(word.enDef || zh || word.word).trim();
  return shortText(def, 64);
}

function isPracticePrompt(example = "", zh = "") {
  return (
    /^try using\s+["“]/i.test(example.trim()) ||
    /場景中的完整句子使用|放回場景句子|放進短句|放回原句|造一個短句|完整練習/.test(zh)
  );
}

function sceneSentenceFor(word: Word) {
  const target = word.word.trim();
  if (!target || /\s/.test(target)) return null;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = new RegExp(`\\b${escaped}\\b`, "i");
  for (const scene of scenes) {
    for (const pattern of scene.keyPatterns) {
      if (exact.test(pattern.en)) return pattern;
    }
    for (const line of scene.dialogue) {
      if (exact.test(line.en)) return { en: line.en, zh: line.zh };
    }
  }
  return null;
}

function genericFillSentence(word: Word) {
  const target = word.word.trim();
  const meaning = shortMeaning(word).replace(/[。.]$/, "");
  if (word.pos === "adj.") return { en: `It is ${target}.`, zh: `它是${meaning}的。` };
  if (word.pos === "adv.") return { en: `Please speak ${target}.`, zh: `請用${meaning}的方式說話。` };
  if (word.pos === "v.") {
    if (/ing$/i.test(target)) return { en: `I am ${target} now.`, zh: `我現在正在${meaning}。` };
    if (/ed$/i.test(target)) return { en: `I ${target} today.`, zh: `我今天${meaning}。` };
    return { en: `I can ${target}.`, zh: `我可以${meaning}。` };
  }
  const article = /^[aeiou]/i.test(target) ? "an" : "a";
  return { en: `This is ${article} ${target}.`, zh: `這是一個${meaning}。` };
}

function fillSentenceFor(word: Word) {
  const target = word.word.trim();
  const example = String(word.example || "").replace(/\s+/g, " ").trim();
  const exampleZh = String(word.exampleZh || "").replace(/\s+/g, " ").trim();
  if (example && target && !isPracticePrompt(example, exampleZh)) {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exact = new RegExp(`\\b${escaped}\\b`, "i");
    if (exact.test(example)) return { en: example, zh: exampleZh };
  }
  return sceneSentenceFor(word) || genericFillSentence(word);
}

function blankedExample(word: Word) {
  const target = word.word.trim();
  const sentence = fillSentenceFor(word).en;
  if (sentence && target) {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exact = new RegExp(`\\b${escaped}\\b`, "i");
    if (exact.test(sentence)) return shortText(sentence.replace(exact, "____"), 90);
  }
  // If no example or target not in example, return null to indicate this word should not be used for fill-in-the-blank
  return null;
}

function sentenceZh(word: Word) {
  const sentence = fillSentenceFor(word);
  if (containsCjk(sentence.zh)) return shortText(normalizeFillSentenceZh(word, sentence.zh), 90);
  const exampleZh = String(word.exampleZh || "").replace(/\s+/g, " ").trim();
  if (containsCjk(exampleZh)) return shortText(normalizeFillSentenceZh(word, exampleZh), 90);
  const zh = String(word.zh || "").replace(/\s+/g, " ").trim();
  if (containsCjk(zh)) return shortText(zh, 90);
  return "";
}

function normalizeFillSentenceZh(word: Word, zh: string) {
  const example = String(word.example || "").replace(/\s+/g, " ").trim();
  const isPracticePrompt = /^try using\s+["“]/i.test(example) || /放回場景句子|放進短句|放回原句|完整練習/.test(zh);
  if (isPracticePrompt) {
    return "";
  }
  return zh;
}

function answerInitialHint(word: Word) {
  const letters = Array.from(word.word.trim());
  if (letters.length === 0) return "";
  const visibleCount = letters.length <= 3 ? 1 : 2;
  return `${letters.slice(0, visibleCount).join("")}${letters.length > visibleCount ? "..." : ""}`;
}

const GENERIC_PLACEHOLDER_ZH_PATTERN = /情境對話常見(名詞或名稱|動詞或動詞變化|形容詞|副詞)|常見(介系詞|連接詞|感嘆詞或招呼語|代名詞)|請搭配原句理解/;

function hasGenericPlaceholderMeaning(word: Word) {
  return GENERIC_PLACEHOLDER_ZH_PATTERN.test(String(word.zh || ""));
}

function isFriendlyForLevel(word: Word, level: EnglishLevel, language: LearningLanguageCode) {
  // Words with an auto-generated placeholder meaning (no real Chinese
  // definition, e.g. "情境對話常見名詞或名稱，請搭配原句理解。") are never
  // usable for review questions at any level, since learners cannot tell
  // what the word actually means.
  if (hasGenericPlaceholderMeaning(word)) return false;
  if (level !== "Beginner" && level !== "Elementary") return true;
  const surface = word.word.trim();
  const maxSurface = level === "Beginner" ? 13 : 18;
  const maxDefWords = level === "Beginner" ? 9 : 16;
  const maxExampleWords = level === "Beginner" ? 9 : 14;
  if (!surface || Array.from(surface).length > maxSurface) return false;
  if (language === "en" && /\s/.test(surface)) return false;
  // Beginners/Elementary must have a Chinese meaning, otherwise the prompt falls
  // back to an English definition (e.g. "plural of pie") that they cannot read.
  if (!containsCjk(word.zh)) return false;
  if (wordCount(word.enDef || word.zh) > maxDefWords && !containsCjk(word.zh)) return false;
  if (word.example && wordCount(word.example) > maxExampleWords) return false;
  return true;
}

function savedLearnedWords(language: LearningLanguageCode) {
  return vocabularyService.getSaved().filter((word) => matchesLanguage(word, language));
}

function memoryWords(language: LearningLanguageCode, pool: Word[], memory: WordReviewMemory) {
  const byKey = new Map(pool.map((word) => [wordKey(language, word.word), word]));
  return Object.values(memory.byWord)
    .filter((entry) => entry.language === language && entry.seen > 0)
    .map((entry) => byKey.get(wordKey(language, entry.word)))
    .filter((word): word is Word => Boolean(word));
}

function scoreForDue(word: Word, memory: WordReviewMemory, language: LearningLanguageCode) {
  const entry = memory.byWord[wordKey(language, word.word)];
  if (!entry) return 0;
  const due = entry.nextDueAt ? new Date(entry.nextDueAt).getTime() <= Date.now() : true;
  return (due ? 80 : 0) + entry.wrong * 10 - entry.correct * 2 - entry.streak * 3;
}

function sortLearned(words: Word[], memory: WordReviewMemory, language: LearningLanguageCode) {
  return [...words].sort((a, b) => scoreForDue(b, memory, language) - scoreForDue(a, memory, language));
}

function takeWords(words: Word[], count: number, excluded: Set<string>, language: LearningLanguageCode) {
  const selected: Word[] = [];
  for (const word of words) {
    const key = wordKey(language, word.word);
    if (excluded.has(key)) continue;
    selected.push(word);
    excluded.add(key);
    if (selected.length >= count) break;
  }
  return selected;
}

function nextDueDate(correct: boolean, streak: number) {
  const days = correct ? Math.min(14, Math.max(1, streak * 2)) : 1;
  const due = new Date();
  due.setDate(due.getDate() + days);
  return due.toISOString();
}

function optionText(word: Word, questionKind: WordReviewQuestionKind) {
  return questionKind === "meaningChoice" ? shortMeaning(word) || word.word : word.word;
}

function normalizeAnswer(text: string) {
  return text.trim().toLowerCase().normalize("NFC");
}

function choiceScore(text: string, seed: number) {
  return Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), seed);
}

function isSimpleFillExample(word: Word): boolean {
  const example = String(word.example || "").replace(/\s+/g, " ").trim();
  const target = word.word.trim();
  
  // Check if example is too long (more than 12 words)
  if (wordCount(example) > 12) return false;
  
  // Check if the target word appears in a simple context
  // Avoid complex tense changes or grammar structures
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = new RegExp(`\\b${escaped}\\b`, "i");
  if (!exact.test(example)) return false;
  
  // Check for complex grammar patterns that might confuse learners
  const complexPatterns = [
    /\bwas\b.*\bgoing\b/i,  // was going to
    /\bhave\b.*\bbeen\b/i,  // have been
    /\bhad\b.*\bbeen\b/i,   // had been
    /\bwill\b.*\bhave\b/i,  // will have
    /\bwould\b.*\bhave\b/i, // would have
    /\bif\b.*\bwould\b/i,   // conditional
    /\bbecause\b.*\bso\b/i, // complex reasoning
  ];
  
  for (const pattern of complexPatterns) {
    if (pattern.test(example)) return false;
  }
  
  return true;
}

function pickQuestionKinds(words: Word[], level: EnglishLevel): WordReviewQuestionKind[] {
  const beginnerLike = level === "Beginner" || level === "Elementary";
  // Only count words that have valid and simple examples for fill-in-the-blank
  const wordsWithSimpleExamples = words.filter((word) => {
    const blanked = blankedExample(word);
    return blanked !== null && isSimpleFillExample(word);
  });
  const fillCount = beginnerLike
    ? wordsWithSimpleExamples.length >= 8 ? 2 : wordsWithSimpleExamples.length >= 4 ? 1 : 0
    : wordsWithSimpleExamples.length >= 5 ? Math.max(1, Math.round(wordsWithSimpleExamples.length * 0.25)) : wordsWithSimpleExamples.length >= 3 ? 1 : 0;
  const wordChoiceCount = beginnerLike
    ? words.length >= 3 ? Math.max(1, Math.round(words.length * 0.45)) : 1
    : words.length >= 4 ? Math.max(1, Math.round(words.length * 0.25)) : words.length >= 2 ? 1 : 0;
  const shuffledIndexes = words
    .map((_, index) => index)
    .sort(() => Math.random() - 0.5);
  // Only assign fill-in-the-blank to words that have valid and simple examples
  const fillIndexes = new Set(
    shuffledIndexes
      .filter((index) => {
        const blanked = blankedExample(words[index]);
        return blanked !== null && isSimpleFillExample(words[index]);
      })
      .slice(0, fillCount)
  );
  const wordChoiceIndexes = new Set(shuffledIndexes.slice(fillCount, fillCount + wordChoiceCount));
  return words.map((_, index) => {
    if (fillIndexes.has(index)) return "wordFill";
    if (wordChoiceIndexes.has(index)) return "wordChoice";
    return "meaningChoice";
  });
}

function answerText(answer: WordReviewAnswer) {
  const selected = answer.selectedText || answer.selectedZh;
  return `${answer.word}: ${answer.correct ? "OK" : `missed (${selected})`}`;
}

function buildSessionFromPool(options: WordReviewOptions, poolWords: Word[]): WordReviewSession {
  const language = options.language;
  const memory = getMemory();
  const count = clamp(options.count, 1, 30);
  const learnedPercent = clamp(options.learnedPercent, 0, 100);
  const pool = normalizePoolWords(poolWords, language).filter((word) => isFriendlyForLevel(word, options.level, language));
  // Saved words and words from past review sessions can come from scene/dialogue
  // practice, where an unknown word is looked up via the learner dictionary
  // fallback and stored with a generic placeholder meaning (e.g. "情境對話常見
  // 名詞或名稱，請搭配原句理解。"). Filter those out here too, since they never
  // went through the database pool's isFriendlyForLevel check above.
  const saved = savedLearnedWords(language).filter((word) => !hasGenericPlaceholderMeaning(word));
  const learned = uniqueWords([...saved, ...memoryWords(language, pool, memory).filter((word) => !hasGenericPlaceholderMeaning(word))]);
  const learnedTarget = Math.min(learned.length, Math.round(count * (learnedPercent / 100)));
  const excluded = new Set<string>();
  const selectedLearned = takeWords(sortLearned(learned, memory, language), learnedTarget, excluded, language);
  const selectedNew = takeWords(pool, count - selectedLearned.length, excluded, language);
  const fill = takeWords([...learned, ...pool], count - selectedLearned.length - selectedNew.length, excluded, language);
  const selected = [...selectedLearned, ...selectedNew, ...fill].slice(0, count);
  const questionKinds = pickQuestionKinds(selected, options.level);

  memory.lastOptions = { language, count, learnedPercent };
  saveMemory(memory);

  return {
    id: makeId(),
    language,
    level: options.level,
    count,
    learnedPercent,
    startedAt: nowIso(),
    words: selected.map((word, index) => {
      const key = wordKey(language, word.word);
      const mem = memory.byWord[key];
      const savedWord = saved.some((item) => wordKey(language, item.word) === key);
      return {
        word,
        source: mem || savedWord ? "learned" : "level",
        dueReason: mem?.wrong && mem.wrong > mem.correct ? "missed" : savedWord ? "saved" : mem ? "due" : "new",
        questionKind: questionKinds[index],
      };
    }),
    answers: [],
  };
}

export const wordReviewService = {
  getLastOptions(): Partial<WordReviewOptions> | null {
    return getMemory().lastOptions || null;
  },

  getReviewableCount(language: LearningLanguageCode, level: EnglishLevel): number {
    return levelWords(language, level).length;
  },

  buildSession(options: WordReviewOptions): WordReviewSession {
    return buildSessionFromPool(options, levelWords(options.language, options.level));
  },

  async buildDatabaseSession(options: WordReviewOptions): Promise<WordReviewDatabaseSessionResult> {
    const localSession = () => {
      const session = buildSessionFromPool(options, levelWords(options.language, options.level));
      return { session, source: "local" as const, poolSize: session.words.length };
    };

    if (typeof window === "undefined") return localSession();

    try {
      const seed = `${new Date().toISOString().slice(0, 10)}:${options.language}:${options.level}:${options.count}:${options.learnedPercent}`;
      const params = new URLSearchParams({
        language: options.language,
        level: options.level,
        limit: "900",
        seed,
      });
      const response = await fetch(`/api/vocabulary/review-pool?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const fallback = localSession();
        return { ...fallback, reason: `Vocabulary API HTTP ${response.status}` };
      }

      const data = await response.json() as ReviewPoolApiResponse;
      const words = Array.isArray(data.words) ? data.words : [];
      if (data.source === "database" && words.length > 0) {
        return {
          session: buildSessionFromPool(options, words),
          source: "database",
          poolSize: data.poolSize || words.length,
          targetCount: data.targetCount,
        };
      }

      const fallback = localSession();
      return {
        ...fallback,
        targetCount: data.targetCount,
        reason: data.reason || "Database vocabulary pool is empty.",
      };
    } catch (error) {
      const fallback = localSession();
      return {
        ...fallback,
        reason: error instanceof Error ? error.message : "Vocabulary API request failed.",
      };
    }
  },

  correctChoiceFor(target: Word, questionKind: WordReviewQuestionKind = "meaningChoice"): string {
    return optionText(target, questionKind);
  },

  isCorrectAnswer(answer: string, target: Word, questionKind: WordReviewQuestionKind = "meaningChoice"): boolean {
    return normalizeAnswer(answer) === normalizeAnswer(optionText(target, questionKind));
  },

  isCorrectChoice(choice: string, target: Word, questionKind: WordReviewQuestionKind = "meaningChoice"): boolean {
    return normalizeAnswer(choice) === normalizeAnswer(optionText(target, questionKind));
  },

  choicesFor(target: Word, language: LearningLanguageCode, questionKind: WordReviewQuestionKind = "meaningChoice", pool?: Word[]): string[] {
    if (questionKind === "wordFill") {
      // For fill-in-the-blank, provide English word choices
      const correct = target.word;
      const sourceWords = pool && pool.length > 0 ? pool : vocabularyService.all(language);
      const all = sourceWords
        .filter((word) => matchesLanguage(word, language) && word.word !== target.word)
        .map((word) => word.word)
        .filter((text) => text && text !== correct);
      const seed = choiceScore(`${target.word}:wordFill`, 5);
      const uniqueChoices = all.filter((text, index) => all.indexOf(text) === index);
      const distractors = uniqueChoices
        .sort((a, b) => (choiceScore(a, seed) % 17) - (choiceScore(b, seed) % 17))
        .slice(0, 3);
      return [correct, ...distractors]
        .filter(Boolean)
        .slice(0, 4)
        .sort((a, b) => (choiceScore(a, seed) % 11) - (choiceScore(b, seed) % 11));
    }
    const correct = optionText(target, questionKind);
    const sourceWords = pool && pool.length > 0 ? pool : vocabularyService.all(language);
    const all = sourceWords
      .filter((word) => matchesLanguage(word, language) && word.word !== target.word)
      .map((word) => optionText(word, questionKind))
      .filter((text) => text && text !== correct);
    const seed = choiceScore(`${target.word}:${questionKind}`, questionKind === "wordChoice" ? 7 : 3);
    const uniqueChoices = all.filter((text, index) => all.indexOf(text) === index);
    const distractors = uniqueChoices
      .sort((a, b) => (choiceScore(a, seed) % 17) - (choiceScore(b, seed) % 17))
      .slice(0, 3);
    return [correct, ...distractors]
      .filter(Boolean)
      .slice(0, 4)
      .sort((a, b) => (choiceScore(a, seed) % 11) - (choiceScore(b, seed) % 11));
  },

  questionPromptFor(word: Word, questionKind: WordReviewQuestionKind): string {
    if (questionKind === "wordFill") {
      const blanked = blankedExample(word);
      if (blanked) return blanked;
      // Fallback to meaning choice if no valid example
      return shortMeaning(word);
    }
    if (questionKind === "wordChoice") return shortMeaning(word);
    return word.word;
  },

  questionHintFor(word: Word, questionKind: WordReviewQuestionKind): string {
    if (questionKind === "wordFill") {
      const blanked = blankedExample(word);
      if (blanked) {
        // Show the Chinese translation of the full example sentence
        return sentenceZh(word) || "看短句填單字";
      }
      return "看意思選單字";
    }
    if (questionKind === "wordChoice") return "看意思選單字";
    return "看單字選意思";
  },

  questionZhFor(word: Word, questionKind: WordReviewQuestionKind): string {
    if (questionKind === "wordFill") return sentenceZh(word);
    return "";
  },

  sentenceTranslationFor(word: Word): string {
    return sentenceZh(word) || word.exampleZh || word.zh || "";
  },

  answerInitialHintFor(word: Word): string {
    return answerInitialHint(word);
  },

  completeSession(session: WordReviewSession): WordReviewScore {
    const memory = getMemory();
    const total = session.words.length;
    const correct = session.answers.filter((answer) => answer.correct).length;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;

    for (const item of session.words) {
      const key = wordKey(session.language, item.word.word);
      const answer = session.answers.find((entry) => entry.word === item.word.word);
      const wasCorrect = Boolean(answer?.correct);
      const previous = memory.byWord[key] || {
        word: item.word.word,
        language: session.language,
        seen: 0,
        correct: 0,
        wrong: 0,
        streak: 0,
        learned: false,
      };
      const streak = wasCorrect ? previous.streak + 1 : 0;
      memory.byWord[key] = {
        ...previous,
        seen: previous.seen + 1,
        correct: previous.correct + (wasCorrect ? 1 : 0),
        wrong: previous.wrong + (wasCorrect ? 0 : 1),
        streak,
        learned: true,
        lastReviewedAt: nowIso(),
        nextDueAt: nextDueDate(wasCorrect, streak),
      };
    }

    const reviewedKeys = session.words.map((item) => wordKey(session.language, item.word.word));
    memory.recentQueue = [...reviewedKeys, ...memory.recentQueue.filter((key) => !reviewedKeys.includes(key))].slice(0, 120);
    memory.lastOptions = {
      language: session.language,
      count: session.count,
      learnedPercent: session.learnedPercent,
    };
    saveMemory(memory);

    const missed = session.answers.filter((answer) => !answer.correct).map((answer) => answer.word);
    learningService.addRecord({
      type: "word",
      targetLanguage: session.language,
      title: `單字練習 ${correct}/${total}`,
      enContent: session.words.map((item) => item.word.word).join(" / "),
      zhContent: session.answers.map(answerText).join(" / "),
      userAnswer: missed.length ? `需複習：${missed.join("、")}` : "全部答對",
      suggestion: missed.length
        ? `下次會穿插 ${missed.slice(0, 5).join("、")} 等單字。`
        : "這組單字很穩，下一次會加入更多新單字。",
      conversationWords: session.words.map((item) => item.word.word),
      score: accuracy,
      completed: true,
      minutes: Math.max(1, Math.ceil(total / 8)),
    });

    return {
      score: accuracy,
      correct,
      total,
      accuracy,
      wordsReviewed: session.words.map((item) => item.word.word),
      nextReviewCount: Object.values(memory.byWord).filter((entry) => entry.language === session.language && entry.nextDueAt && new Date(entry.nextDueAt).getTime() <= Date.now()).length,
    };
  },
};
