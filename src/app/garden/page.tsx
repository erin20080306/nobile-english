"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Gift,
  Home,
  Languages,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import type { GardenPlot, GardenReviewCard, GardenState, LearningLanguageCode } from "@/types";
import { LEARNING_LANGUAGES, getLearningLanguage } from "@/data/learningLanguages";
import { gardenService, GARDEN_CROPS } from "@/services/gardenService";
import { learningService } from "@/services/learningService";
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
  if (!plot.cropId) return "🟫";
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

  useEffect(() => {
    const current = learningService.getCurrentLanguage();
    setLanguage(current);
    setGarden(gardenService.getState(current));
  }, []);

  const currentLanguage = getLearningLanguage(language);
  const canClaim = garden ? gardenService.canClaimDailyBonus(language) : false;
  const advice = garden ? gardenService.getAdvice(garden) : "";
  const pairCount = useMemo(() => new Set(deck.map((card) => card.pairId)).size, [deck]);

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
    setGarden(gardenService.claimDailyBonus(language));
  }

  function plant(plotId: number) {
    setGarden(gardenService.plantCrop(language, plotId, selectedCrop));
  }

  function water(plotId: number) {
    setGarden(gardenService.waterPlot(language, plotId));
  }

  function waterAll() {
    setGarden(gardenService.waterAll(language));
  }

  function harvest(plotId: number) {
    setGarden(gardenService.harvestPlot(language, plotId));
  }

  function harvestAll() {
    setGarden(gardenService.harvestAll(language));
  }

  function startReview() {
    setDeck(buildDeck(language));
    setSelected([]);
    setMatchedPairs([]);
    setReviewClaimed(false);
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
    setGarden(gardenService.completeReviewGame(language, pairCount));
    setReviewClaimed(true);
  }

  if (!ready || !user || !garden) {
    return <div className="p-10 text-center text-inkSoft">載入語言小農場…</div>;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col pb-2">
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
        <GardenStat label="水滴" value={garden.water} emoji="💧" />
        <GardenStat label="種子" value={garden.seeds} emoji="🌰" />
        <GardenStat label="收成" value={garden.harvests} emoji="🧺" />
        <GardenStat label="等級" value={garden.level} emoji="⭐" />
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
            </div>
            <button onClick={startReview} className="h-11 w-11 rounded-2xl bg-lilac text-lilacDeep flex items-center justify-center">
              <RotateCcw size={18} />
            </button>
          </div>

          {deck.length === 0 ? (
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
      <div className="rounded-[24px] bg-gradient-to-b from-[#fff8ef] to-[#e7f8e7] px-3 pt-4 pb-3 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/80 text-4xl shadow-softer">
          {plot.harvestReady ? crop?.emoji || "🌾" : cropStage(plot)}
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
