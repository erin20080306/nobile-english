"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Check, Crown, Info, RefreshCw, Settings, Sparkles } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { subscriptionService } from "@/services/subscriptionService";
import { trialAccessService, type AccessState, TRIAL_DAYS } from "@/services/trialAccessService";
import type { SubscriptionOffering } from "@/types/subscription";

export default function SubscriptionPage() {
  const router = useRouter();
  const [offerings, setOfferings] = useState<SubscriptionOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [access, setAccess] = useState<AccessState | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const [nextOfferings, nextAccess] = await Promise.all([
        subscriptionService.getOfferings(),
        trialAccessService.getAccessState(undefined, { fresh: true }),
      ]);
      setOfferings(nextOfferings);
      setAccess(nextAccess);
    } catch (error) {
      console.error("Failed to load subscription page:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase(productId: string) {
    setPurchasing(productId);
    try {
      const result = await subscriptionService.purchase(productId);
      if (result.success) {
        trialAccessService.clearCache();
        await load();
      } else {
        alert(result.error || "購買失敗，請稍後再試。");
      }
    } catch {
      alert("購買流程發生錯誤，請稍後再試。");
    } finally {
      setPurchasing(null);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const result = await subscriptionService.restorePurchases();
      trialAccessService.clearCache();
      await load();
      alert(result.success ? `已恢復 ${result.restoredCount} 筆購買。` : result.error || "沒有找到可恢復的訂閱。");
    } catch {
      alert("恢復購買失敗，請稍後再試。");
    } finally {
      setRestoring(false);
    }
  }

  async function handleManage() {
    await subscriptionService.openManageSubscriptions();
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <p className="text-inkSoft">載入訂閱方案...</p>
      </div>
    );
  }

  const isSubscribed = Boolean(access?.isSubscribed);
  const trialActive = access?.reason === "trial";
  const trialExpired = access?.reason === "trial_expired";

  return (
    <div className="min-h-[100dvh] pb-8">
      <AppHeader
        title="訂閱方案"
        subtitle="解鎖完整 AI 導師練習"
        back
        right={
          <button onClick={handleManage} className="chip bg-white text-inkSoft shadow-softer flex items-center gap-1">
            <Settings size={14} /> 管理
          </button>
        }
      />

      <div className="px-5 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[30px] bg-gradient-to-br from-lilac via-white to-mint p-5 shadow-soft"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white text-lilacDeep shadow-softer">
              <Crown size={24} />
            </span>
            <div>
              <p className="text-xl font-extrabold text-ink">
                {isSubscribed ? "Premium 已啟用" : trialExpired ? "試用已結束" : `${TRIAL_DAYS} 天免費試用`}
              </p>
              <p className="text-sm font-semibold text-inkSoft">
                {isSubscribed
                  ? "你已可使用完整導師語音與練習功能。"
                  : trialActive
                    ? `剩 ${access?.trial.daysLeft ?? 0} 天，訂閱後解鎖即時 AI 導師角色語音。`
                    : "訂閱後即可繼續完整練習。"}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-3">
          {offerings.map((offering) => (
            <motion.button
              key={offering.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => handlePurchase(offering.productId)}
              disabled={purchasing === offering.productId || isSubscribed}
              className={`w-full rounded-[28px] p-4 text-left shadow-softer transition disabled:opacity-60 ${
                offering.isFirstYearOffer
                  ? "bg-gradient-to-r from-peach to-peachDeep text-white"
                  : "border-2 border-lilacDeep bg-white text-ink"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold">{offering.period === "monthly" ? "月費方案" : "年費首年優惠"}</p>
                  <p className="text-sm font-semibold opacity-80">
                    {offering.period === "monthly" ? "完整 AI 導師語音與每日練習" : "首年優惠，適合長期練習"}
                  </p>
                </div>
                {offering.isFirstYearOffer && (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold">推薦</span>
                )}
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-3xl font-extrabold">NT$ {offering.price}</span>
                <span className="pb-1 text-sm font-bold opacity-80">
                  / {offering.period === "monthly" ? "月" : "第一年"}
                </span>
              </div>
              {offering.isFirstYearOffer && (
                <p className="mt-1 text-xs font-semibold opacity-90">第一年平均約 NT$108 / 月，之後依商店方案續訂。</p>
              )}
              <div className="mt-3 flex items-center gap-2 text-sm font-extrabold">
                {purchasing === offering.productId ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    處理中...
                  </>
                ) : (
                  <>
                    選擇方案 <ArrowRight size={16} />
                  </>
                )}
              </div>
            </motion.button>
          ))}
        </div>

        <div className="card">
          <p className="mb-3 flex items-center gap-2 font-extrabold text-ink">
            <Sparkles size={18} className="text-lilacDeep" />
            訂閱後解鎖
          </p>
          <ul className="space-y-2 text-sm font-semibold text-ink">
            <Feature>英文、日文、韓文、義大利文、西班牙文 5 種語言</Feature>
            <Feature>英文 6 位 AI 導師；日文、韓文、義大利文、西班牙文各男女 1 位</Feature>
            <Feature>AI 導師即時回覆可產生 Neural 角色語音並快取</Feature>
            <Feature>場景練習、對話練習、文章、單字完整播放</Feature>
            <Feature>同一句語音命中快取時不重複產生成本</Feature>
          </ul>
        </div>

        <div className="card bg-cream">
          <p className="mb-2 flex items-center gap-2 font-extrabold text-ink">
            <Info size={18} className="text-peachDeep" />
            試用期限制
          </p>
          <p className="text-sm font-semibold leading-relaxed text-inkSoft">
            試用期只有 7 天。為了控制成本，試用期間 AI 導師即時語音只播放已快取音檔；
            如果沒有快取，會顯示文字回覆或使用裝置內建語音。訂閱後才會為你的新回覆產生導師角色語音。
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="flex-1 rounded-3xl bg-white py-3 font-extrabold text-ink shadow-softer active:scale-95 disabled:opacity-60"
          >
            {restoring ? "恢復中..." : "恢復購買"}
          </button>
          <button
            onClick={() => router.push(isSubscribed || trialActive ? "/dashboard" : "/settings")}
            className="flex-1 rounded-3xl bg-lilac py-3 font-extrabold text-lilacDeep active:scale-95"
          >
            {trialActive ? "繼續試用" : "返回"}
          </button>
        </div>

        <p className="text-center text-xs font-semibold leading-relaxed text-inkSoft">
          訂閱與付款由 App Store / Google Play / RevenueCat 管理。你可以隨時在商店帳號中管理或取消訂閱。
        </p>
      </div>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check size={16} className="mt-0.5 shrink-0 text-mintDeep" />
      <span>{children}</span>
    </li>
  );
}
