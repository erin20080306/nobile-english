"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ClipboardCheck, Sparkles, X } from "lucide-react";
import type { SceneReviewCheck, SceneReviewTask } from "@/types";
import CheerImage from "@/components/CheerImage";

const reviewImages = {
  intro: "/assets/rewards/random-quiz.png",
  excellent: "/assets/rewards/perfect-100.png",
  good: "/assets/rewards/cheer-up-sign.png",
  practice: "/assets/rewards/keep-practicing-desk.png",
};

export default function SceneReviewAssessment({
  review,
  onClose,
}: {
  review: SceneReviewCheck;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = submitted ? scoreTasks(review.tasks, answers) : 0;
  const percent = review.tasks.length ? Math.round((score / review.tasks.length) * 100) : 0;
  const resultImage = !submitted
    ? reviewImages.intro
    : percent >= 90
    ? reviewImages.excellent
    : percent >= 65
    ? reviewImages.good
    : reviewImages.practice;

  function answerTask(task: SceneReviewTask, value: string) {
    setAnswers((current) => ({ ...current, [task.id]: value }));
  }

  function submit() {
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 backdrop-blur-sm">
      <motion.div
        initial={{ y: 420, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 420, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[36px] bg-cream p-5 shadow-soft"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-lilacDeep">第 2 次場景練習後抽考</p>
            <h2 className="text-xl font-black text-ink">複習考核 · {review.sceneName}</h2>
            <p className="mt-1 text-sm text-inkSoft">單字填空、場景回覆、選擇正確單字各 2 題。可直接關閉略過。</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-inkSoft shadow-softer active:scale-95"
            aria-label="關閉抽考"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 rounded-[30px] bg-[#fff8ef] px-4 py-3 text-center shadow-softer border border-white/80">
          <CheerImage size={190} src={resultImage} alt="場景複習考核鼓勵圖" className="mx-auto rounded-[24px]" />
          {submitted && (
            <p className="mt-2 text-lg font-black text-peachDeep">抽考分數 {percent} 分</p>
          )}
        </div>

        {submitted && (
          <div className="mb-4 rounded-[28px] bg-white p-4 shadow-softer">
            <div className="flex items-center gap-2">
              <Sparkles size={17} className="text-peachDeep" />
              <p className="font-extrabold text-ink">真實簡短建議</p>
            </div>
            <ul className="mt-2 space-y-2 text-sm font-semibold leading-relaxed text-ink">
              {resultAdvice(percent, review).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          {review.tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              value={answers[task.id] || ""}
              submitted={submitted}
              onAnswer={(value) => answerTask(task, value)}
            />
          ))}
        </div>

        <div className="sticky bottom-0 mt-5 bg-cream/95 pt-3 backdrop-blur">
          {!submitted ? (
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-secondary" onClick={onClose}>略過抽考</button>
              <button className="btn-primary flex items-center justify-center gap-2" onClick={submit}>
                <ClipboardCheck size={18} /> 送出評分
              </button>
            </div>
          ) : (
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={onClose}>
              <CheckCircle2 size={18} /> 完成並關閉
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function TaskCard({
  task,
  index,
  value,
  submitted,
  onAnswer,
}: {
  task: SceneReviewTask;
  index: number;
  value: string;
  submitted: boolean;
  onAnswer: (value: string) => void;
}) {
  const correct = isTaskCorrect(task, value);
  const label = task.kind === "fill" ? "單字填空" : task.kind === "reply" ? "場景回覆" : "選擇正確單字";
  return (
    <div className="rounded-[28px] bg-white p-4 shadow-softer">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-lilac px-3 py-1 text-xs font-extrabold text-lilacDeep">
          {label} {index + 1}
        </span>
        {submitted && (
          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${correct ? "bg-mint text-mintDeep" : "bg-peach text-peachDeep"}`}>
            {correct ? "答對" : "可再練"}
          </span>
        )}
      </div>
      <p className="text-base font-extrabold leading-relaxed text-ink">{task.prompt}</p>
      {task.hint && <p className="mt-1 text-xs font-semibold text-inkSoft">{task.hint}</p>}

      {task.kind === "choice" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(task.options || []).map((option) => (
            <button
              key={option}
              type="button"
              disabled={submitted}
              onClick={() => onAnswer(option)}
              className={`rounded-2xl px-3 py-2 text-sm font-extrabold transition active:scale-95 ${
                value === option ? "bg-lilacDeep text-white shadow-soft" : "bg-cream text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      ) : task.kind === "reply" ? (
        <textarea
          value={value}
          disabled={submitted}
          onChange={(event) => onAnswer(event.target.value)}
          placeholder="用剛剛學過的語句回覆..."
          className="mt-3 min-h-20 w-full resize-none rounded-3xl bg-cream px-4 py-3 text-ink outline-none disabled:opacity-80"
        />
      ) : (
        <input
          value={value}
          disabled={submitted}
          onChange={(event) => onAnswer(event.target.value)}
          placeholder="填入單字"
          className="mt-3 w-full rounded-3xl bg-cream px-4 py-3 text-ink outline-none disabled:opacity-80"
        />
      )}

      {submitted && (
        <div className="mt-3 rounded-2xl bg-cream px-3 py-2 text-sm">
          <p className="font-bold text-ink">參考答案：{task.answer}</p>
          {task.kind === "reply" && <p className="mt-1 text-inkSoft">你可以用自己的說法，只要能自然接住情境就很好。</p>}
        </div>
      )}
    </div>
  );
}

function scoreTasks(tasks: SceneReviewTask[], answers: Record<string, string>) {
  return tasks.reduce((sum, task) => sum + (isTaskCorrect(task, answers[task.id] || "") ? 1 : 0), 0);
}

function isTaskCorrect(task: SceneReviewTask, value: string) {
  const answer = normalize(task.answer);
  const current = normalize(value);
  if (!current) return false;
  if (task.kind === "reply") return current.length >= Math.min(5, Math.max(2, answer.length / 3));
  return current === answer || current.includes(answer) || answer.includes(current);
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[。！？!?.,，、\s]+/g, "");
}

function resultAdvice(percent: number, review: SceneReviewCheck) {
  if (percent >= 85) {
    return [
      "你能記住關鍵單字，也能接住場景回覆，下一步可以把句子說得更長一點。",
      ...review.advice.slice(0, 1),
    ];
  }
  if (percent >= 60) {
    return [
      "單字和情境反應已有基礎，建議重複朗讀參考答案 2 次，讓回覆更自然。",
      ...review.strengthenAreas.slice(0, 1),
    ];
  }
  return [
    "先不用急著講很長，請先背熟本場景 2 個關鍵句，再回來練一次。",
    ...review.strengthenAreas.slice(0, 1),
  ];
}
