"use client";

import { useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Home, RotateCcw } from "lucide-react";
import type { ExamType, ExamQuestion, ExamResult } from "@/types";
import { examService } from "@/services/examService";
import { learningService } from "@/services/learningService";
import { authService } from "@/services/authService";
import { examBlueprints, examSectionLabel } from "@/data/examBlueprints";
import AppHeader from "@/components/AppHeader";
import ScoreRing from "@/components/ScoreRing";
import CheerImage from "@/components/CheerImage";
import { rewardImageForScore } from "@/data/rewardImages";
import { ProgressBar } from "@/components/ui";

export default function ExamRunPage() {
  const router = useRouter();
  const params = useParams();
  const type = String(params.type).toUpperCase() as ExamType;
  const valid = ["TOEIC", "IELTS", "TOEFL"].includes(type);

  const questions = useMemo(() => examService.getByExam(type), [type]);
  const settings = useMemo(() => {
    const u = authService.getCurrentUser();
    return u ? learningService.getSettings(u.id) : null;
  }, []);
  const showZh = settings ? settings.showChineseGlobal && settings.examChinese : true;

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [rewardImage, setRewardImage] = useState("");

  if (!valid) {
    return <div className="p-10 text-center text-inkSoft">未知測驗類型。<button className="block mx-auto mt-4 btn-secondary" onClick={() => router.push("/exam")}>回測驗中心</button></div>;
  }

  const q = questions[idx];
  const blueprint = examBlueprints[type];

  function next() {
    if (picked === null) return;
    const updated = [...answers, picked];
    setAnswers(updated);
    setPicked(null);
    if (idx < questions.length - 1) {
      setIdx((v) => v + 1);
    } else {
      const r = examService.evaluate(type, questions, updated);
      learningService.touchActivity(10, r.correct * 4);
      learningService.addRecord({
        type: "exam",
        title: `${type} 測驗`,
        score: r.percent,
        completed: true,
        minutes: 10,
      });
      setRewardImage(rewardImageForScore(r.percent));
      setResult(r);
    }
  }

  function retry() {
    setIdx(0);
    setAnswers([]);
    setPicked(null);
    setResult(null);
  }

  if (result) {
    const wrong = result.wrongQuestionIds.map((id) => examService.getQuestion(id)).filter(Boolean) as ExamQuestion[];
    return (
      <div className="min-h-[100dvh] pb-10">
        <AppHeader title={`${type} 成績`} subtitle="測驗結果" />
        <div className="px-5 space-y-4">
          <div className="card flex flex-col items-center">
            <CheerImage size={160} src={rewardImage} alt={result.level} className="mb-2" />
            <ScoreRing value={result.percent} label="分數" />
            <p className="mt-2 font-extrabold text-ink">{result.level}</p>
            <p className="text-inkSoft">答對 {result.correct} / {result.total} 題</p>
          </div>

          {result.reviewWords.length > 0 && (
            <div className="card">
              <p className="font-bold text-ink">推薦複習單字</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.reviewWords.map((w) => <span key={w} className="chip bg-lilac text-lilacDeep">{w}</span>)}
              </div>
            </div>
          )}

          <div className="card">
            <p className="font-bold text-ink mb-2">錯題清單（{wrong.length}）</p>
            {wrong.length === 0 ? (
              <p className="text-mintDeep font-semibold">全部答對，太厲害了！🎉</p>
            ) : (
              <div className="space-y-3">
                {wrong.map((w) => (
                  <div key={w.id} className="rounded-3xl bg-cream p-3">
                    <p className="font-semibold text-ink">{w.question}</p>
                    <p className="text-sm text-mintDeep mt-1">正解：{w.options[w.answerIndex]}</p>
                    {showZh && <p className="text-sm text-inkSoft mt-1">💡 {w.explanationZh}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={retry}><RotateCcw size={18} /> 再測一次</button>
          <button className="btn-secondary w-full flex items-center justify-center gap-2" onClick={() => router.push("/dashboard")}><Home size={18} /> 回首頁</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col pb-8">
      <AppHeader title={`${type} 測驗`} subtitle={`${idx + 1} / ${questions.length} · ${blueprint.minutes} 分鐘專業練習`} />
      <div className="px-5">
        <ProgressBar value={((idx + 1) / questions.length) * 100} />
      </div>
      <div className="px-5 mt-3">
        <div className="rounded-3xl bg-white/80 px-4 py-3 shadow-softer">
          <p className="text-sm font-extrabold text-ink">{blueprint.title}</p>
          <p className="text-xs text-inkSoft mt-0.5">{blueprint.focus}</p>
          <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
            {blueprint.sections.map((section) => (
              <span key={section} className="chip bg-cream text-ink text-[11px] whitespace-nowrap">{section}</span>
            ))}
          </div>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="px-5 mt-5 flex-1">
          <div className="flex gap-2 mb-3">
            <span className="chip bg-lilac text-lilacDeep text-xs">{catLabel(q.category)}</span>
            <span className="chip bg-mint text-mintDeep text-xs">{examSectionLabel(type, q.category, idx)}</span>
          </div>
          {q.passage && <div className="card bg-cream mb-3 text-ink leading-relaxed text-sm">{q.passage}</div>}
          <h2 className="text-lg font-extrabold text-ink mb-4">{q.question}</h2>
          <div className="space-y-3">
            {q.options.map((opt, i) => (
              <button key={i} onClick={() => setPicked(i)} className={`w-full text-left rounded-3xl p-4 font-semibold transition active:scale-95 ${picked === i ? "bg-lilacDeep text-white shadow-soft" : "bg-white text-ink shadow-softer"}`}>
                {opt}
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="px-5">
        <button className="btn-primary w-full disabled:opacity-40" disabled={picked === null} onClick={next}>
          {idx < questions.length - 1 ? "下一題" : "看成績"}
        </button>
      </div>
    </div>
  );
}

function catLabel(c: string) {
  return { vocabulary: "單字", grammar: "文法", reading: "閱讀", listening: "聽力" }[c] || c;
}
