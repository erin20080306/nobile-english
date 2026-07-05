"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, Wand2 } from "lucide-react";
import type { CustomScene } from "@/types";
import { sceneService } from "@/services/sceneService";
import { authService } from "@/services/authService";
import { trialAccessService, type AccessState } from "@/services/trialAccessService";
import { trialUsageService } from "@/services/trialUsageService";
import { subscriptionReminderService } from "@/services/subscriptionReminderService";
import { sceneCardStyle } from "@/data/sceneVisuals";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import SubscriptionLaunchPrompt from "@/components/SubscriptionLaunchPrompt";
import { LevelBadge } from "@/components/ui";

export default function ScenesPage() {
  const router = useRouter();
  const themes = sceneService.getThemes();
  const [customScenes, setCustomScenes] = useState<CustomScene[]>([]);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);

  useEffect(() => {
    setCustomScenes(sceneService.getCustomScenes());
    trialAccessService.getAccessState(undefined, { fresh: true }).then(setAccess).catch(() => setAccess(null));
  }, []);

  function showLimitPrompt(scope: "session" | "lifetime" = "session") {
    const userId = authService.getCurrentUser()?.id;
    if (subscriptionReminderService.shouldShowLimitReminder(userId, "customScene", access, scope)) {
      subscriptionReminderService.markLimitReminderShown(userId, "customScene", scope);
      setShowSubscriptionPrompt(true);
    }
  }

  async function openCustomScene(sceneId: string) {
    if (trialUsageService.isLimited(access) && !trialUsageService.isPromoTrial(access)) {
      showLimitPrompt("session");
      return;
    }
    router.push(`/scenes/custom/${sceneId}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-[100dvh] flex flex-col"
    >
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
              className="card flex items-center gap-4 text-left transition-colors overflow-hidden"
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

        {customScenes.length > 0 && (
          <div className="mt-2 grid gap-3">
            <p className="px-1 text-sm font-extrabold text-inkSoft">自訂場景</p>
            {customScenes.map((custom) => (
              <motion.button
                key={custom.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => openCustomScene(custom.scene.id)}
                className="card flex items-center gap-4 text-left transition-colors overflow-hidden"
                style={sceneCardStyle("#E8E1FF", 0.22, "custom")}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white/80 text-lilacDeep shadow-softer">
                  <Wand2 size={22} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-ink">{custom.scene.name}</p>
                    <LevelBadge level={custom.scene.difficulty} />
                  </div>
                  <p className="text-xs text-inkSoft">{custom.scene.enName}</p>
                  <p className="text-xs text-inkSoft mt-1">{custom.scene.keyWords.length} words · {custom.scene.keyPatterns.length} phrases</p>
                </div>
                <ChevronRight className="text-inkSoft" />
              </motion.button>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
      {access && showSubscriptionPrompt && (
        <SubscriptionLaunchPrompt
          access={access}
          promptReason="limit"
          featureName="自訂場景"
          onSubscribe={() => router.push("/subscription")}
          onDismiss={() => setShowSubscriptionPrompt(false)}
        />
      )}
    </motion.div>
  );
}
