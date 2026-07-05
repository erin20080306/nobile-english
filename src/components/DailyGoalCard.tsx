"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Target, X, BookOpen, MessageSquare, Sparkles, Check } from "lucide-react";
import type { DailyGoalRow } from "@/services/dailyGoalService";
import { ProgressBar } from "@/components/ui";

interface DailyGoalCardProps {
  today: DailyGoalRow | null;
  yesterday: DailyGoalRow | null;
  comprehensionPercent: number;
  comprehensionCefr: string;
  languageLabel: string;
  onSaveTargets: (targets: { wordReview: number; scene: number; dialogue: number }) => void;
  onClose: () => void;
  showYesterdayRecap: boolean;
}

const OPTIONS = [1, 3, 5, 10];

function hasTargets(row: DailyGoalRow | null) {
  return !!row && (row.word_review_target > 0 || row.scene_target > 0 || row.dialogue_target > 0);
}

export default function DailyGoalCard({
  today,
  yesterday,
  comprehensionPercent,
  comprehensionCefr,
  languageLabel,
  onSaveTargets,
  onClose,
  showYesterdayRecap,
}: DailyGoalCardProps) {
  const [editing, setEditing] = useState(!hasTargets(today));
  const [wordReview, setWordReview] = useState(today?.word_review_target || 3);
  const [scene, setScene] = useState(today?.scene_target || 1);
  const [dialogue, setDialogue] = useState(today?.dialogue_target || 1);

  function handleSave() {
    onSaveTargets({ wordReview, scene, dialogue });
    setEditing(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-lilac via-white to-mint p-4 shadow-soft border border-white/80"
    >
      <button
        onClick={onClose}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-2xl bg-white/80 text-inkSoft shadow-softer active:scale-95"
        aria-label="關閉"
      >
        <X size={15} />
      </button>

      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-lilacDeep shadow-softer">
          <Target size={18} />
        </span>
        <div>
          <p className="font-extrabold text-ink">今日目標</p>
          <p className="text-[11px] font-semibold text-inkSoft">{languageLabel} 學習進度</p>
        </div>
      </div>

      {showYesterdayRecap && yesterday && (
        <div className="mt-3 rounded-3xl bg-white/80 p-3">
          <p className="text-xs font-extrabold text-inkSoft">昨日練習回顧</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <RecapStat label="單字複習" value={yesterday.word_review_count} target={yesterday.word_review_target} />
            <RecapStat label="場景練習" value={yesterday.scene_count} target={yesterday.scene_target} />
            <RecapStat label="對話練習" value={yesterday.dialogue_count} target={yesterday.dialogue_target} />
          </div>
        </div>
      )}

      <div className="mt-3 rounded-3xl bg-white/80 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold text-inkSoft">英文理解程度（依 CEFR 國際分級）</p>
          <span className="chip bg-lilacDeep text-white text-[10px]">{comprehensionCefr}</span>
        </div>
        <div className="mt-2"><ProgressBar value={comprehensionPercent} /></div>
        <p className="mt-1 text-[11px] font-semibold text-inkSoft">{comprehensionPercent}%（以 C1 詞彙量為滿分基準）</p>
      </div>

      <div className="mt-3 rounded-3xl bg-white/80 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold text-inkSoft">今日練習目標</p>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-[11px] font-extrabold text-lilacDeep">
              調整目標
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-2 space-y-3">
            <GoalPicker icon={<BookOpen size={14} />} label="單字複習" value={wordReview} onChange={setWordReview} />
            <GoalPicker icon={<Sparkles size={14} />} label="場景練習" value={scene} onChange={setScene} />
            <GoalPicker icon={<MessageSquare size={14} />} label="對話練習" value={dialogue} onChange={setDialogue} />
            <button
              onClick={handleSave}
              className="flex w-full items-center justify-center gap-2 rounded-3xl bg-lilacDeep py-2.5 text-sm font-extrabold text-white shadow-soft active:scale-[0.98]"
            >
              <Check size={16} /> 設定今日目標
            </button>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <RecapStat label="單字複習" value={today?.word_review_count || 0} target={today?.word_review_target || 0} />
            <RecapStat label="場景練習" value={today?.scene_count || 0} target={today?.scene_target || 0} />
            <RecapStat label="對話練習" value={today?.dialogue_count || 0} target={today?.dialogue_target || 0} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function RecapStat({ label, value, target }: { label: string; value: number; target: number }) {
  const done = target > 0 && value >= target;
  return (
    <div className={`rounded-2xl p-2 ${done ? "bg-mint" : "bg-cream"}`}>
      <p className="text-[10px] font-bold text-inkSoft">{label}</p>
      <p className="text-sm font-extrabold text-ink">
        {value}{target > 0 ? ` / ${target}` : ""}
      </p>
    </div>
  );
}

function GoalPicker({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
        {icon} {label}
      </span>
      <div className="flex gap-1.5">
        {OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-7 w-7 rounded-full text-xs font-extrabold active:scale-95 transition ${
              value === n ? "bg-lilacDeep text-white shadow-soft" : "bg-cream text-ink"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
