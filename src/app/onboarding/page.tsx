"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { ChineseSetting } from "@/types";
import { learningService } from "@/services/learningService";
import { authService } from "@/services/authService";
import { ProgressBar } from "@/components/ui";

const steps = [
  {
    key: "language",
    title: "想學習哪種語言？",
    multi: false,
    options: ["English（英文）", "其他語言（即將推出）"],
  },
  {
    key: "learningGoal",
    title: "你的學習目標是？",
    multi: false,
    options: ["旅遊英文", "職場英文", "日常會話", "面試英文", "考試英文", "多益 TOEIC", "雅思 IELTS", "托福 TOEFL", "自由選擇"],
  },
  {
    key: "interests",
    title: "你對哪些主題有興趣？",
    multi: true,
    options: ["咖啡廳與美食", "旅行", "電影與影集", "科技", "職場", "遊戲", "時尚", "健身", "自訂興趣"],
  },
  {
    key: "dailyGoalMinutes",
    title: "每天可以學習多久？",
    multi: false,
    options: ["5 分鐘", "10 分鐘", "15 分鐘", "30 分鐘以上"],
  },
  {
    key: "chineseSetting",
    title: "中文輔助偏好？",
    multi: false,
    options: ["全程顯示中文", "需要時顯示中文", "練習時隱藏中文", "複習時顯示中文"],
  },
] as const;

const chineseMap: Record<string, ChineseSetting> = {
  "全程顯示中文": "always",
  "需要時顯示中文": "on-demand",
  "練習時隱藏中文": "practice-hide",
  "複習時顯示中文": "review-only",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [single, setSingle] = useState<Record<string, string>>({});
  const [interests, setInterests] = useState<string[]>([]);

  const cur = steps[step];

  function selectOption(opt: string) {
    if (cur.multi) {
      setInterests((arr) => (arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]));
    } else {
      setSingle((s) => ({ ...s, [cur.key]: opt }));
    }
  }

  function isSelected(opt: string) {
    return cur.multi ? interests.includes(opt) : single[cur.key] === opt;
  }

  function canNext() {
    return cur.multi ? interests.length > 0 : !!single[cur.key];
  }

  function next() {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    // save profile
    learningService.saveProfile({
      language: "English",
      learningGoal: single["learningGoal"] || "日常會話",
      interests,
      dailyGoalMinutes: parseInt(single["dailyGoalMinutes"]) || 15,
      chineseSetting: chineseMap[single["chineseSetting"]] || "always",
    });
    router.replace("/level-test");
  }

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-12 pb-8">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-inkSoft">問卷 {step + 1}/{steps.length}</span>
        {step > 0 && (
          <button className="text-sm text-lilacDeep font-bold" onClick={() => setStep((s) => s - 1)}>
            上一題
          </button>
        )}
      </div>
      <ProgressBar value={((step + 1) / steps.length) * 100} />

      <AnimatePresence mode="wait">
        <motion.div
          key={cur.key}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          className="mt-8 flex-1"
        >
          <h2 className="text-2xl font-extrabold text-ink mb-1">{cur.title}</h2>
          {cur.multi && <p className="text-inkSoft text-sm mb-4">可複選</p>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {cur.options.map((opt) => (
              <button
                key={opt}
                onClick={() => selectOption(opt)}
                className={`rounded-3xl p-4 text-left font-bold transition active:scale-95 ${
                  isSelected(opt)
                    ? "bg-lilacDeep text-white shadow-soft"
                    : "bg-white text-ink shadow-softer"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <button
        className="btn-primary w-full disabled:opacity-40"
        disabled={!canNext()}
        onClick={next}
      >
        {step < steps.length - 1 ? "下一題" : "前往程度測驗"}
      </button>
    </div>
  );
}
