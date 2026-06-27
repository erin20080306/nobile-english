"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Flame, Award, ArrowRight, Home } from "lucide-react";
import { storageService, KEYS } from "@/services/storageService";
import { learningService } from "@/services/learningService";
import { rewardImageForScore } from "@/data/rewardImages";
import CheerImage from "@/components/CheerImage";
import ScoreRing from "@/components/ScoreRing";
import { Stars, ProgressBar } from "@/components/ui";

interface LastResult {
  kind: string;
  title: string;
  total: number;
  breakdown: { label: string; value: number }[];
  newWords: string[];
  reviewSentences: string[];
  nextHref: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<LastResult | null>(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setData(storageService.get<LastResult | null>(KEYS.lastResult, null));
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

  const stars = data.total >= 85 ? 3 : data.total >= 60 ? 2 : 1;
  const cheerText =
    data.total >= 85 ? "很棒！你完成今天的任務了！" :
    data.total >= 60 ? "Great job! 你的英文正在進步。" :
    "加油！再練習一次會更自然。";
  const rewardImage = rewardImageForScore(data.total);

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-10 pb-8">
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

      {data.newWords?.length > 0 && (
        <div className="card mt-3">
          <p className="font-bold text-ink">新增單字（{data.newWords.length}）</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.newWords.map((w) => <span key={w} className="chip bg-lilac text-lilacDeep">{w}</span>)}
          </div>
        </div>
      )}

      {data.reviewSentences?.length > 0 && (
        <div className="card mt-3">
          <p className="font-bold text-ink">建議複習句子</p>
          <ul className="mt-2 space-y-1 text-sm text-ink list-disc list-inside">
            {data.reviewSentences.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-5 space-y-3">
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
