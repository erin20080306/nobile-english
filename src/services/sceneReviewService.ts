import type { LearningLanguageCode, Scene, SceneReviewCheck, SceneReviewTask, TutorFeedback } from "@/types";
import { dictionaryService } from "@/services/dictionaryService";
import { KEYS, storageService } from "@/services/storageService";

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesToken(sentence: string, word: string, language: LearningLanguageCode) {
  if (language === "en" || language === "it" || language === "es") {
    return new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(sentence);
  }
  return sentence.includes(word);
}

function blankWord(sentence: string, word: string, language: LearningLanguageCode) {
  if (!sentence) return "____";
  if (language === "en" || language === "it" || language === "es") {
    return sentence.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "i"), "____");
  }
  return sentence.replace(word, "____");
}

function shuffleOptions(options: string[], answer: string) {
  const deduped = unique([answer, ...options]).slice(0, 4);
  return deduped.sort((a, b) => (a === answer ? 1 : b === answer ? -1 : a.localeCompare(b)));
}

function buildFillTasks(words: string[], sentencePool: string[], language: LearningLanguageCode): SceneReviewTask[] {
  return words.slice(0, 2).map((word, index) => {
    const sentence = sentencePool.find((s) => includesToken(s, word, language)) || sentencePool[index] || word;
    return {
      id: `fill-${index}`,
      kind: "fill",
      prompt: `單字填空：${blankWord(sentence, word, language)}`,
      answer: word,
      hint: "請填入剛剛場景用過的關鍵單字。",
    };
  });
}

function buildReplyTasks(scene: Scene): SceneReviewTask[] {
  const pairs = scene.dialogue
    .map((line, index) => {
      const nextUser = scene.dialogue.slice(index + 1).find((d) => d.speaker === "user");
      return line.speaker === "tutor" && nextUser ? { tutor: line.en, answer: nextUser.en } : null;
    })
    .filter(Boolean) as { tutor: string; answer: string }[];
  return pairs.slice(0, 2).map((pair, index) => ({
    id: `reply-${index}`,
    kind: "reply",
    prompt: `場景回覆：${pair.tutor}`,
    answer: pair.answer,
    hint: "用一句自然回覆即可，送出後會顯示參考回答。",
  }));
}

function buildChoiceTasks(words: string[], language: LearningLanguageCode): SceneReviewTask[] {
  const fallbackWords: Record<LearningLanguageCode, string[]> = {
    en: ["please", "today", "menu", "station"],
    ja: ["ください", "今日", "駅", "予約"],
    ko: ["주세요", "오늘", "역", "예약"],
    it: ["grazie", "oggi", "stazione", "prenotazione"],
    es: ["gracias", "hoy", "estacion", "reserva"],
  };
  const pool = words.length >= 4 ? words : [...words, ...fallbackWords[language]];
  return pool.slice(2, 4).map((word, index) => {
    const entry = dictionaryService.lookup(word, language).entry;
    const options = unique([word, ...pool.filter((w) => w !== word)]).slice(0, 4);
    return {
      id: `choice-${index}`,
      kind: "choice",
      prompt: `選擇正確單字：${entry?.zh || "本場景關鍵詞"}`,
      answer: word,
      options: shuffleOptions(options, word),
      hint: entry?.example,
    };
  });
}

export const sceneReviewService = {
  isDue() {
    const next = storageService.get<number>(KEYS.sceneReviewCounter, 0) + 1;
    storageService.set(KEYS.sceneReviewCounter, next);
    return next % 2 === 0;
  },

  build(
    scene: Scene,
    language: LearningLanguageCode,
    userTurns: string[],
    feedbacks: TutorFeedback[]
  ): SceneReviewCheck {
    const words = unique(scene.keyWords).slice(0, 8);
    const sentencePool = unique([
      ...scene.keyPatterns.map((p) => p.en),
      ...scene.dialogue.map((d) => d.en),
      ...userTurns,
    ]).filter(Boolean);
    const tasks: SceneReviewTask[] = [
      ...buildFillTasks(words, sentencePool, language),
      ...buildReplyTasks(scene),
      ...buildChoiceTasks(words, language),
    ];
    const avgNaturalness = feedbacks.length
      ? Math.round(feedbacks.reduce((sum, fb) => sum + fb.naturalness, 0) / feedbacks.length)
      : 78;
    const strongest =
      avgNaturalness >= 85
        ? "你能接住情境並延續對話，下一步可以把回覆說得更像真人口語。"
        : avgNaturalness >= 70
        ? "你已經能完成主要任務，建議把句尾和禮貌表達再說完整。"
        : "先穩住關鍵句型與單字，再慢慢加長回覆，會更自然。";
    const grammarTips = unique(feedbacks.map((fb) => fb.grammarTip).filter(Boolean)).slice(0, 2);
    return {
      sceneName: scene.name,
      language,
      tasks: tasks.slice(0, 6),
      advice: [
        strongest,
        `本次優先複習：${words.slice(0, 4).join("、") || scene.name}。`,
      ],
      strengthenAreas: grammarTips.length
        ? grammarTips
        : scene.keyPatterns.slice(0, 2).map((p) => `多練這句：${p.en}`),
    };
  },
};
