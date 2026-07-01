import type { EnglishLevel, LearningLanguageCode, Word } from "@/types";
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
  if (containsCjk(zh)) return shortText(zh.split(/[；;,，、]/)[0] || zh, 30);
  const def = String(word.enDef || zh || word.word).trim();
  return shortText(def, 64);
}

function blankedExample(word: Word) {
  const target = word.word.trim();
  const example = String(word.example || "").replace(/\s+/g, " ").trim();
  if (example && target) {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exact = new RegExp(`\\b${escaped}\\b`, "i");
    if (exact.test(example)) return shortText(example.replace(exact, "____"), 90);
  }
  return `____ = ${shortMeaning(word)}`;
}

function isFriendlyForLevel(word: Word, level: EnglishLevel, language: LearningLanguageCode) {
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

function pickQuestionKinds(words: Word[], level: EnglishLevel): WordReviewQuestionKind[] {
  const beginnerLike = level === "Beginner" || level === "Elementary";
  const fillCount = beginnerLike
    ? words.length >= 8 ? 2 : words.length >= 4 ? 1 : 0
    : words.length >= 5 ? Math.max(1, Math.round(words.length * 0.25)) : words.length >= 3 ? 1 : 0;
  const wordChoiceCount = beginnerLike
    ? words.length >= 3 ? Math.max(1, Math.round(words.length * 0.45)) : 1
    : words.length >= 4 ? Math.max(1, Math.round(words.length * 0.25)) : words.length >= 2 ? 1 : 0;
  const shuffledIndexes = words
    .map((_, index) => index)
    .sort(() => Math.random() - 0.5);
  const fillIndexes = new Set(shuffledIndexes.slice(0, fillCount));
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
  const saved = savedLearnedWords(language);
  const learned = uniqueWords([...saved, ...memoryWords(language, pool, memory)]);
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
    if (questionKind === "wordFill") return [];
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
    if (questionKind === "wordFill") return blankedExample(word);
    if (questionKind === "wordChoice") return shortMeaning(word);
    return word.word;
  },

  questionHintFor(word: Word, questionKind: WordReviewQuestionKind): string {
    if (questionKind === "wordFill") return "看短句填單字";
    if (questionKind === "wordChoice") return "看意思選單字";
    return "看單字選意思";
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
