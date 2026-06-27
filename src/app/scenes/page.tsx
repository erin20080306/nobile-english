"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { sceneService } from "@/services/sceneService";
import { sceneCardStyle } from "@/data/sceneVisuals";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import { LevelBadge } from "@/components/ui";

export default function ScenesPage() {
  const router = useRouter();
  const themes = sceneService.getThemes();

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppHeader title="場景主題" subtitle="選一個主題開始練習" back={false} />
      <div className="px-5 grid gap-3">
        {themes.map((t, i) => {
          const prog = sceneService.themeProgress(t.id);
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => router.push(`/scenes/${t.id}`)}
              className="card flex items-center gap-4 text-left active:scale-[0.98] transition overflow-hidden"
              style={sceneCardStyle(t.color, 0.22, t.id)}
            >
              <span className="text-4xl">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-extrabold text-ink">{t.name}</p>
                  <LevelBadge level={t.difficulty} />
                </div>
                <p className="text-xs text-inkSoft">{t.enName} · {t.description}</p>
                <p className="text-xs text-inkSoft mt-1">
                  {prog.done}/{prog.total} 場景完成 · 約 {t.minutes} 分鐘
                </p>
              </div>
              <ChevronRight className="text-inkSoft" />
            </motion.button>
          );
        })}
      </div>
      <BottomNav />
    </div>
  );
}
