"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Coins,
  Crown,
  Gift,
  Home,
  Info,
  Lock,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import type { GardenLeagueEntry, GardenPlot, GardenShopCategory, GardenShopItem, GardenState, LearningLanguageCode } from "@/types";
import { LEARNING_LANGUAGES, getLearningLanguage } from "@/data/learningLanguages";
import { gardenService, GARDEN_CROPS, GARDEN_SHOP_ITEMS } from "@/services/gardenService";
import { learningService } from "@/services/learningService";
import { soundService } from "@/services/soundService";
import { useUser } from "@/hooks/useUser";
import BottomNav from "@/components/BottomNav";
import HorizontalScrollChips from "@/components/HorizontalScrollChips";
import { ProgressBar } from "@/components/ui";

type DeckCard = {
  id: string;
  pairId: string;
  kind: "word" | "meaning";
  label: string;
};

function buildDeck(language: LearningLanguageCode): DeckCard[] {
  const cards = gardenService.getReviewCards(language, 4);
  const deck = cards.flatMap((card) => [
    { id: `${card.id}-word`, pairId: card.id, kind: "word" as const, label: card.word },
    { id: `${card.id}-meaning`, pairId: card.id, kind: "meaning" as const, label: card.meaning },
  ]);
  return deck.sort(() => Math.random() - 0.5);
}

function nextLevelProgress(state: GardenState) {
  return Math.min(100, state.xp % 120 ? ((state.xp % 120) / 120) * 100 : state.xp === 0 ? 0 : 100);
}

function cropStage(plot: GardenPlot) {
  if (!plot.cropId) return "";
  if (plot.harvestReady) return "✨";
  if (plot.growth < 35) return "🌱";
  if (plot.growth < 70) return "🌿";
  return "🌾";
}

export default function GardenPage() {
  const { user, ready } = useUser({ requireOnboarded: true });
  const router = useRouter();
  const [language, setLanguage] = useState<LearningLanguageCode>("en");
  const [garden, setGarden] = useState<GardenState | null>(null);
  const [selectedCrop, setSelectedCrop] = useState(GARDEN_CROPS[0].id);
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [reviewClaimed, setReviewClaimed] = useState(false);
  const [harvestToast, setHarvestToast] = useState<{ text: string; coins: number } | null>(null);

  useEffect(() => {
    const current = learningService.getCurrentLanguage();
    setLanguage(current);
    setGarden(gardenService.getState(current));
  }, []);

  const currentLanguage = getLearningLanguage(language);
  const canClaim = garden ? gardenService.canClaimDailyBonus(language) : false;
  const advice = garden ? gardenService.getAdvice(garden) : "";
  const pairCount = useMemo(() => new Set(deck.map((card) => card.pairId)).size, [deck]);
  const reviewCardCount = gardenService.getReviewCardCount(language);
  const selectedCropInfo = gardenService.getCrop(selectedCrop) || GARDEN_CROPS[0];
  const league = gardenService.getLeague(user?.name || "你");
  const userDailyRank = gardenService.getUserRank(user?.name, "daily");
  const userMonthlyRank = gardenService.getUserRank(user?.name, "monthly");
  const canClaimDailyLeague = garden ? gardenService.canClaimLeagueReward(language, "daily", user?.name) : false;
  const canClaimMonthlyLeague = garden ? gardenService.canClaimLeagueReward(language, "monthly", user?.name) : false;
  const harvestedCrops = GARDEN_CROPS
    .map((crop) => ({ crop, count: garden?.harvestByCrop[crop.id] || 0 }))
    .filter((item) => item.count > 0);
  const equippedHouse = gardenService.getShopItem(garden?.equippedHouseId);
  const equippedOutfit = gardenService.getShopItem(garden?.equippedOutfitId);
  const equippedItems = (garden?.equippedItemIds || []).map((id) => gardenService.getShopItem(id)).filter(Boolean) as GardenShopItem[];
  const equippedAccessories = (garden?.equippedAccessoryIds || []).map((id) => gardenService.getShopItem(id)).filter(Boolean) as GardenShopItem[];
  const shopByCategory: Record<GardenShopCategory, GardenShopItem[]> = {
    house: GARDEN_SHOP_ITEMS.filter((item) => item.category === "house"),
    item: GARDEN_SHOP_ITEMS.filter((item) => item.category === "item"),
    outfit: GARDEN_SHOP_ITEMS.filter((item) => item.category === "outfit"),
    accessory: GARDEN_SHOP_ITEMS.filter((item) => item.category === "accessory"),
  };

  function refresh(nextLanguage = language) {
    setGarden(gardenService.getState(nextLanguage));
  }

  function changeLanguage(code: LearningLanguageCode) {
    setLanguage(code);
    learningService.setCurrentLanguage(code, user?.id || undefined);
    setDeck([]);
    setSelected([]);
    setMatchedPairs([]);
    setReviewClaimed(false);
    refresh(code);
  }

  function claimDaily() {
    soundService.play("review");
    setGarden(gardenService.claimDailyBonus(language));
  }

  function claimLeagueReward(type: "daily" | "monthly") {
    soundService.play("harvest");
    setGarden(gardenService.claimLeagueReward(language, type, user?.name));
  }

  function buyOrEquip(item: GardenShopItem) {
    const owned = garden?.ownedItemIds.includes(item.id);
    soundService.play(owned ? "review" : "harvest");
    setGarden(owned ? gardenService.equipItem(language, item.id) : gardenService.buyItem(language, item.id));
  }

  function plant(plotId: number) {
    soundService.play("plant");
    setGarden(gardenService.plantCrop(language, plotId, selectedCrop));
  }

  function water(plotId: number) {
    soundService.play("water");
    setGarden(gardenService.waterPlot(language, plotId));
  }

  function waterAll() {
    soundService.play("water");
    setGarden(gardenService.waterAll(language));
  }

  function harvest(plotId: number) {
    const plot = garden?.plots.find((item) => item.id === plotId);
    const crop = gardenService.getCrop(plot?.cropId);
    soundService.play("harvest");
    setGarden(gardenService.harvestPlot(language, plotId));
    if (crop) showHarvestToast(`收成 ${crop.name}`, crop.rewardCoins);
  }

  function harvestAll() {
    const ready = garden?.plots
      .filter((plot) => plot.cropId && plot.harvestReady)
      .map((plot) => gardenService.getCrop(plot.cropId))
      .filter(Boolean) || [];
    const totalCoins = ready.reduce((sum, crop) => sum + (crop?.rewardCoins || 0), 0);
    if (totalCoins > 0) soundService.play("harvest");
    setGarden(gardenService.harvestAll(language));
    if (totalCoins > 0) showHarvestToast(`收成 ${ready.length} 個作物`, totalCoins);
  }

  function startReview() {
    if (reviewCardCount < 4) return;
    soundService.play("review");
    setDeck(buildDeck(language));
    setSelected([]);
    setMatchedPairs([]);
    setReviewClaimed(false);
  }

  function showHarvestToast(text: string, coins: number) {
    setHarvestToast({ text, coins });
    window.setTimeout(() => setHarvestToast(null), 1400);
  }

  function chooseCard(card: DeckCard) {
    if (matchedPairs.includes(card.pairId) || selected.includes(card.id)) return;
    if (selected.length === 0) {
      setSelected([card.id]);
      return;
    }
    const first = deck.find((item) => item.id === selected[0]);
    if (!first) {
      setSelected([card.id]);
      return;
    }
    const isMatch = first.pairId === card.pairId && first.kind !== card.kind;
    setSelected([first.id, card.id]);
    window.setTimeout(() => {
      if (isMatch) setMatchedPairs((prev) => Array.from(new Set([...prev, card.pairId])));
      setSelected([]);
    }, isMatch ? 320 : 620);
  }

  function claimReviewReward() {
    if (reviewClaimed || pairCount === 0) return;
    soundService.play("harvest");
    setGarden(gardenService.completeReviewGame(language, pairCount));
    setReviewClaimed(true);
  }

  if (!ready || !user || !garden) {
    return <div className="p-10 text-center text-inkSoft">載入語言小農場…</div>;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col pb-2">
      {harvestToast && (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="fixed left-1/2 top-24 z-50 w-[min(360px,calc(100%-40px))] -translate-x-1/2 rounded-[28px] bg-white px-5 py-4 text-center shadow-soft border border-peach"
        >
          <motion.div
            initial={{ rotate: -10 }}
            animate={{ rotate: 8 }}
            transition={{ repeat: 3, repeatType: "reverse", duration: 0.18 }}
            className="text-4xl"
          >
            🪙
          </motion.div>
          <p className="mt-1 text-lg font-extrabold text-ink">{harvestToast.text}</p>
          <p className="text-sm font-extrabold text-peachDeep">+{harvestToast.coins} 金幣</p>
        </motion.div>
      )}

      <div className="px-5 pt-8 pb-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="h-12 w-12 rounded-3xl bg-white shadow-softer flex items-center justify-center text-ink">
          <ArrowLeft size={22} />
        </button>
        <div className="text-center">
          <p className="text-xs font-bold text-inkSoft">{currentLanguage.flag} {currentLanguage.zhName}</p>
          <h1 className="text-2xl font-extrabold text-ink">語言小農場</h1>
        </div>
        <button onClick={() => router.push("/dashboard")} className="h-12 w-12 rounded-3xl bg-white shadow-softer flex items-center justify-center text-ink">
          <Home size={21} />
        </button>
      </div>

      <div className="px-5">
        <HorizontalScrollChips>
          {LEARNING_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`rounded-3xl px-4 py-3 text-sm font-extrabold whitespace-nowrap active:scale-95 transition ${
                language === lang.code ? "bg-lilacDeep text-white shadow-soft" : "bg-white text-ink shadow-softer"
              }`}
            >
              {lang.flag} {lang.zhName}
            </button>
          ))}
        </HorizontalScrollChips>
      </div>

      <div className="px-5 mt-4">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[34px] bg-gradient-to-br from-mint via-[#fff8ef] to-peach p-5 shadow-soft border border-white/80"
        >
          <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/45" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-inkSoft">Level {garden.level}</p>
              <h2 className="text-2xl font-extrabold text-ink">今天來種一點語感</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink/75">{advice}</p>
            </div>
            <div className="text-5xl animate-float">🌻</div>
          </div>
          <div className="relative mt-4">
            <ProgressBar value={nextLevelProgress(garden)} />
            <p className="mt-1 text-xs font-bold text-inkSoft">{garden.xp % 120}/120 農場經驗</p>
          </div>
        </motion.div>
      </div>

      <div className="px-5 mt-4 grid grid-cols-4 gap-2">
        <GardenStat label="金幣" value={garden.coins} emoji="🪙" />
        <GardenStat label="水滴" value={garden.water} emoji="💧" />
        <GardenStat label="種子" value={garden.seeds} emoji="🌰" />
        <GardenStat label="收成" value={garden.harvests} emoji="🧺" />
      </div>

      <div className="px-5 mt-4">
        <div className="relative overflow-hidden rounded-[34px] bg-white p-4 shadow-soft">
          <div className="absolute -right-8 -bottom-8 h-28 w-28 rounded-full bg-mint/60" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[30px] bg-gradient-to-b from-sky to-cream text-center shadow-softer">
              <div>
                <div className="text-4xl">🙂</div>
                <div className="mt-1 text-2xl">{equippedOutfit?.emoji || "👕"}{equippedAccessories.map((item) => item.emoji).join("")}</div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-inkSoft">小小學伴</p>
              <h2 className="text-xl font-extrabold text-ink">我的語言夥伴</h2>
              <p className="mt-1 text-sm leading-relaxed text-inkSoft">
                目前穿搭：{equippedOutfit?.name || "基本上衣"}
                {equippedAccessories.length > 0 ? `，飾品 ${equippedAccessories.map((item) => item.name).join("、")}` : "，尚未配戴飾品"}
              </p>
            </div>
          </div>
          <div className="relative mt-4 rounded-[26px] bg-cream px-4 py-3">
            <p className="text-sm font-extrabold text-ink">{equippedHouse?.emoji || "🏚️"} 我的農場住屋</p>
            <p className="text-xs leading-relaxed text-inkSoft">
              練習者一開始已擁有「茅屋」，之後可以用金幣購買房子、物品、衣物與飾品。
            </p>
            {equippedItems.length > 0 && (
              <p className="mt-2 text-sm font-bold text-mintDeep">
                已擺設：{equippedItems.map((item) => `${item.emoji} ${item.name}`).join("、")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={claimDaily}
          disabled={!canClaim}
          className={`rounded-3xl px-4 py-3 text-left font-extrabold shadow-softer active:scale-95 transition ${
            canClaim ? "bg-lilacDeep text-white" : "bg-white text-inkSoft"
          }`}
        >
          <Gift size={18} className="mb-1" />
          {canClaim ? "領每日補給" : "今日已領取"}
        </button>
        <button
          onClick={waterAll}
          className="rounded-3xl bg-white px-4 py-3 text-left font-extrabold text-ink shadow-softer active:scale-95 transition"
        >
          <Sparkles size={18} className="mb-1 text-mintDeep" />
          一鍵澆水
        </button>
      </div>

      <div className="px-5 mt-4">
        <div className="rounded-[34px] bg-white p-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
            <Crown size={18} className="text-peachDeep" />
              <div>
                <h2 className="font-extrabold text-ink">金幣聯賽</h2>
                <p className="text-xs font-bold text-inkSoft">含模擬玩家，之後可改接真實所有用戶</p>
              </div>
            </div>
            <div className="rounded-2xl bg-peach px-3 py-2 text-right">
              <p className="text-[11px] font-bold text-peachDeep">你的總金幣</p>
              <p className="font-extrabold text-ink">🪙 {league.total.find((entry) => entry.isCurrentUser)?.totalCoins ?? 0}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <LeagueRewardCard
              title="日冠軍"
              reward={100}
              rank={userDailyRank}
              canClaim={canClaimDailyLeague}
              onClaim={() => claimLeagueReward("daily")}
            />
            <LeagueRewardCard
              title="月冠軍"
              reward={300}
              rank={userMonthlyRank}
              canClaim={canClaimMonthlyLeague}
              onClaim={() => claimLeagueReward("monthly")}
            />
          </div>

          <div className="mt-4 grid gap-3">
            <LeagueList title="今日排行榜" entries={league.daily.slice(0, 5)} metric="dailyCoins" />
            <LeagueList title="本月排行榜" entries={league.monthly.slice(0, 5)} metric="monthlyCoins" />
          </div>
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="rounded-[34px] bg-white p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-lilacDeep" />
            <div>
              <h2 className="font-extrabold text-ink">金幣商店</h2>
              <p className="text-xs font-bold text-inkSoft">房子、物品、衣物、飾品都可用金幣解鎖</p>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {(["house", "item", "outfit", "accessory"] as GardenShopCategory[]).map((category) => (
              <div key={category}>
                <p className="mb-2 text-sm font-extrabold text-ink">{shopCategoryLabel(category)}</p>
                <div className="grid grid-cols-2 gap-2">
                  {shopByCategory[category].map((item) => {
                    const owned = garden.ownedItemIds.includes(item.id);
                    const equipped =
                      garden.equippedHouseId === item.id ||
                      garden.equippedOutfitId === item.id ||
                      garden.equippedItemIds.includes(item.id) ||
                      garden.equippedAccessoryIds.includes(item.id);
                    const affordable = garden.coins >= item.price;
                    return (
                      <button
                        key={item.id}
                        onClick={() => buyOrEquip(item)}
                        disabled={!owned && !affordable}
                        className={`rounded-[24px] p-3 text-left shadow-softer transition active:scale-95 ${
                          equipped
                            ? "bg-mint text-mintDeep"
                            : owned
                            ? "bg-cream text-ink"
                            : affordable
                            ? "bg-white text-ink"
                            : "bg-cream/60 text-inkSoft"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-2xl">{item.emoji}</span>
                          <div className="min-w-0">
                            <p className="font-extrabold leading-tight">{item.name}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-inkSoft">{item.description}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-peachDeep">{item.price === 0 ? "初始擁有" : `🪙 ${item.price}`}</span>
                          <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-extrabold">
                            {equipped ? "使用中" : owned ? "裝備" : affordable ? "購買" : "金幣不足"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-extrabold text-ink">選擇作物</h2>
          <button onClick={harvestAll} className="chip bg-peach text-peachDeep">收成全部</button>
        </div>
        <HorizontalScrollChips className="mt-2">
          {GARDEN_CROPS.map((crop) => (
            <button
              key={crop.id}
              onClick={() => setSelectedCrop(crop.id)}
              className={`rounded-3xl px-4 py-3 text-sm font-extrabold whitespace-nowrap transition active:scale-95 ${
                selectedCrop === crop.id ? "bg-mintDeep text-white shadow-soft" : "bg-white text-ink shadow-softer"
              }`}
            >
              <span className="mr-1">{crop.emoji}</span>{crop.name}
            </button>
          ))}
        </HorizontalScrollChips>
        <div className="mt-3 rounded-[28px] bg-white p-4 shadow-softer">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cream text-2xl">
              {selectedCropInfo.emoji}
            </span>
            <div>
              <p className="font-extrabold text-ink">{selectedCropInfo.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-inkSoft">{selectedCropInfo.description}</p>
              <p className="mt-2 text-xs font-extrabold text-peachDeep">收成可得 {selectedCropInfo.rewardCoins} 金幣</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 mt-4">
        <div className="rounded-[30px] bg-white/90 p-4 shadow-softer">
          <div className="flex items-center gap-2">
            <Info size={17} className="text-lilacDeep" />
            <h2 className="font-extrabold text-ink">作物代表什麼</h2>
          </div>
          <div className="mt-3 grid gap-2">
            {GARDEN_CROPS.map((crop) => (
              <div key={crop.id} className="rounded-2xl bg-cream px-3 py-2">
                <p className="text-sm font-extrabold text-ink">{crop.emoji} {crop.name}</p>
                <p className="text-xs leading-relaxed text-inkSoft">{crop.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 mt-4 grid grid-cols-2 gap-3">
        {garden.plots.map((plot) => (
          <GardenPlotCard
            key={plot.id}
            plot={plot}
            seeds={garden.seeds}
            water={garden.water}
            onPlant={() => plant(plot.id)}
            onWater={() => water(plot.id)}
            onHarvest={() => harvest(plot.id)}
          />
        ))}
      </div>

      <div className="px-5 mt-5">
        <div className="rounded-[34px] bg-white p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-inkSoft">翻牌複習</p>
              <h2 className="text-xl font-extrabold text-ink">配對單字與意思</h2>
              <p className="mt-1 text-xs font-bold text-inkSoft">目前可用 {reviewCardCount}/4 個精準單字</p>
            </div>
            <button
              onClick={startReview}
              disabled={reviewCardCount < 4}
              className={`h-11 w-11 rounded-2xl flex items-center justify-center ${
                reviewCardCount < 4 ? "bg-cream text-inkSoft" : "bg-lilac text-lilacDeep"
              }`}
            >
              {reviewCardCount < 4 ? <Lock size={18} /> : <RotateCcw size={18} />}
            </button>
          </div>

          {reviewCardCount < 4 ? (
            <div className="mt-4 rounded-[28px] bg-cream px-4 py-5 text-center">
              <Lock className="mx-auto text-lilacDeep" size={28} />
              <p className="mt-2 font-extrabold text-ink">單字量不足，暫時無法開啟翻牌遊戲</p>
              <p className="mt-1 text-sm leading-relaxed text-inkSoft">
                需要至少 4 個「{currentLanguage.zhName}」收藏單字或加入複習的單字。請先在場景句子中點單字並收藏，多多學習後再回來挑戰。
              </p>
            </div>
          ) : deck.length === 0 ? (
            <button onClick={startReview} className="mt-4 btn-primary w-full flex items-center justify-center gap-2">
              <Star size={18} /> 開始翻牌
            </button>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {deck.map((card) => {
                  const flipped = selected.includes(card.id) || matchedPairs.includes(card.pairId);
                  return (
                    <button
                      key={card.id}
                      onClick={() => chooseCard(card)}
                      className={`min-h-[84px] rounded-3xl px-3 py-3 text-center shadow-softer transition active:scale-95 ${
                        matchedPairs.includes(card.pairId)
                          ? "bg-mint text-mintDeep"
                          : flipped
                          ? "bg-cream text-ink"
                          : "bg-lilacDeep text-white"
                      }`}
                    >
                      <span className="block text-base font-extrabold leading-snug break-words">
                        {flipped ? card.label : "?"}
                      </span>
                      {flipped && (
                        <span className="mt-1 block text-[11px] font-bold text-inkSoft">
                          {card.kind === "word" ? "單字" : "意思"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-inkSoft">
                  已配對 {matchedPairs.length}/{pairCount}
                </p>
                {matchedPairs.length === pairCount && (
                  <button
                    onClick={claimReviewReward}
                    className={`chip flex items-center gap-1 ${reviewClaimed ? "bg-mint text-mintDeep" : "bg-peach text-peachDeep"}`}
                  >
                    {reviewClaimed ? <CheckCircle2 size={15} /> : <Trophy size={15} />}
                    {reviewClaimed ? "已領獎" : "領獎"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="rounded-[30px] bg-white/80 p-4 shadow-softer">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-lilacDeep" />
            <p className="font-extrabold text-ink">最近農場紀錄</p>
          </div>
          <div className="mt-3 space-y-2">
            {garden.log.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-2xl bg-cream px-3 py-2">
                <p className="text-sm font-extrabold text-ink">{item.title}</p>
                <p className="text-xs text-inkSoft">{item.detail}</p>
              </div>
            ))}
            {garden.log.length === 0 && <p className="text-sm text-inkSoft">完成一段練習後，這裡會長出第一筆紀錄。</p>}
          </div>
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="rounded-[30px] bg-white/80 p-4 shadow-softer">
          <div className="flex items-center gap-2">
            <Coins size={18} className="text-peachDeep" />
            <p className="font-extrabold text-ink">收成明細</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {harvestedCrops.map(({ crop, count }) => (
              <span key={crop.id} className="chip bg-mint text-mintDeep">
                {crop.emoji} {crop.name} x {count}
              </span>
            ))}
            {harvestedCrops.length === 0 && (
              <p className="text-sm text-inkSoft">還沒有收成紀錄。種下作物並澆水成熟後，就會在這裡統計。</p>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

function GardenStat({ label, value, emoji }: { label: string; value: number; emoji: string }) {
  return (
    <div className="rounded-3xl bg-white px-2 py-3 text-center shadow-softer">
      <p className="text-xl">{emoji}</p>
      <p className="text-lg font-extrabold text-ink">{value}</p>
      <p className="text-[11px] font-bold text-inkSoft">{label}</p>
    </div>
  );
}

function LeagueRewardCard({
  title,
  reward,
  rank,
  canClaim,
  onClaim,
}: {
  title: string;
  reward: number;
  rank: number;
  canClaim: boolean;
  onClaim: () => void;
}) {
  return (
    <div className="rounded-[24px] bg-cream p-3">
      <p className="text-sm font-extrabold text-ink">{title}</p>
      <p className="mt-1 text-xs font-bold text-inkSoft">目前第 {rank || "-"} 名</p>
      <button
        onClick={onClaim}
        disabled={!canClaim}
        className={`mt-3 w-full rounded-2xl px-3 py-2 text-xs font-extrabold transition active:scale-95 ${
          canClaim ? "bg-peach text-peachDeep" : "bg-white text-inkSoft"
        }`}
      >
        {canClaim ? `領 ${reward} 金幣` : `冠軍可得 ${reward}`}
      </button>
    </div>
  );
}

function LeagueList({
  title,
  entries,
  metric,
}: {
  title: string;
  entries: GardenLeagueEntry[];
  metric: "dailyCoins" | "monthlyCoins" | "totalCoins";
}) {
  return (
    <div className="rounded-[24px] bg-cream p-3">
      <p className="mb-2 text-sm font-extrabold text-ink">{title}</p>
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div key={entry.id} className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${entry.isCurrentUser ? "bg-mint" : "bg-white/80"}`}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${index === 0 ? "bg-peach text-peachDeep" : "bg-white text-inkSoft"}`}>
              {index + 1}
            </span>
            <span className="text-lg">{entry.avatar}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-ink">{entry.isCurrentUser ? `${entry.name}（你）` : entry.name}</span>
            <span className="text-sm font-extrabold text-peachDeep">🪙 {entry[metric]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function shopCategoryLabel(category: GardenShopCategory) {
  const labels: Record<GardenShopCategory, string> = {
    house: "房子",
    item: "農場物品",
    outfit: "小小學伴衣服",
    accessory: "小小學伴飾品",
  };
  return labels[category];
}

function GardenPlotCard({
  plot,
  seeds,
  water,
  onPlant,
  onWater,
  onHarvest,
}: {
  plot: GardenPlot;
  seeds: number;
  water: number;
  onPlant: () => void;
  onWater: () => void;
  onHarvest: () => void;
}) {
  const crop = gardenService.getCrop(plot.cropId);
  const disabledPlant = seeds <= 0;
  const disabledWater = water <= 0 || plot.harvestReady;

  return (
    <div className="rounded-[30px] bg-white p-3 shadow-soft">
      <div className={`rounded-[24px] px-3 pt-4 pb-3 text-center ${
        plot.cropId ? "bg-gradient-to-b from-[#fff8ef] to-[#e7f8e7]" : "bg-gradient-to-b from-[#fff8ef] via-[#f6eddf] to-[#e5f5de]"
      }`}>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/80 text-4xl shadow-softer">
          {!plot.cropId ? (
            <div className="relative h-14 w-14 rounded-[18px] bg-[#9b6539] shadow-inner">
              <span className="absolute left-2 right-2 top-3 h-1 rounded-full bg-[#c58b57]" />
              <span className="absolute left-2 right-2 top-6 h-1 rounded-full bg-[#c58b57]" />
              <span className="absolute left-2 right-2 top-9 h-1 rounded-full bg-[#c58b57]" />
              <span className="absolute -right-1 -top-1 text-lg">✨</span>
            </div>
          ) : plot.harvestReady ? (
            <motion.span animate={{ y: [0, -5, 0], scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>
              {crop?.emoji || "🌾"}
            </motion.span>
          ) : (
            cropStage(plot)
          )}
        </div>
        <p className="mt-2 min-h-[24px] text-sm font-extrabold text-ink">{crop?.name || "空田地"}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-mintDeep transition-all" style={{ width: `${plot.growth}%` }} />
        </div>
        <p className="mt-1 text-[11px] font-bold text-inkSoft">{plot.growth}%</p>
      </div>
      {!plot.cropId ? (
        <button
          onClick={onPlant}
          disabled={disabledPlant}
          className={`mt-3 w-full rounded-2xl px-3 py-2 text-sm font-extrabold transition active:scale-95 ${
            disabledPlant ? "bg-cream text-inkSoft" : "bg-mint text-mintDeep"
          }`}
        >
          播種
        </button>
      ) : plot.harvestReady ? (
        <button onClick={onHarvest} className="mt-3 w-full rounded-2xl bg-peach px-3 py-2 text-sm font-extrabold text-peachDeep active:scale-95">
          收成
        </button>
      ) : (
        <button
          onClick={onWater}
          disabled={disabledWater}
          className={`mt-3 w-full rounded-2xl px-3 py-2 text-sm font-extrabold transition active:scale-95 ${
            disabledWater ? "bg-cream text-inkSoft" : "bg-sky text-skyDeep"
          }`}
        >
          澆水
        </button>
      )}
    </div>
  );
}
