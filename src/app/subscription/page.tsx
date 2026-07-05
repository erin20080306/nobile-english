"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Check, Crown, Info, RefreshCw, Settings, Sparkles } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { authService } from "@/services/authService";
import { subscriptionService } from "@/services/subscriptionService";
import { trialAccessService, type AccessState, TRIAL_DAYS } from "@/services/trialAccessService";
import type { SubscriptionOffering } from "@/types/subscription";

const PRELAUNCH_PROMO_CODE = "qwe811122@661012";
const THIRTY_DAY_PROMO_CODE = "qwe931016@";
const PRELAUNCH_PAYMENT_LINKS = {
  monthly: {
    price: 399,
    url: "https://www.paypal.com/ncp/payment/A3ECG8WXHHAE6",
    promoPrice: 299,
    promoUrl: "https://www.paypal.com/ncp/payment/AXKW9C87A8GZ6",
  },
  yearly: {
    price: 1290,
    url: "https://www.paypal.com/ncp/payment/TZAPMTMDB9PAW",
    renewalPrice: 2199,
    renewalUrl: "https://www.paypal.com/ncp/payment/PETZYPM7UPBBJ",
    promoPrice: 1090,
    promoUrl: "https://www.paypal.com/ncp/payment/ZMW4ZN2KDZJ6U",
  },
};

export default function SubscriptionPage() {
  const router = useRouter();
  const [offerings, setOfferings] = useState<SubscriptionOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [redeemingPromo, setRedeemingPromo] = useState(false);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");

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

  function isPromoApplied() {
    return promoCode.trim().toLowerCase() === PRELAUNCH_PROMO_CODE;
  }

  function isTrialPromoCode() {
    return promoCode.trim().toLowerCase() === THIRTY_DAY_PROMO_CODE;
  }

  function getPaymentTarget(offering: SubscriptionOffering) {
    const payment = PRELAUNCH_PAYMENT_LINKS[offering.period];
    const promoApplied = isPromoApplied();
    return {
      price: promoApplied ? payment.promoPrice : payment.price,
      url: promoApplied ? payment.promoUrl : payment.url,
      promoApplied,
    };
  }

  function handlePurchase(offering: SubscriptionOffering) {
    const target = getPaymentTarget(offering);
    setPurchasing(offering.productId);
    window.location.assign(target.url);
  }

  async function handleRedeemTrialPromo() {
    const user = authService.getCurrentUser();
    if (!user?.id || !user.email) {
      setPromoMessage("請先登入 Google 帳號後再兌換。");
      return;
    }
    setRedeemingPromo(true);
    setPromoMessage("");
    try {
      const response = await fetch("/api/promo-trials/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          code: promoCode,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setPromoMessage(String(data?.message || "優惠碼兌換失敗。"));
        return;
      }
      trialAccessService.clearCache();
      await load();
      setPromoMessage("已啟用 30 天優惠試用，練習、閱讀、農場補給與商店每日各最多 20 次。");
    } catch {
      setPromoMessage("優惠碼兌換失敗，請稍後再試。");
    } finally {
      setRedeemingPromo(false);
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
  const promoTrialActive = access?.reason === "promo_trial";
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
                {isSubscribed ? "Premium 已啟用" : promoTrialActive ? "30 天優惠試用中" : trialExpired ? "試用已結束" : `${TRIAL_DAYS} 天免費試用`}
              </p>
              <p className="text-sm font-semibold text-inkSoft">
                {isSubscribed
                  ? "你已可使用完整導師語音與練習功能。"
                  : promoTrialActive
                    ? `剩 ${access?.promoTrial?.daysLeft ?? 0} 天，練習、閱讀、農場補給與商店每日各最多 ${access?.promoTrial?.maxFeatureUses ?? 20} 次。`
                    : trialActive
                    ? `剩 ${access?.trial.daysLeft ?? 0} 天，訂閱後解鎖即時 AI 導師角色語音。`
                    : "訂閱後即可繼續完整練習。"}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-3">
          <div className="rounded-[24px] bg-white p-3 shadow-softer">
            <label htmlFor="promo-code" className="text-xs font-extrabold text-inkSoft">
              優惠碼
            </label>
            <input
              id="promo-code"
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value)}
              placeholder="輸入優惠碼或 30 天試用碼"
              className="mt-1 w-full rounded-2xl bg-cream px-3 py-2 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-lilacDeep"
            />
            {promoCode.trim() && (
              <p className={`mt-1 text-xs font-bold ${isPromoApplied() || isTrialPromoCode() ? "text-mintDeep" : "text-peachDeep"}`}>
                {isPromoApplied()
                  ? "付款優惠碼已套用"
                  : isTrialPromoCode()
                    ? "30 天試用碼可兌換：限 2 位，練習、閱讀、農場每日各 20 次"
                    : "優惠碼不符合"}
              </p>
            )}
            {isTrialPromoCode() && (
              <button
                onClick={() => { void handleRedeemTrialPromo(); }}
                disabled={redeemingPromo || promoTrialActive || isSubscribed}
                className="mt-3 w-full rounded-3xl bg-mintDeep py-3 text-sm font-extrabold text-white shadow-softer active:scale-95 disabled:opacity-60"
              >
                {promoTrialActive ? "30 天試用已啟用" : redeemingPromo ? "兌換中..." : "兌換 30 天免費試用"}
              </button>
            )}
            {promoMessage && (
              <p className={`mt-2 text-xs font-bold ${promoMessage.startsWith("已啟用") ? "text-mintDeep" : "text-peachDeep"}`}>
                {promoMessage}
              </p>
            )}
          </div>

          {offerings.map((offering) => (
            <motion.button
              key={offering.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => handlePurchase(offering)}
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
                <span className="text-3xl font-extrabold">NT$ {getPaymentTarget(offering).price}</span>
                <span className="pb-1 text-sm font-bold opacity-80">
                  / {offering.period === "monthly" ? "月" : "第一年"}
                </span>
              </div>
              {getPaymentTarget(offering).promoApplied && (
                <p className="mt-1 text-xs font-semibold opacity-90">
                  已套用優惠碼，原價 NT$ {PRELAUNCH_PAYMENT_LINKS[offering.period].price}
                </p>
              )}
              {offering.isFirstYearOffer && (
                <p className="mt-1 text-xs font-semibold opacity-90">
                  第一年平均約 NT$108 / 月；原年費 NT$ {PRELAUNCH_PAYMENT_LINKS.yearly.renewalPrice}。
                </p>
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
          上架前測試付款暫時導向 PayPal；正式上架後會移除這些付款連結並恢復商店訂閱流程。
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
