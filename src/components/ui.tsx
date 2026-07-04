"use client";

import type { EnglishLevel } from "@/types";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full"
      type="button"
    >
      {label && <span className="text-ink font-semibold">{label}</span>}
      <span
        className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-mintDeep" : "bg-lilac"}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

const levelStyles: Record<string, string> = {
  Beginner: "bg-mint text-mintDeep",
  Elementary: "bg-sky text-skyDeep",
  Intermediate: "bg-lilac text-lilacDeep",
  "Upper-Intermediate": "bg-peach text-peachDeep",
  Advanced: "bg-ink text-white",
};

const levelZh: Record<string, string> = {
  Beginner: "初級",
  Elementary: "基礎",
  Intermediate: "中級",
  "Upper-Intermediate": "中高級",
  Advanced: "高級",
};

const levelCefr: Record<string, string> = {
  Beginner: "A1",
  Elementary: "A2",
  Intermediate: "B1",
  "Upper-Intermediate": "B2",
  Advanced: "C1",
};

export function levelLabel(level: EnglishLevel | string) {
  return levelZh[level] ? `${levelCefr[level]} ${level}｜${levelZh[level]}` : level;
}

export function LevelBadge({ level }: { level: EnglishLevel | string }) {
  return (
    <span className={`chip whitespace-nowrap text-xs ${levelStyles[level] || "bg-lilac text-lilacDeep"}`}>{levelLabel(level)}</span>
  );
}

export function Stars({ count, total = 3 }: { count: number; total?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={i < count ? "text-yellow-400" : "text-lilac"}>
          ★
        </span>
      ))}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-3 w-full rounded-full bg-lilac overflow-hidden">
      <div
        className="h-full rounded-full bg-lilacDeep transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
