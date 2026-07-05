"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { levelTestQuestions } from "@/data/levelTest";
import { learningService } from "@/services/learningService";
import { authService } from "@/services/authService";
import { ProgressBar } from "@/components/ui";
import type { EnglishLevel } from "@/types";

const selfLevelOptions: Array<{
  level: EnglishLevel;
  cefr: string;
  title: string;
  description: string;
}> = [
  {
    level: "Beginner",
    cefr: "A1",
    title: "A1 初學",
    description: "認得基礎單字，可以練習打招呼、自我介紹、點餐等短句。",
  },
  {
    level: "Elementary",
    cefr: "A2",
    title: "A2 基礎",
    description: "能理解常見生活句，能用簡短句子回答日常問題。",
  },
  {
    level: "Intermediate",
    cefr: "B1",
    title: "B1 中級",
    description: "能描述經驗、需求與想法，適合練旅行、工作與較完整對話。",
  },
  {
    level: "Upper-Intermediate",
    cefr: "B2",
    title: "B2 中高級",
    description: "能自然表達觀點，適合練簡報、討論、客訴與較長文章。",
  },
  {
    level: "Advanced",
    cefr: "C1",
    title: "C1 進階",
    description: "能處理抽象話題、精準用字與深度討論，適合高階表達訓練。",
  },
];

export default function LevelTestPage() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [showSelfAssessment, setShowSelfAssessment] = useState(false);
  const [selfLevel, setSelfLevel] = useState<EnglishLevel | null>(null);

  const q = levelTestQuestions[idx];
  const total = levelTestQuestions.length;
  const displayStep = showSelfAssessment ? total + 1 : idx + 1;
  const displayTotal = total + 1;

  function choose(i: number) {
    setPicked(i);
  }

  function next() {
    if (picked === null) return;
    const updated = [...answers, picked];
    setAnswers(updated);
    setPicked(null);
    if (idx < total - 1) {
      setIdx((v) => v + 1);
    } else {
      setShowSelfAssessment(true);
    }
  }

  function finish() {
    if (!selfLevel) return;
    const score = answers.reduce(
      (acc, a, i) => acc + (a === levelTestQuestions[i].answerIndex ? 1 : 0),
      0
    );
    const profile = learningService.getProfile();
    const result = learningService.scoreLevelTest(score, total, profile.dailyGoalMinutes || 15, selfLevel);
    authService.updateLevel(result.level, result.cefrLevel);
    learningService.buildPlan(result.level, result.recommendedTopics, result.dailyMinutes);
    router.replace("/learning-plan");
  }

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-12 pb-8">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-inkSoft">程度測驗 {displayStep}/{displayTotal}</span>
        <span className="chip bg-lilac text-lilacDeep text-xs">{showSelfAssessment ? "自評" : typeLabel(q.type)}</span>
      </div>
      <ProgressBar value={(displayStep / displayTotal) * 100} />

      <AnimatePresence mode="wait">
        {showSelfAssessment ? (
          <motion.div
            key="self-assessment"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="mt-6 flex-1"
          >
            <div className="card bg-white">
              <p className="chip bg-mint text-mintDeep text-xs">最後由你決定</p>
              <h2 className="mt-3 text-2xl font-black text-ink">你覺得你的英文程度是？</h2>
              <p className="mt-2 text-sm font-semibold text-inkSoft">
                前面的測驗只作為參考，正式練習會依你最後選擇的程度安排內容。
              </p>
              <div className="mt-5 space-y-3">
                {selfLevelOptions.map((option) => {
                  const active = selfLevel === option.level;
                  return (
                    <button
                      key={option.level}
                      onClick={() => setSelfLevel(option.level)}
                      className={`w-full rounded-3xl p-4 text-left transition active:scale-[0.99] ${
                        active ? "bg-lilacDeep text-white shadow-soft" : "bg-cream text-ink shadow-softer"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black">{option.title}</p>
                          <p className={`mt-1 text-sm font-semibold ${active ? "text-white/80" : "text-inkSoft"}`}>
                            {option.description}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${active ? "bg-white/20" : "bg-white text-lilacDeep"}`}>
                          {option.cefr}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="mt-6 flex-1"
          >
            {q.passage && (
              <div className="card mb-4 bg-cream text-ink leading-relaxed">
                <p className="text-ink mb-2">{q.passage}</p>
                {q.passageZh && <p className="text-inkSoft text-sm mt-2">{q.passageZh}</p>}
              </div>
            )}
            <h2 className="text-xl font-extrabold text-ink mb-2">{q.question}</h2>
            {q.questionZh && <p className="text-inkSoft text-sm mb-4">{q.questionZh}</p>}
            <div className="space-y-3">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  className={`w-full text-left rounded-3xl p-4 font-semibold transition active:scale-95 ${
                    picked === i ? "bg-lilacDeep text-white shadow-soft" : "bg-white text-ink shadow-softer"
                  }`}
                >
                  <div className="flex flex-col">
                    <span>{opt}</span>
                    {q.optionsZh && q.optionsZh[i] && (
                      <span className="text-sm mt-1 opacity-70">{q.optionsZh[i]}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showSelfAssessment ? (
        <button className="btn-primary w-full disabled:opacity-40" disabled={!selfLevel} onClick={finish}>
          完成並建立學習計畫
        </button>
      ) : (
        <button className="btn-primary w-full disabled:opacity-40" disabled={picked === null} onClick={next}>
          {idx < total - 1 ? "下一題" : "選擇我的程度"}
        </button>
      )}
    </div>
  );
}

function typeLabel(t: string) {
  return { vocabulary: "單字", grammar: "文法", reading: "閱讀", situational: "情境" }[t] || t;
}
