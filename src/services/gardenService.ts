import type {
  GardenActivityLog,
  GardenCrop,
  GardenPlot,
  GardenReviewCard,
  GardenState,
  LearningLanguageCode,
  SavedWord,
} from "@/types";
import { KEYS, storageService } from "./storageService";

const PLOT_COUNT = 6;

export const GARDEN_CROPS: GardenCrop[] = [
  {
    id: "word-sprout",
    name: "單字芽",
    enName: "Word Sprout",
    emoji: "🌱",
    color: "from-mint to-[#F8FFF6]",
    description: "代表新學單字，字彙量像嫩芽一樣慢慢長大。",
    rewardCoins: 8,
  },
  {
    id: "sentence-tomato",
    name: "句型番茄",
    enName: "Sentence Tomato",
    emoji: "🍅",
    color: "from-peach to-[#FFF6F0]",
    description: "代表句型練習，例如點餐、問路、打招呼常用句。",
    rewardCoins: 12,
  },
  {
    id: "dialogue-corn",
    name: "對話玉米",
    enName: "Dialogue Corn",
    emoji: "🌽",
    color: "from-[#FFE39C] to-[#FFF9E8]",
    description: "代表完成一輪情境對話，一句一句累積口說反應。",
    rewardCoins: 14,
  },
  {
    id: "voice-berry",
    name: "發音莓果",
    enName: "Voice Berry",
    emoji: "🫐",
    color: "from-sky to-[#F3FAFF]",
    description: "代表語音輸入、朗讀與發音細節，適合反覆練習。",
    rewardCoins: 10,
  },
  {
    id: "review-carrot",
    name: "複習蘿蔔",
    enName: "Review Carrot",
    emoji: "🥕",
    color: "from-[#FFD4B8] to-[#FFF5EF]",
    description: "代表翻牌、填空、回顧練習，把學過內容重新想起來。",
    rewardCoins: 11,
  },
  {
    id: "exam-flower",
    name: "測驗花",
    enName: "Quiz Flower",
    emoji: "🌼",
    color: "from-lilac to-[#FBF8FF]",
    description: "代表測驗成果，答題越穩，花就開得越漂亮。",
    rewardCoins: 16,
  },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

function defaultPlots(): GardenPlot[] {
  return Array.from({ length: PLOT_COUNT }, (_, index) => ({
    id: index,
    growth: 0,
  }));
}

function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(xp / 120) + 1);
}

function normalizeState(raw: Partial<GardenState> | undefined, language: LearningLanguageCode): GardenState {
  const plots = (raw?.plots || defaultPlots()).slice(0, PLOT_COUNT);
  while (plots.length < PLOT_COUNT) plots.push({ id: plots.length, growth: 0 });
  const xp = raw?.xp ?? 0;
  return {
    language,
    level: levelFromXp(xp),
    xp,
    water: raw?.water ?? 5,
    seeds: raw?.seeds ?? 3,
    coins: raw?.coins ?? 0,
    harvests: raw?.harvests ?? 0,
    harvestByCrop: raw?.harvestByCrop ?? {},
    lastDailyBonusAt: raw?.lastDailyBonusAt,
    plots: plots.map((plot, index) => ({
      id: index,
      cropId: plot.cropId,
      growth: Math.max(0, Math.min(100, plot.growth || 0)),
      plantedAt: plot.plantedAt,
      wateredAt: plot.wateredAt,
      harvestReady: Boolean(plot.harvestReady || (plot.cropId && plot.growth >= 100)),
    })),
    log: (raw?.log || []).slice(0, 20),
  };
}

function pushLog(state: GardenState, type: GardenActivityLog["type"], title: string, detail: string) {
  state.log = [{ id: makeId(), type, title, detail, at: nowIso() }, ...state.log].slice(0, 20);
}

function getAllStates(): Partial<Record<LearningLanguageCode, GardenState>> {
  return storageService.get<Partial<Record<LearningLanguageCode, GardenState>>>(KEYS.gardenStates, {});
}

function saveState(state: GardenState) {
  const all = getAllStates();
  const next = { ...state, level: levelFromXp(state.xp) };
  all[state.language] = next;
  storageService.set(KEYS.gardenStates, all);
  return next;
}

function uniqueCards(cards: GardenReviewCard[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.language}:${card.word.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(card.word.trim() && card.meaning.trim());
  });
}

function savedWordBelongsToLanguage(word: SavedWord, language: LearningLanguageCode) {
  if (language === "en") return !word.language || word.language === "en";
  return word.language === language;
}

function hasPreciseMeaning(word: SavedWord) {
  const meaning = word.zh.trim();
  return Boolean(
    meaning &&
      !meaning.includes("練習詞") &&
      !meaning.includes("請搭配") &&
      !meaning.includes("情境對話常見") &&
      !meaning.includes("常見名詞或名稱")
  );
}

export const gardenService = {
  getState(language: LearningLanguageCode): GardenState {
    const all = getAllStates();
    return normalizeState(all[language], language);
  },

  canClaimDailyBonus(language: LearningLanguageCode) {
    return this.getState(language).lastDailyBonusAt !== todayKey();
  },

  claimDailyBonus(language: LearningLanguageCode) {
    const state = this.getState(language);
    if (state.lastDailyBonusAt === todayKey()) return state;
    state.lastDailyBonusAt = todayKey();
    state.water += 5;
    state.seeds += 1;
    state.xp += 8;
    pushLog(state, "daily", "每日補給", `獲得 5 水滴、1 顆種子。`);
    return saveState(state);
  },

  rewardForLearning(language: LearningLanguageCode, minutes: number, xp: number) {
    const state = this.getState(language);
    const waterGain = Math.max(1, Math.min(8, Math.ceil(minutes / 3)));
    const seedGain = xp >= 20 ? 1 : 0;
    state.water += waterGain;
    state.seeds += seedGain;
    state.xp += Math.max(5, Math.round(xp * 0.35));
    pushLog(
      state,
      "learning",
      "學習獎勵",
      `完成練習，獲得 ${waterGain} 水滴${seedGain ? "、1 顆種子" : ""}。`
    );
    return saveState(state);
  },

  plantCrop(language: LearningLanguageCode, plotId: number, cropId: string) {
    const state = this.getState(language);
    const plot = state.plots.find((item) => item.id === plotId);
    if (!plot || plot.cropId || state.seeds <= 0) return state;
    const crop = this.getCrop(cropId) || GARDEN_CROPS[0];
    plot.cropId = crop.id;
    plot.growth = 10;
    plot.plantedAt = nowIso();
    plot.harvestReady = false;
    state.seeds -= 1;
    state.xp += 4;
    pushLog(state, "plant", "播種成功", `種下「${crop.name}」。`);
    return saveState(state);
  },

  waterPlot(language: LearningLanguageCode, plotId: number) {
    const state = this.getState(language);
    const plot = state.plots.find((item) => item.id === plotId);
    if (!plot?.cropId || state.water <= 0 || plot.harvestReady) return state;
    const crop = this.getCrop(plot.cropId);
    plot.growth = Math.min(100, plot.growth + 30);
    plot.wateredAt = nowIso();
    plot.harvestReady = plot.growth >= 100;
    state.water -= 1;
    state.xp += plot.harvestReady ? 12 : 5;
    pushLog(state, "water", plot.harvestReady ? "可以收成了" : "澆水完成", `${crop?.name || "作物"} 成長到 ${plot.growth}%。`);
    return saveState(state);
  },

  waterAll(language: LearningLanguageCode) {
    let state = this.getState(language);
    for (const plot of state.plots) {
      if (state.water <= 0) break;
      if (plot.cropId && !plot.harvestReady) state = this.waterPlot(language, plot.id);
    }
    return state;
  },

  harvestPlot(language: LearningLanguageCode, plotId: number) {
    const state = this.getState(language);
    const plot = state.plots.find((item) => item.id === plotId);
    if (!plot?.cropId || !plot.harvestReady) return state;
    const crop = this.getCrop(plot.cropId);
    state.harvests += 1;
    const cropId = crop?.id || plot.cropId;
    const coinGain = crop?.rewardCoins ?? 10;
    state.coins += coinGain;
    if (cropId) state.harvestByCrop[cropId] = (state.harvestByCrop[cropId] || 0) + 1;
    state.seeds += 1;
    state.water += 1;
    state.xp += 18;
    pushLog(state, "harvest", "收成完成", `收成「${crop?.name || "作物"}」，獲得 ${coinGain} 金幣、1 顆種子。`);
    plot.cropId = undefined;
    plot.growth = 0;
    plot.plantedAt = undefined;
    plot.wateredAt = undefined;
    plot.harvestReady = false;
    return saveState(state);
  },

  harvestAll(language: LearningLanguageCode) {
    let state = this.getState(language);
    for (const plot of state.plots) {
      if (plot.cropId && plot.harvestReady) state = this.harvestPlot(language, plot.id);
    }
    return state;
  },

  completeReviewGame(language: LearningLanguageCode, matchedPairs: number) {
    const state = this.getState(language);
    const waterGain = Math.max(2, matchedPairs);
    state.water += waterGain;
    state.seeds += 1;
    state.coins += Math.max(1, Math.ceil(matchedPairs / 2));
    state.xp += matchedPairs * 10;
    pushLog(state, "review", "翻牌複習完成", `配對 ${matchedPairs} 組，獲得 ${waterGain} 水滴、1 顆種子。`);
    return saveState(state);
  },

  getReviewCards(language: LearningLanguageCode, limit = 4): GardenReviewCard[] {
    const saved = storageService.get<SavedWord[]>(KEYS.savedWords, [])
      .filter((word) => savedWordBelongsToLanguage(word, language) && hasPreciseMeaning(word))
      .map((word) => ({
        id: `${language}-saved-${word.word}`,
        word: word.word,
        meaning: word.zh,
        language,
      }));
    const cards = uniqueCards(saved);
    return cards.slice(0, limit);
  },

  getReviewCardCount(language: LearningLanguageCode): number {
    return this.getReviewCards(language, 999).length;
  },

  getCrop(cropId?: string) {
    return GARDEN_CROPS.find((crop) => crop.id === cropId);
  },

  getAdvice(state: GardenState) {
    if (state.harvests >= 8) return "收成很穩定，可以挑戰較長場景，把句子說完整。";
    if (state.water <= 1) return "完成一段對話或場景就能補水，先去練 5 分鐘再回來澆水。";
    if (state.seeds <= 0) return "翻牌複習或完成練習可以拿種子，適合複習最近學過的單字。";
    return "今天狀態不錯，建議先播種，再用翻牌複習把單字記牢。";
  },
};
