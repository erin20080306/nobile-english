"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GraduationCap, ChevronRight, History } from "lucide-react";
import type { ExamType, ExamResult } from "@/types";
import { examService } from "@/services/examService";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

const exams: { type: ExamType; color: string; desc: string }[] = [
  { type: "TOEIC", color: "from-lilac to-sky", desc: "職場與日常英文能力測驗" },
  { type: "IELTS", color: "from-mint to-sky", desc: "留學與移民學術英文" },
  { type: "TOEFL", color: "from-peach to-lilac", desc: "北美學術英文檢定" },
];

export default function ExamHub() {
  const router = useRouter();
  const [results, setResults] = useState<ExamResult[]>([]);

  useEffect(() => {
    setResults(examService.getResults());
  }, []);

  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader title="測驗中心" subtitle="TOEIC / IELTS / TOEFL" back={false} />
      <div className="px-5 space-y-4">
        {exams.map((e, i) => {
          const c = examService.countByExam(e.type);
          return (
            <motion.button
              key={e.type}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => router.push(`/exam/${e.type}`)}
              className={`w-full rounded-4xl p-5 text-left shadow-soft bg-gradient-to-br ${e.color} active:scale-[0.98] transition`}
            >
              <div className="flex items-center gap-3">
                <GraduationCap className="text-ink" />
                <div className="flex-1">
                  <p className="text-xl font-extrabold text-ink">{e.type}</p>
                  <p className="text-sm text-ink/70">{e.desc}</p>
                </div>
                <ChevronRight className="text-ink/60" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag>共 {c.total} 題</Tag>
                <Tag>單字 {c.vocabulary}</Tag>
                <Tag>文法 {c.grammar}</Tag>
                <Tag>閱讀 {c.reading}</Tag>
                <Tag>聽力 {c.listening}</Tag>
              </div>
            </motion.button>
          );
        })}

        <div className="card">
          <p className="font-bold text-ink flex items-center gap-2"><History size={18} className="text-lilacDeep" /> 成績紀錄</p>
          {results.length === 0 ? (
            <p className="text-inkSoft text-sm mt-2">尚無測驗紀錄，挑戰看看吧！</p>
          ) : (
            <div className="mt-2 space-y-2">
              {results.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl bg-cream px-3 py-2">
                  <span className="font-bold text-ink">{r.exam}</span>
                  <span className="text-sm text-inkSoft">{r.correct}/{r.total}</span>
                  <span className="chip bg-lilac text-lilacDeep text-xs">{r.percent}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn-secondary w-full" onClick={() => router.push("/records?tab=wrong")}>查看錯題複習</button>
      </div>
      <BottomNav />
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="chip bg-white/60 text-ink text-xs">{children}</span>;
}
