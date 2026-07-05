"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Flame, Award, ArrowRight, Home, TrendingUp, BookOpen, MessageSquare, ClipboardCheck, Sparkles } from "lucide-react";
import type { DialogueSuggestion, DialogueReview, SceneReviewCheck } from "@/types";
import { storageService, KEYS } from "@/services/storageService";
import { learningService } from "@/services/learningService";
import { soundService } from "@/services/soundService";
import { rewardImageForScore } from "@/data/rewardImages";
import CheerImage from "@/components/CheerImage";
import SceneReviewAssessment from "@/components/SceneReviewAssessment";
import ScoreRing from "@/components/ScoreRing";
import { Stars, ProgressBar } from "@/components/ui";

interface LastResult {
  kind: string;
  title: string;
  total: number;
  breakdown: { label: string; value: number }[];
  newWords: string[];
  reviewSentences: string[];
  conversationWords?: string[];
  suggestions?: DialogueSuggestion[];
  dialogueReview?: DialogueReview;
  sceneReview?: SceneReviewCheck;
  nextHref: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<LastResult | null>(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [rewardImage, setRewardImage] = useState("");

  useEffect(() => {
    const result = storageService.get<LastResult | null>(KEYS.lastResult, null);
    setData(result);
    setShowReview(Boolean(result?.sceneReview));
    if (result) {
      setRewardImage(rewardImageForScore(result.total));
      window.setTimeout(() => soundService.playForScore(result.total), 250);
    }
    const s = learningService.getStats();
    setXp(s.xp);
    setStreak(s.streak);
  }, []);

  if (!data) {
    return (
      <div className="p-10 text-center text-inkSoft">
        尚無成果紀錄。
        <button className="block mx-auto mt-4 btn-secondary" onClick={() => router.push("/dashboard")}>回首頁</button>
      </div>
    );
  }

  const stars = data.total >= 100 ? 3 : data.total >= 80 ? 3 : data.total >= 60 ? 2 : 1;
  const currentLang = learningService.getCurrentLanguage();
  const langName = {
    en: "英文",
    ja: "日文",
    ko: "韓文",
    it: "義大利文",
    es: "西班牙文",
    zh: "中文",
  }[currentLang] || "英文";
  const cheerText =
    data.total >= 100 ? "100分！太完美了！" :
    data.total >= 80 ? "很棒！你完成今天的任務了！" :
    data.total >= 60 ? `加油！你的${langName}正在進步。` :
    "努力一下，再練習一次會更好！";

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-10 pb-8">
      {showReview && data.sceneReview && (
        <SceneReviewAssessment review={data.sceneReview} onClose={() => setShowReview(false)} />
      )}

      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }} className="text-center">
        <span className="chip bg-mint text-mintDeep">練習完成</span>
        <h1 className="mt-3 text-2xl font-extrabold text-ink">{data.title}</h1>
      </motion.div>

      <div className="flex justify-center my-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="animate-float rounded-[32px] bg-[#fff8ef] px-5 py-4 shadow-soft border border-white/80"
        >
          <CheerImage size={210} src={rewardImage} alt={cheerText} className="rounded-[24px]" />
        </motion.div>
      </div>
      <p className="text-center text-lg font-extrabold text-peachDeep">{cheerText}</p>

      <div className="card mt-4 flex flex-col items-center">
        <ScoreRing value={data.total} label="總分" />
        <div className="mt-2"><Stars count={stars} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        {data.breakdown.map((b) => (
          <div key={b.label} className="card !p-4">
            <p className="text-sm text-inkSoft">{b.label}</p>
            <div className="mt-2"><ProgressBar value={b.value} /></div>
            <p className="text-right text-sm font-bold text-ink mt-1">{b.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="card !p-4 flex items-center gap-2">
          <Award className="text-lilacDeep" />
          <div><p className="text-xs text-inkSoft">XP 經驗值</p><p className="font-extrabold text-ink">{xp}</p></div>
        </div>
        <div className="card !p-4 flex items-center gap-2">
          <Flame className="text-peachDeep" />
          <div><p className="text-xs text-inkSoft">連續天數</p><p className="font-extrabold text-ink">{streak} 天</p></div>
        </div>
      </div>

      {data.conversationWords && data.conversationWords.length > 0 && (
        <div className="card mt-3">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={16} className="text-lilacDeep" />
            <p className="font-bold text-ink">本次對話使用的單字</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.conversationWords.map((w) => (
              <span key={w} className="chip bg-lilac/60 text-lilacDeep font-semibold">{w}</span>
            ))}
          </div>
        </div>
      )}

      {data.newWords?.length > 0 && (
        <div className="card mt-3">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-mintDeep" />
            <p className="font-bold text-ink">場景關鍵單字</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.newWords.map((w) => <span key={w} className="chip bg-mint text-mintDeep">{w}</span>)}
          </div>
        </div>
      )}

      {data.dialogueReview && (
        <div className="card mt-3">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck size={17} className="text-lilacDeep" />
            <p className="font-extrabold text-ink">對話評論</p>
          </div>
          <ReviewBlock title="文法提醒" items={data.dialogueReview.grammarPoints} tone="lilac" />
          <ReviewBlock title="建議加強" items={data.dialogueReview.strengthenAreas} tone="peach" />
          <div className="mt-3">
            <p className="text-sm font-bold text-inkSoft mb-2">本次用到的單字</p>
            <div className="flex flex-wrap gap-2">
              {data.dialogueReview.vocabularyUsed.map((w) => (
                <span key={w} className="chip bg-mint text-mintDeep">{w}</span>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <p className="text-sm font-bold text-inkSoft mb-2 flex items-center gap-1">
              <Sparkles size={14} className="text-peachDeep" /> 更道地可以這樣說
            </p>
            <ul className="space-y-2">
              {data.dialogueReview.nativeRewrites.map((s) => (
                <li key={s} className="rounded-2xl bg-cream px-3 py-2 text-sm font-semibold text-ink leading-relaxed">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {data.suggestions && data.suggestions.length > 0 && (
        <div className="card mt-3">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-peachDeep" />
            <p className="text-lg font-extrabold text-ink">個人化練習建議</p>
          </div>
          <div className="space-y-3">
            {data.suggestions.map((s, i) => (
              <div key={i} className="rounded-3xl bg-peach/30 p-4">
                <div className="mb-3 flex items-center">
                  <span className="inline-flex shrink-0 items-center rounded-2xl bg-peachDeep px-4 py-2 text-sm font-extrabold text-white shadow-softer">
                    {s.area}
                  </span>
                </div>
                <p className="text-base leading-relaxed text-ink">{s.tip}</p>
                {s.example && (
                  <p className="mt-3 rounded-2xl bg-white/70 px-3 py-2 text-base font-semibold leading-relaxed text-ink">
                    ✨ {s.example}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.reviewSentences?.length > 0 && (
        <div className="card mt-3">
          <p className="font-bold text-ink mb-2">
            {data.title.includes("餐廳") ? "餐廳場景複習句型" :
             data.title.includes("問路") ? "問路場景複習句型" :
             data.title.includes("機場") ? "機場場景複習句型" :
             data.title.includes("購物") ? "購物場景複習句型" :
             data.title.includes("面試") ? "面試場景複習句型" :
             data.title.includes("電話") ? "電話場景複習句型" :
             data.title.includes("日常") ? "日常場景複習句型" :
             data.title.includes("對話") ? "對話複習句型" :
             "建議複習句型"}
          </p>
          <ul className="space-y-1 text-sm text-ink list-disc list-inside">
            {data.reviewSentences.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-5 space-y-3">
        <button className="btn-secondary w-full flex items-center justify-center gap-2 bg-mint text-mintDeep" onClick={() => router.push("/garden")}>
          <Sparkles size={18} /> 去語言小農場澆水
        </button>
        <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => router.push(data.nextHref)}>
          下一步推薦 <ArrowRight size={18} />
        </button>
        <button className="btn-secondary w-full flex items-center justify-center gap-2" onClick={() => router.push("/dashboard")}>
          <Home size={18} /> 回到首頁
        </button>
      </div>
    </div>
  );
}

function ReviewBlock({ title, items, tone }: { title: string; items: string[]; tone: "lilac" | "peach" }) {
  const chipClass = tone === "lilac" ? "bg-lilac text-lilacDeep" : "bg-peach text-peachDeep";
  return (
    <div className="mt-3">
      <p className="text-sm font-bold text-inkSoft mb-2">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className={`rounded-2xl px-3 py-2 text-sm font-semibold leading-relaxed ${chipClass}`}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
