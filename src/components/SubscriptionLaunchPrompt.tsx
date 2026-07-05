"use client";

import { motion } from "framer-motion";
import { Check, Crown, Lock, Sparkles, Volume2, X } from "lucide-react";
import type { AccessState } from "@/services/trialAccessService";
import { trialAccessService } from "@/services/trialAccessService";
import type { SubscriptionPromptReason } from "@/services/subscriptionReminderService";

interface SubscriptionLaunchPromptProps {
  access: AccessState;
  onSubscribe: () => void;
  onContinueTrial?: () => void;
  onDismiss?: () => void;
  promptReason?: SubscriptionPromptReason;
  featureName?: string;
}

export default function SubscriptionLaunchPrompt({
  access,
  onSubscribe,
  onContinueTrial,
  onDismiss,
  promptReason,
  featureName,
}: SubscriptionLaunchPromptProps) {
  if (!promptReason && !access.shouldShowSubscriptionPrompt) return null;

  const resolvedReason: SubscriptionPromptReason =
    promptReason || (access.reason === "trial_expired" ? "expired" : access.showReason === "limit_reached" ? "limit" : "login");
  const trialDaysText =
    access.reason === "promo_trial"
      ? `30 天優惠試用剩 ${access.promoTrial?.daysLeft ?? 0} 天`
      : access.reason === "trial"
        ? `試用剩 ${access.trial.daysLeft} 天`
        : "試用已結束";
  const title =
    resolvedReason === "limit"
      ? `${featureName || "此功能"}試用額度已用完`
      : resolvedReason === "login"
        ? "試用期提醒"
        : "試用已結束";
  const subtitle =
    resolvedReason === "limit"
      ? "這個功能的試用額度已使用完畢，訂閱後可繼續使用完整功能。"
      : resolvedReason === "login"
        ? `${trialDaysText}。訂閱後可解鎖完整 AI 導師語音、完整練習額度與農場商店。`
        : "訂閱後可繼續使用 AI 導師、場景練習與完整語音。";

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    } else {
      trialAccessService.dismissSubscriptionPrompt();
    }
    if (onContinueTrial) onContinueTrial();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md overflow-hidden rounded-[30px] bg-white shadow-soft"
      >
        <div className="relative bg-gradient-to-br from-lilac via-white to-mint p-5">
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/80 text-inkSoft shadow-softer active:scale-95"
            aria-label="關閉"
          >
            <X size={17} />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white text-lilacDeep shadow-softer">
            <Lock size={24} />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-ink">{title}</h2>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-inkSoft">{subtitle}</p>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-[24px] bg-cream p-4">
            <p className="text-sm font-extrabold text-ink">試用期可以使用</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-ink">
              <Feature>7 天免費試用，首頁會顯示剩餘天數</Feature>
              <Feature>AI 導師文字回覆可正常體驗</Feature>
              <Feature>初級場景可體驗每個主題前 3 個場景</Feature>
              <Feature>每日 2 次對話、每日 1 次單字複習</Feature>
              <Feature>文法拖曳練習試用共 10 次</Feature>
              <Feature>每日文章可聽各國語言，試用額度共 1 次</Feature>
              <Feature>優惠碼 30 天試用：練習、閱讀、農場補給與商店每日各最多 20 次</Feature>
              <Feature>主題人物影片不限額瀏覽</Feature>
            </ul>
          </div>

          <div className="rounded-[24px] bg-white p-4 shadow-softer">
            <p className="flex items-center gap-2 text-sm font-extrabold text-ink">
              <Sparkles size={16} className="text-lilacDeep" />
              訂閱後解鎖
            </p>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-ink">
              <Feature>完整 AI 導師角色語音與回覆</Feature>
              <Feature>完整場景練習、對話練習與自訂場景</Feature>
              <Feature>每日文章、單字複習與語音播放完整使用</Feature>
              <Feature>英文 6 位導師；日文、韓文、義大利文、西班牙文各男女 1 位</Feature>
              <Feature>農場商店與更多練習內容</Feature>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PlanCard title="月費" price="NT$399" detail="完整 AI 導師語音" />
            <PlanCard title="首年優惠" price="NT$1290" detail="平均每月約 NT$108" highlight />
          </div>

          <button
            onClick={onSubscribe}
            className="flex w-full items-center justify-center gap-2 rounded-3xl bg-lilacDeep py-3.5 text-base font-extrabold text-white shadow-soft active:scale-[0.98]"
          >
            <Crown size={18} />
            查看訂閱方案
          </button>

          <button
            onClick={handleDismiss}
            className="w-full rounded-3xl bg-white py-3 text-sm font-extrabold text-inkSoft active:scale-[0.98]"
          >
            關閉這次提醒
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Feature({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 ${muted ? "text-peachDeep" : "text-mintDeep"}`}>
        {muted ? <Volume2 size={16} /> : <Check size={16} />}
      </span>
      <span className={muted ? "text-peachDeep" : ""}>{children}</span>
    </li>
  );
}

function PlanCard({
  title,
  price,
  detail,
  highlight = false,
}: {
  title: string;
  price: string;
  detail: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-[24px] p-4 ${highlight ? "bg-peach text-white" : "bg-lilac text-lilacDeep"}`}>
      <p className="text-xs font-extrabold opacity-80">{title}</p>
      <p className="mt-1 text-xl font-extrabold">{price}</p>
      <p className="mt-1 text-xs font-bold opacity-80">{detail}</p>
    </div>
  );
}
