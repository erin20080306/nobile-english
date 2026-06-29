"use client";

import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, BookText, MessageSquare } from "lucide-react";
import { sceneService } from "@/services/sceneService";
import { sceneCardStyle } from "@/data/sceneVisuals";
import AppHeader from "@/components/AppHeader";
import { LevelBadge } from "@/components/ui";

export default function ThemeScenesPage() {
  const router = useRouter();
  const params = useParams();
  const themeId = String(params.themeId);
  const theme = sceneService.getTheme(themeId);
  const scenes = sceneService.getScenesByTheme(themeId);
  const progress = sceneService.getProgress();

  if (!theme) {
    return (
      <div className="p-10 text-center text-inkSoft">
        找不到主題。
        <button className="block mx-auto mt-4 btn-secondary" onClick={() => router.push("/scenes")}>回主題列表</button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-[100dvh] pb-10"
    >
      <AppHeader title={`${theme.emoji} ${theme.name}`} subtitle={theme.enName} />
      <div className="px-5 grid gap-3">
        {scenes.map((s, i) => {
          const done = progress[s.id]?.completed;
          return (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => router.push(`/scenes/${themeId}/${s.id}`)}
              className="card text-left transition-colors relative overflow-hidden"
              style={sceneCardStyle(theme.color, 0.24, themeId)}
            >
              {done && (
                <CheckCircle2 className="absolute right-4 top-4 text-mintDeep" size={22} />
              )}
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-2xl bg-lilac text-lilacDeep font-extrabold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="font-bold text-ink">{s.name}</p>
              </div>
              <p className="text-xs text-inkSoft mt-1">{s.enName}</p>
              <p className="text-sm text-inkSoft mt-1">{s.intro}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <LevelBadge level={s.difficulty} />
                <span className="chip bg-cream text-inkSoft text-xs flex items-center gap-1"><Clock size={12} />{s.minutes} 分</span>
                <span className="chip bg-cream text-inkSoft text-xs flex items-center gap-1"><BookText size={12} />{s.keyWords.length} 單字</span>
                <span className="chip bg-cream text-inkSoft text-xs flex items-center gap-1"><MessageSquare size={12} />{s.dialogue.length} 對話</span>
                {done && <span className="chip bg-mint text-mintDeep text-xs">分數 {progress[s.id]?.score}</span>}
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
