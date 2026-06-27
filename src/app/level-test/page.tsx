"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { levelTestQuestions } from "@/data/levelTest";
import { learningService } from "@/services/learningService";
import { authService } from "@/services/authService";
import { ProgressBar } from "@/components/ui";

export default function LevelTestPage() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);

  const q = levelTestQuestions[idx];
  const total = levelTestQuestions.length;

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
      const score = updated.reduce(
        (acc, a, i) => acc + (a === levelTestQuestions[i].answerIndex ? 1 : 0),
        0
      );
      const profile = learningService.getProfile();
      const result = learningService.scoreLevelTest(score, total, profile.dailyGoalMinutes || 15);
      authService.updateLevel(result.level, result.cefrLevel);
      learningService.buildPlan(result.level, result.recommendedTopics, result.dailyMinutes);
      router.replace("/learning-plan");
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-12 pb-8">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-inkSoft">程度測驗 {idx + 1}/{total}</span>
        <span className="chip bg-lilac text-lilacDeep text-xs">{typeLabel(q.type)}</span>
      </div>
      <ProgressBar value={((idx + 1) / total) * 100} />

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          className="mt-6 flex-1"
        >
          {q.passage && (
            <div className="card mb-4 bg-cream text-ink leading-relaxed">{q.passage}</div>
          )}
          <h2 className="text-xl font-extrabold text-ink mb-4">{q.question}</h2>
          <div className="space-y-3">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => choose(i)}
                className={`w-full text-left rounded-3xl p-4 font-semibold transition active:scale-95 ${
                  picked === i ? "bg-lilacDeep text-white shadow-soft" : "bg-white text-ink shadow-softer"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <button className="btn-primary w-full disabled:opacity-40" disabled={picked === null} onClick={next}>
        {idx < total - 1 ? "下一題" : "看結果"}
      </button>
    </div>
  );
}

function typeLabel(t: string) {
  return { vocabulary: "單字", grammar: "文法", reading: "閱讀", situational: "情境" }[t] || t;
}
