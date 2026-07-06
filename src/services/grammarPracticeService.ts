import type { EnglishLevel, LearningLanguageCode } from "@/types";
import { storageService, KEYS } from "./storageService";
import { learningService } from "./learningService";

export interface GrammarExercise {
  id: string;
  textTarget: string;
  textZh: string;
  tokens: string[];
}

export interface GrammarQuestion {
  exercise: GrammarExercise;
  bank: string[];
}

export interface GrammarSession {
  id: string;
  language: LearningLanguageCode;
  level: EnglishLevel;
  count: number;
  reviewWrongPercent: number;
  startedAt: string;
  questions: GrammarQuestion[];
}

export interface GrammarQuestionResult {
  exerciseId: string;
  mistakes: number;
}

export interface GrammarScore {
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  totalMistakes: number;
}

export interface GrammarSessionResult {
  session: GrammarSession;
  source: "database" | "generated" | "empty";
}

interface GrammarMemoryEntry {
  language: LearningLanguageCode;
  wrongCount: number;
  seen: number;
  lastSeenAt: string;
}

interface GrammarMemory {
  version: 1;
  byKey: Record<string, GrammarMemoryEntry>;
  lastOptions?: { language: LearningLanguageCode; count: number; reviewWrongPercent: number };
}

interface ApiExercise {
  id: string;
  textTarget: string;
  textZh: string;
  tokens: string[];
}

function emptyMemory(): GrammarMemory {
  return { version: 1, byKey: {} };
}

function getMemory(): GrammarMemory {
  const raw = storageService.get<GrammarMemory | null>(KEYS.grammarPracticeMemory, null);
  if (!raw || raw.version !== 1 || !raw.byKey) return emptyMemory();
  return raw;
}

function saveMemory(memory: GrammarMemory) {
  storageService.set(KEYS.grammarPracticeMemory, memory);
}

function normalizeKey(language: LearningLanguageCode, text: string) {
  return `${language}:${text.trim().toLowerCase().normalize("NFC").replace(/\s+/g, " ")}`;
}

function normalizeAnswer(text: string, language: LearningLanguageCode) {
  const clean = text.trim().normalize("NFC");
  if (language === "ja" || language === "ko" || language === "zh") return clean;
  return clean.replace(/\s+/g, " ");
}

function shuffle<T>(items: T[]): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function distractorCountFor(tokenCount: number) {
  return tokenCount > 0 ? 1 : 0;
}

function preferredTokenRange(level: EnglishLevel): { min: number; max: number; ideal: number } {
  const ranges: Record<EnglishLevel, { min: number; max: number; ideal: number }> = {
    Beginner: { min: 4, max: 7, ideal: 5 },
    Elementary: { min: 5, max: 9, ideal: 7 },
    Intermediate: { min: 6, max: 11, ideal: 8 },
    "Upper-Intermediate": { min: 7, max: 13, ideal: 10 },
    Advanced: { min: 8, max: 15, ideal: 11 },
  };
  return ranges[level];
}

function levelFitScore(exercise: GrammarExercise, level: EnglishLevel) {
  const length = exercise.tokens.length;
  const range = preferredTokenRange(level);
  if (length < range.min) return (range.min - length) * 10 + 4;
  if (length > range.max) return (length - range.max) * 8 + 3;
  return Math.abs(length - range.ideal);
}

function sortByLevelFit(exercises: GrammarExercise[], level: EnglishLevel) {
  return [...exercises].sort((a, b) => {
    const score = levelFitScore(a, level) - levelFitScore(b, level);
    if (score !== 0) return score;
    return a.tokens.length - b.tokens.length;
  });
}

function nowIso() {
  return new Date().toISOString();
}

function buildBank(exercise: GrammarExercise, allExercises: GrammarExercise[]): string[] {
  const ownLower = new Set(exercise.tokens.map((t) => t.toLowerCase()));
  const pool = allExercises
    .filter((other) => other.id !== exercise.id)
    .flatMap((other) => other.tokens)
    .filter((token) => !ownLower.has(token.toLowerCase()));

  const uniquePool = Array.from(new Set(pool));
  const distractors = shuffle(uniquePool).slice(0, distractorCountFor(exercise.tokens.length));
  return shuffle([...exercise.tokens, ...distractors]);
}

export const grammarPracticeService = {
  getLastOptions() {
    return getMemory().lastOptions || null;
  },

  joinTokens(tokens: string[], language: LearningLanguageCode): string {
    if (language === "ja" || language === "ko" || language === "zh") return tokens.join("");
    return tokens.join(" ");
  },

  sentenceText(exercise: GrammarExercise, language: LearningLanguageCode): string {
    return exercise.textTarget.trim() || this.joinTokens(exercise.tokens, language);
  },

  isCorrectArrangement(tokens: string[], exercise: GrammarExercise, language: LearningLanguageCode): boolean {
    if (tokens.length !== exercise.tokens.length) return false;
    return normalizeAnswer(this.joinTokens(tokens, language), language) === normalizeAnswer(this.sentenceText(exercise, language), language);
  },

  async fetchExercises(language: LearningLanguageCode, level: EnglishLevel, limit: number) {
    const params = new URLSearchParams({ language, level, limit: String(limit) });
    const response = await fetch(`/api/grammar/exercises?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load grammar exercises (${response.status})`);
    const data = (await response.json()) as { source?: "database" | "generated" | "empty"; exercises?: ApiExercise[] };
    return {
      source: data.source || "empty",
      exercises: (data.exercises || [])
        .map((item) => ({
          ...item,
          textTarget: String(item.textTarget || "").trim(),
          textZh: String(item.textZh || "").trim(),
        }))
        .filter((item) => item.textTarget && item.textZh && Array.isArray(item.tokens) && item.tokens.length >= 3),
    };
  },

  async buildSession(options: {
    language: LearningLanguageCode;
    level: EnglishLevel;
    count: number;
    reviewWrongPercent: number;
  }): Promise<GrammarSessionResult> {
    const requestLimit = Math.max(40, options.count * 3);
    const { source, exercises } = await this.fetchExercises(options.language, options.level, requestLimit);

    const memory = getMemory();
    memory.lastOptions = { language: options.language, count: options.count, reviewWrongPercent: options.reviewWrongPercent };
    saveMemory(memory);

    const levelMatchedExercises = sortByLevelFit(exercises, options.level);

    const withKeys = levelMatchedExercises.map((exercise) => ({
      exercise,
      key: normalizeKey(options.language, exercise.textTarget),
    }));

    const wrongPool = withKeys
      .filter((item) => (memory.byKey[item.key]?.wrongCount || 0) > 0)
      .sort((a, b) => (memory.byKey[b.key]?.wrongCount || 0) - (memory.byKey[a.key]?.wrongCount || 0));
    const freshCandidates = withKeys.filter((item) => !(memory.byKey[item.key]?.wrongCount > 0));
    const freshPool = options.level === "Beginner" || options.level === "Elementary" ? freshCandidates : shuffle(freshCandidates);

    const wantWrong = Math.min(wrongPool.length, Math.round((options.count * options.reviewWrongPercent) / 100));
    const selected = wrongPool.slice(0, wantWrong);
    const usedIds = new Set(selected.map((item) => item.exercise.id));

    for (const item of freshPool) {
      if (selected.length >= options.count) break;
      if (usedIds.has(item.exercise.id)) continue;
      selected.push(item);
      usedIds.add(item.exercise.id);
    }
    for (const item of wrongPool) {
      if (selected.length >= options.count) break;
      if (usedIds.has(item.exercise.id)) continue;
      selected.push(item);
      usedIds.add(item.exercise.id);
    }

    const finalExercises = shuffle(selected).slice(0, options.count).map((item) => item.exercise);
    const questions: GrammarQuestion[] = finalExercises.map((exercise) => ({
      exercise,
      bank: buildBank(exercise, finalExercises),
    }));

    return {
      source,
      session: {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        language: options.language,
        level: options.level,
        count: options.count,
        reviewWrongPercent: options.reviewWrongPercent,
        startedAt: nowIso(),
        questions,
      },
    };
  },

  recordMistake(language: LearningLanguageCode, exercise: GrammarExercise) {
    const memory = getMemory();
    const key = normalizeKey(language, exercise.textTarget);
    const previous = memory.byKey[key] || { language, wrongCount: 0, seen: 0, lastSeenAt: nowIso() };
    memory.byKey[key] = { ...previous, wrongCount: previous.wrongCount + 1, lastSeenAt: nowIso() };
    saveMemory(memory);
  },

  recordCompletion(language: LearningLanguageCode, exercise: GrammarExercise, mistakes: number) {
    const memory = getMemory();
    const key = normalizeKey(language, exercise.textTarget);
    const previous = memory.byKey[key] || { language, wrongCount: 0, seen: 0, lastSeenAt: nowIso() };
    const wrongCount = mistakes === 0 ? Math.max(0, previous.wrongCount - 1) : previous.wrongCount;
    memory.byKey[key] = { ...previous, wrongCount, seen: previous.seen + 1, lastSeenAt: nowIso() };
    saveMemory(memory);
  },

  completeSession(session: GrammarSession, results: GrammarQuestionResult[]): GrammarScore {
    const total = session.questions.length;
    const totalMistakes = results.reduce((sum, item) => sum + item.mistakes, 0);
    const totalTokens = session.questions.reduce((sum, q) => sum + q.exercise.tokens.length, 0);
    const perfectCount = results.filter((item) => item.mistakes === 0).length;
    const accuracy = totalTokens + totalMistakes > 0 ? Math.round((100 * totalTokens) / (totalTokens + totalMistakes)) : 100;
    const sentenceLines = session.questions.map((question) => ({
      role: "user" as const,
      en: this.sentenceText(question.exercise, session.language),
      zh: question.exercise.textZh,
    }));

    learningService.addRecord({
      type: "grammar",
      targetLanguage: session.language,
      title: `文法練習 · ${session.level}`,
      enContent: sentenceLines.map((line) => line.en).join(" / "),
      zhContent: sentenceLines.map((line) => line.zh).join(" / "),
      userAnswer: sentenceLines.map((line) => line.en).join(" / "),
      suggestion: "已保存本次排句練習句子，可在學習紀錄查看中文並播放。",
      transcript: sentenceLines,
      score: accuracy,
      completed: true,
      minutes: Math.max(1, Math.round(total * 0.6)),
    });

    return { score: accuracy, correct: perfectCount, total, accuracy, totalMistakes };
  },
};
