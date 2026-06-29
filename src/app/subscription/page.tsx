"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Crown, Check, ArrowRight, RefreshCw, Settings, Info } from "lucide-react";
import { subscriptionService } from "@/services/subscriptionService";
import type { SubscriptionOffering } from "@/types/subscription";
import AppHeader from "@/components/AppHeader";

export default function SubscriptionPage() {
  const router = useRouter();
  const [offerings, setOfferings] = useState<SubscriptionOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [entitlement, setEntitlement] = useState<{ isActive: boolean; expiresAt: string | null } | null>(null);

  useEffect(() => {
    loadOfferings();
    loadEntitlement();
  }, []);

  async function loadOfferings() {
    try {
      const data = await subscriptionService.getOfferings();
      setOfferings(data);
    } catch (error) {
      console.error("Failed to load offerings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadEntitlement() {
    try {
      const data = await subscriptionService.getEntitlement();
      setEntitlement(data);
    } catch (error) {
      console.error("Failed to load entitlement:", error);
    }
  }

  async function handlePurchase(productId: string) {
    setPurchasing(productId);
    try {
      const result = await subscriptionService.purchase(productId);
      if (result.success) {
        await loadEntitlement();
      } else {
        alert(result.error || "購買失敗");
      }
    } catch (error) {
      alert("購買發生錯誤");
    } finally {
      setPurchasing(null);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const result = await subscriptionService.restorePurchases();
      if (result.success) {
        await loadEntitlement();
        alert(`成功恢復 ${result.restoredCount} 個購買`);
      } else {
        alert(result.error || "恢復失敗");
      }
    } catch (error) {
      alert("恢復發生錯誤");
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
        <p className="text-inkSoft">載入中…</p>
      </div>
    );
  }

  const isPremium = entitlement?.isActive;

  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader
        title="訂閱方案"
        subtitle="解鎖所有進階功能"
        back={true}
        right={
          <button onClick={handleManage} className="chip bg-white text-inkSoft shadow-softer flex items-center gap-1">
            <Settings size={14} /> 管理
          </button>
        }
      />

      <div className="px-5 space-y-4">
        {isPremium && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card bg-gradient-to-r from-lilac to-lilacDeep text-white"
          >
            <div className="flex items-center gap-2 mb-2">
              <Crown size={20} />
              <p className="font-extrabold">Premium 會員</p>
            </div>
            <p className="text-sm opacity-90">
              {entitlement.expiresAt
                ? `有效期至 ${new Date(entitlement.expiresAt).toLocaleDateString("zh-TW")}`
                : "永久有效"}
            </p>
          </motion.div>
        )}

        <div className="card">
          <p className="font-bold text-ink mb-3">選擇方案</p>
          <div className="space-y-3">
            {offerings.map((offering) => (
              <motion.button
                key={offering.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePurchase(offering.productId)}
                disabled={purchasing === offering.productId}
                className={`w-full rounded-3xl p-4 text-left transition ${
                  offering.isFirstYearOffer
                    ? "bg-gradient-to-r from-peach to-peachDeep text-white shadow-soft"
                    : "bg-white border-2 border-lilacDeep shadow-softer"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-lg">
                    {offering.period === "monthly" ? "月費" : "年費"}
                  </span>
                  {offering.isFirstYearOffer && (
                    <span className="chip bg-white/20 text-white text-xs">首年優惠</span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-extrabold">NT$ {offering.price}</span>
                  <span className="text-sm opacity-80">/ {offering.period === "monthly" ? "月" : "年"}</span>
                </div>
                {offering.isFirstYearOffer && (
                  <p className="text-xs opacity-90">
                    第二年起 NT$ 2,199 / 年自動續訂
                  </p>
                )}
                {purchasing === offering.productId && (
                  <p className="text-sm mt-2">處理中…</p>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="font-bold text-ink mb-3 flex items-center gap-2">
            <Info size={16} className="text-lilacDeep" />
            Premium 會員權益
          </p>
          <ul className="space-y-2 text-sm text-ink">
            <li className="flex items-start gap-2">
              <Check size={16} className="text-mintDeep shrink-0 mt-0.5" />
              <span>無限次對話練習</span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="text-mintDeep shrink-0 mt-0.5" />
              <span>所有場景與主題解鎖</span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="text-mintDeep shrink-0 mt-0.5" />
              <span>AI 導師進階語音</span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="text-mintDeep shrink-0 mt-0.5" />
              <span>個人化學習報告</span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="text-mintDeep shrink-0 mt-0.5" />
              <span>優先客服支援</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="flex-1 rounded-3xl bg-white text-ink font-bold py-3 shadow-softer flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <RefreshCw size={16} className={restoring ? "animate-spin" : ""} />
            {restoring ? "恢復中…" : "恢復購買"}
          </button>
          <button
            onClick={() => router.push("/settings")}
            className="flex-1 rounded-3xl bg-cream text-ink font-bold py-3 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            設定
          </button>
        </div>

        <p className="text-xs text-inkSoft text-center leading-relaxed">
          訂閱會自動續訂，除非在到期前至少 24 小時取消。
          <br />
          購買即表示同意服務條款與隱私權政策。
        </p>
      </div>
    </div>
  );
}
