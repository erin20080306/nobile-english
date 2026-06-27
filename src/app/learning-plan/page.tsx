"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, Target, Sparkles } from "lucide-react";
import type { LevelTestResult, LearningPlan } from "@/types";
import { learningService } from "@/services/learningService";
import { authService } from "@/services/authService";
import { sceneService } from "@/services/sceneService";
import CheerImage from "@/components/CheerImage";
import ScoreRing from "@/components/ScoreRing";
import { LevelBadge } from "@/components/ui";

export default function LearningPlanPage() {
  const router = useRouter();
  const [result, setResult] = useState<LevelTestResult | null>(null);
  const [plan, setPlan] = useState<LearningPlan | null>(null);

  useEffect(() => {
    setResult(learningService.getLevelResult());
    setPlan(learningService.getPlan());
  }, []);

  if (!result) {
    return <div className="p-10 text-center text-inkSoft">載入結果中…</div>;
  }

  const isBeginner = result.level === "Beginner" || result.level === "Elementary";
  const pct = Math.round((result.score / result.total) * 100);

  function start() {
    authService.setOnboarded(true);
    router.replace("/dashboard");
  }

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-10 pb-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <span className="chip bg-mint text-mintDeep">測驗完成 🎉</span>
        <h1 className="mt-3 text-2xl font-extrabold text-ink">你的英文程度</h1>
      </motion.div>

      <div className="flex justify-center my-5">
        <CheerImage size={isBeginner ? 170 : 130} />
      </div>

      <div className="card text-center">
        <div className="flex items-center justify-center gap-4">
          <ScoreRing value={pct} size={120} label="分數" />
          <div className="text-left">
            <p className="text-sm text-inkSoft">你的程度</p>
            <LevelBadge level={result.level} />
            <p className="mt-2 text-sm text-inkSoft">CEFR {result.cefrLevel}</p>
            <p className="text-sm text-inkSoft">{result.score}/{result.total} 題答對</p>
          </div>
        </div>
        <p className="mt-4 text-ink font-semibold">{result.suggestion}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="card !p-4 flex items-center gap-3">
          <Clock className="text-lilacDeep" />
          <div>
            <p className="text-xs text-inkSoft">每日建議</p>
            <p className="font-bold text-ink">{result.dailyMinutes} 分鐘</p>
          </div>
        </div>
        <div className="card !p-4 flex items-center gap-3">
          <Target className="text-peachDeep" />
          <div>
            <p className="text-xs text-inkSoft">每週目標</p>
            <p className="font-bold text-ink">{(plan?.weeklyGoalMinutes ?? result.dailyMinutes * 7)} 分鐘</p>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <p className="font-bold text-ink flex items-center gap-2">
          <Sparkles size={18} className="text-lilacDeep" /> 推薦練習主題
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {result.recommendedTopics.map((t) => (
            <span key={t} className="chip bg-lilac text-lilacDeep">{t}</span>
          ))}
        </div>
        {plan && (
          <div className="mt-4">
            <p className="text-xs text-inkSoft mb-2">為你建立的學習路線</p>
            <div className="flex flex-wrap gap-2">
              {plan.recommendedThemeIds.map((id) => {
                const theme = sceneService.getTheme(id);
                return theme ? (
                  <span key={id} className="chip bg-mint text-mintDeep">
                    {theme.emoji} {theme.name}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-peachDeep font-bold mt-5">加油！你離目標更近一步了！</p>
      <button className="btn-primary w-full mt-3" onClick={start}>
        建立學習路線並開始
      </button>
    </div>
  );
}
