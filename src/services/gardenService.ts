import type {
  GardenActivityLog,
  GardenCrop,
  GardenLeagueEntry,
  GardenPlot,
  GardenReviewCard,
  GardenShopItem,
  GardenState,
  LearningLanguageCode,
  SavedWord,
} from "@/types";
import { KEYS, storageService } from "./storageService";

const PLOT_COUNT = 6;
const LANGUAGE_CODES: LearningLanguageCode[] = ["en", "ja", "ko", "it", "es"];
const STARTER_HOUSE_ID = "hut-house";
const STARTER_OUTFIT_ID = "starter-outfit";

export const GARDEN_SHOP_ITEMS: GardenShopItem[] = [
  {
    id: STARTER_HOUSE_ID,
    category: "house",
    name: "茅屋",
    emoji: "🏚️",
    price: 0,
    description: "初始房子，每位練習者一開始就擁有。",
    imageSrc: "/assets/garden/house-hut.png",
  },
  {
    id: "wood-house",
    category: "house",
    name: "溫馨木屋",
    emoji: "🏡",
    price: 180,
    description: "溫暖的小木屋，適合穩定練習的學習者。",
    imageSrc: "/assets/garden/house-cottage.png",
  },
  {
    id: "flower-house",
    category: "house",
    name: "花園小屋",
    emoji: "🏠",
    price: 320,
    description: "帶花圃的小屋，讓農場更有完成感。",
    imageSrc: "/assets/garden/house-garden.png",
  },
  {
    id: "town-house",
    category: "house",
    name: "陽台公寓",
    emoji: "🏘️",
    price: 520,
    description: "有陽台與花盆的進階住屋，適合長期練習者。",
    imageSrc: "/assets/garden/house-town.png",
  },
  {
    id: "villa-house",
    category: "house",
    name: "星光別墅",
    emoji: "🏛️",
    price: 760,
    description: "高級住屋，象徵穩定累積與高分成果。",
    imageSrc: "/assets/garden/house-villa.png",
  },
  {
    id: "study-desk",
    category: "item",
    name: "珍珠奶茶",
    emoji: "🧋",
    price: 80,
    description: "練習後的小獎勵，放在農場讓畫面更可愛。",
    imageSrc: "/assets/garden/item-boba.png",
  },
  {
    id: "mailbox",
    category: "item",
    name: "藍色機車",
    emoji: "🛵",
    price: 150,
    description: "適合問路、旅行與日常通勤場景。",
    imageSrc: "/assets/garden/item-scooter.png",
  },
  {
    id: "windmill",
    category: "item",
    name: "復古重機",
    emoji: "🏍️",
    price: 240,
    description: "讓農場多一點冒險感，也象徵勇敢開口。",
    imageSrc: "/assets/garden/item-motorcycle.png",
  },
  {
    id: "green-jeep",
    category: "item",
    name: "綠色越野車",
    emoji: "🚙",
    price: 360,
    description: "適合旅行闖關感，完成更多練習後可解鎖。",
    imageSrc: "/assets/garden/item-jeep.png",
  },
  {
    id: "yellow-sport-car",
    category: "item",
    name: "黃色跑車",
    emoji: "🏎️",
    price: 520,
    description: "高階獎勵商品，代表連續練習與高分成就。",
    imageSrc: "/assets/garden/item-sport-car.png",
  },
  {
    id: STARTER_OUTFIT_ID,
    category: "outfit",
    name: "原始公仔",
    emoji: "🐥",
    price: 0,
    description: "小小學伴的初始穿搭。",
    imageSrc: "/assets/garden/doll-base.png",
    dollImageSrc: "/assets/garden/doll-base.png",
  },
  {
    id: "academy-vest",
    category: "outfit",
    name: "學院背包套裝",
    emoji: "🎒",
    price: 90,
    description: "適合專心練單字與測驗的造型。",
    imageSrc: "/assets/garden/outfit-school.png",
    dollImageSrc: "/assets/garden/doll-school.png",
  },
  {
    id: "cafe-apron",
    category: "outfit",
    name: "料理老師套裝",
    emoji: "👩‍🍳",
    price: 110,
    description: "很適合餐廳、咖啡廳場景練習。",
    imageSrc: "/assets/garden/outfit-chef.png",
    dollImageSrc: "/assets/garden/doll-chef.png",
  },
  {
    id: "sport-outfit",
    category: "outfit",
    name: "運動活力套裝",
    emoji: "🎾",
    price: 120,
    description: "適合每日挑戰與闖關練習的活力造型。",
    imageSrc: "/assets/garden/outfit-sport.png",
    dollImageSrc: "/assets/garden/doll-sport.png",
  },
  {
    id: "rain-outfit",
    category: "outfit",
    name: "雨天散步套裝",
    emoji: "☂️",
    price: 130,
    description: "適合天氣、問路與旅行情境的可愛雨衣。",
    imageSrc: "/assets/garden/outfit-rain.png",
    dollImageSrc: "/assets/garden/doll-rain.png",
  },
  {
    id: "pajama-outfit",
    category: "outfit",
    name: "星月睡衣套裝",
    emoji: "🌙",
    price: 120,
    description: "放鬆練習時的柔和造型，適合睡前複習。",
    imageSrc: "/assets/garden/outfit-pajama.png",
    dollImageSrc: "/assets/garden/doll-pajama.png",
  },
  {
    id: "star-pin",
    category: "accessory",
    name: "小鴨髮帶",
    emoji: "🌼",
    price: 60,
    description: "答對題目時會更有成就感的小飾品。",
    imageSrc: "/assets/garden/accessory-headband.png",
  },
  {
    id: "round-glasses",
    category: "accessory",
    name: "圓框眼鏡",
    emoji: "👓",
    price: 75,
    description: "讓小小學伴多一點讀書氣質。",
    imageSrc: "/assets/garden/accessory-glasses.png",
  },
  {
    id: "mini-bag",
    category: "accessory",
    name: "蝴蝶小包",
    emoji: "👜",
    price: 95,
    description: "適合旅行、問路、機場場景的配件。",
    imageSrc: "/assets/garden/item-bag.png",
  },
  {
    id: "duck-headphones",
    category: "accessory",
    name: "小鴨耳機",
    emoji: "🎧",
    price: 105,
    description: "適合聽力與口說練習，讓學伴更有陪伴感。",
    imageSrc: "/assets/garden/accessory-headphones.png",
  },
];

const simulatedLeaguePlayers: GardenLeagueEntry[] = [
  { id: "sim-mia", name: "Mia", avatar: "🙂", dailyCoins: 72, monthlyCoins: 860, totalCoins: 1420 },
  { id: "sim-leo", name: "Leo", avatar: "😎", dailyCoins: 64, monthlyCoins: 790, totalCoins: 1310 },
  { id: "sim-hana", name: "Hana", avatar: "😊", dailyCoins: 58, monthlyCoins: 930, totalCoins: 1500 },
  { id: "sim-kai", name: "Kai", avatar: "🤓", dailyCoins: 43, monthlyCoins: 640, totalCoins: 980 },
  { id: "sim-sofia", name: "Sofia", avatar: "😄", dailyCoins: 36, monthlyCoins: 710, totalCoins: 1050 },
];

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

function monthKey() {
  return new Date().toISOString().slice(0, 7);
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
  const today = todayKey();
  const month = monthKey();
  const isSameDay = raw?.leagueDay === today;
  const isSameMonth = raw?.leagueMonth === month;
  const ownedItemIds = Array.from(new Set([STARTER_HOUSE_ID, STARTER_OUTFIT_ID, ...(raw?.ownedItemIds || [])]));
  const equippedHouseId = ownedItemIds.includes(raw?.equippedHouseId || "") ? raw?.equippedHouseId || STARTER_HOUSE_ID : STARTER_HOUSE_ID;
  const equippedOutfitId = ownedItemIds.includes(raw?.equippedOutfitId || "") ? raw?.equippedOutfitId || STARTER_OUTFIT_ID : STARTER_OUTFIT_ID;
  const equippedItemIds = (raw?.equippedItemIds || []).filter((id) => ownedItemIds.includes(id));
  const equippedAccessoryIds = (raw?.equippedAccessoryIds || []).filter((id) => ownedItemIds.includes(id)).slice(0, 3);
  return {
    language,
    level: levelFromXp(xp),
    xp,
    water: raw?.water ?? 5,
    seeds: raw?.seeds ?? 3,
    coins: raw?.coins ?? 0,
    dailyCoins: isSameDay ? raw?.dailyCoins ?? 0 : 0,
    monthlyCoins: isSameMonth ? raw?.monthlyCoins ?? 0 : 0,
    leagueDay: today,
    leagueMonth: month,
    leagueRewardsClaimed: {
      daily: isSameDay ? raw?.leagueRewardsClaimed?.daily : undefined,
      monthly: isSameMonth ? raw?.leagueRewardsClaimed?.monthly : undefined,
    },
    harvests: raw?.harvests ?? 0,
    harvestByCrop: raw?.harvestByCrop ?? {},
    ownedItemIds,
    equippedHouseId,
    equippedItemIds,
    equippedOutfitId,
    equippedAccessoryIds,
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

function addCoins(state: GardenState, amount: number, countForLeague = true) {
  state.coins += amount;
  if (countForLeague) {
    state.dailyCoins += amount;
    state.monthlyCoins += amount;
  }
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

function userLeagueEntry(name = "You"): GardenLeagueEntry {
  const all = getAllStates();
  const states = LANGUAGE_CODES.map((code) => normalizeState(all[code], code));
  return {
    id: "current-user",
    name,
    avatar: "🙂",
    dailyCoins: states.reduce((sum, state) => sum + state.dailyCoins, 0),
    monthlyCoins: states.reduce((sum, state) => sum + state.monthlyCoins, 0),
    totalCoins: states.reduce((sum, state) => sum + state.coins, 0),
    isCurrentUser: true,
  };
}

function rankEntries(entries: GardenLeagueEntry[], key: "dailyCoins" | "monthlyCoins" | "totalCoins") {
  return [...entries].sort((a, b) => b[key] - a[key]);
}

function getShopItem(itemId?: string) {
  return GARDEN_SHOP_ITEMS.find((item) => item.id === itemId);
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
    addCoins(state, coinGain);
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
    const coinGain = Math.max(1, Math.ceil(matchedPairs / 2));
    state.water += waterGain;
    state.seeds += 1;
    addCoins(state, coinGain);
    state.xp += matchedPairs * 10;
    pushLog(state, "review", "翻牌複習完成", `配對 ${matchedPairs} 組，獲得 ${waterGain} 水滴、${coinGain} 金幣、1 顆種子。`);
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

  getLeague(userName?: string) {
    const entries = [userLeagueEntry(userName), ...simulatedLeaguePlayers];
    return {
      daily: rankEntries(entries, "dailyCoins"),
      monthly: rankEntries(entries, "monthlyCoins"),
      total: rankEntries(entries, "totalCoins"),
    };
  },

  getUserRank(userName: string | undefined, kind: "daily" | "monthly" | "total") {
    const key = kind === "daily" ? "dailyCoins" : kind === "monthly" ? "monthlyCoins" : "totalCoins";
    const entries = rankEntries([userLeagueEntry(userName), ...simulatedLeaguePlayers], key);
    return entries.findIndex((entry) => entry.isCurrentUser) + 1;
  },

  canClaimLeagueReward(language: LearningLanguageCode, type: "daily" | "monthly", userName?: string) {
    const state = this.getState(language);
    const key = type === "daily" ? todayKey() : monthKey();
    const rank = this.getUserRank(userName, type);
    return rank === 1 && state.leagueRewardsClaimed[type] !== key;
  },

  claimLeagueReward(language: LearningLanguageCode, type: "daily" | "monthly", userName?: string) {
    const state = this.getState(language);
    if (!this.canClaimLeagueReward(language, type, userName)) return state;
    const reward = type === "daily" ? 100 : 300;
    const key = type === "daily" ? todayKey() : monthKey();
    addCoins(state, reward, false);
    state.leagueRewardsClaimed[type] = key;
    pushLog(state, "harvest", type === "daily" ? "日冠軍獎勵" : "月冠軍獎勵", `獲得 ${reward} 金幣。`);
    return saveState(state);
  },

  buyItem(language: LearningLanguageCode, itemId: string) {
    const state = this.getState(language);
    const item = getShopItem(itemId);
    if (!item || state.ownedItemIds.includes(item.id) || state.coins < item.price) return state;
    state.coins -= item.price;
    state.ownedItemIds = Array.from(new Set([...state.ownedItemIds, item.id]));
    pushLog(state, "harvest", "商店購買", `購買「${item.name}」，花費 ${item.price} 金幣。`);
    return saveState(this.equipItemState(state, item.id));
  },

  equipItem(language: LearningLanguageCode, itemId: string) {
    const state = this.getState(language);
    if (!state.ownedItemIds.includes(itemId)) return state;
    return saveState(this.equipItemState(state, itemId));
  },

  equipItemState(state: GardenState, itemId: string) {
    const item = getShopItem(itemId);
    if (!item) return state;
    if (item.category === "house") state.equippedHouseId = item.id;
    if (item.category === "outfit") state.equippedOutfitId = item.id;
    if (item.category === "item") {
      state.equippedItemIds = state.equippedItemIds.includes(item.id)
        ? state.equippedItemIds.filter((id) => id !== item.id)
        : [...state.equippedItemIds, item.id].slice(-3);
    }
    if (item.category === "accessory") {
      state.equippedAccessoryIds = state.equippedAccessoryIds.includes(item.id)
        ? state.equippedAccessoryIds.filter((id) => id !== item.id)
        : [...state.equippedAccessoryIds, item.id].slice(-3);
    }
    return state;
  },

  getShopItem,

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
