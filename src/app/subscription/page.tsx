"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, Check, Copy, Crown, RefreshCw, Settings, Sparkles } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { authService } from "@/services/authService";
import { subscriptionService } from "@/services/subscriptionService";
import { supabaseBrowserClient } from "@/services/supabaseBrowserClient";
import { trialAccessService, type AccessState, TRIAL_DAYS } from "@/services/trialAccessService";
import type { SubscriptionOffering } from "@/types/subscription";

const PRELAUNCH_PROMO_CODE = "qwe811122@661012";
const THIRTY_DAY_PROMO_CODE = "qwe931016@";
const BANK_ACCOUNT = "901560071034";

const PRELAUNCH_PAYMENT_LINKS = {
  monthly: {
    price: 399,
    promoPrice: 299,
  },
  yearly: {
    price: 1290,
    renewalPrice: 2199,
    promoPrice: 1090,
  },
};

export default function SubscriptionPage() {
  const router = useRouter();
  const [offerings, setOfferings] = useState<SubscriptionOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [redeemingPromo, setRedeemingPromo] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"monthly" | "yearly">("monthly");
  const [access, setAccess] = useState<AccessState | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [purchaseMessage, setPurchaseMessage] = useState("");

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
      promoApplied,
    };
  }

  const selectedOffering = useMemo(
    () => offerings.find((offering) => offering.period === selectedPeriod) || offerings[0] || null,
    [offerings, selectedPeriod]
  );

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(BANK_ACCOUNT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setPurchaseMessage(`請手動複製付款帳號：${BANK_ACCOUNT}`);
    }
  }

  async function notifyAdmin() {
    const user = authService.getCurrentUser();
    if (!user?.email) {
      setPurchaseMessage("請先登入 Google 帳號，再通知管理員。");
      return;
    }
    if (!selectedOffering) {
      setPurchaseMessage("請先選擇付款方案。");
      return;
    }
    if (!supabaseBrowserClient) {
      setPurchaseMessage("登入服務尚未設定，請稍後再試。");
      return;
    }

    setNotifying(true);
    setPurchaseMessage("");
    try {
      const { data } = await supabaseBrowserClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setPurchaseMessage("登入狀態已失效，請重新登入 Google 帳號。");
        return;
      }

      const response = await fetch("/api/subscriptions/manual-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          period: selectedOffering.period,
          promoCode: isPromoApplied() ? promoCode : "",
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "目前無法通知管理員。");
      }
      setPurchaseMessage(result.message || "已通知管理員，核對款項後會為你開通。");
    } catch (error) {
      setPurchaseMessage(error instanceof Error ? error.message : "目前無法通知管理員。");
    } finally {
      setNotifying(false);
    }
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

          {offerings.map((offering) => {
            const selected = selectedOffering?.period === offering.period;
            return (
              <motion.button
                key={offering.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedPeriod(offering.period)}
                disabled={isSubscribed}
                className={`w-full rounded-[28px] p-4 text-left shadow-softer transition disabled:opacity-60 ${
                  selected
                    ? "border-2 border-lilacDeep bg-lilacLight text-ink"
                    : offering.isFirstYearOffer
                      ? "bg-gradient-to-r from-peach to-peachDeep text-white"
                      : "border-2 border-transparent bg-white text-ink"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-extrabold">{offering.period === "monthly" ? "月費方案" : "年費首年優惠"}</p>
                    <p className="text-sm font-semibold opacity-80">
                      {offering.period === "monthly" ? "完整 AI 導師語音與每日練習" : "首年優惠，適合長期練習"}
                    </p>
                  </div>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${selected ? "bg-lilacDeep text-white" : "bg-white/30"}`}>
                    {selected ? <Check size={16} /> : null}
                  </span>
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-3xl font-extrabold">NT$ {getPaymentTarget(offering).price}</span>
                  <span className="pb-1 text-sm font-bold opacity-80">/ {offering.period === "monthly" ? "月" : "第一年"}</span>
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
              </motion.button>
            );
          })}
        </div>

        {!isSubscribed && selectedOffering && (
          <section className="rounded-[28px] bg-white p-5 shadow-soft">
            <p className="text-sm font-extrabold text-ink">銀行轉帳付款</p>
            <p className="mt-1 text-xs font-bold text-inkSoft">
              請轉帳 NT$ {getPaymentTarget(selectedOffering).price}，完成後按下通知按鈕。
            </p>

            <div className="mt-4 rounded-2xl bg-cream px-4 py-4">
              <p className="text-[11px] font-extrabold text-inkSoft">付款帳號</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="break-all text-xl font-extrabold tracking-wide text-ink">{BANK_ACCOUNT}</p>
                <button
                  type="button"
                  onClick={() => void copyAccount()}
                  className="shrink-0 rounded-full bg-white p-2 text-lilacDeep shadow-softer active:scale-95"
                  aria-label="複製付款帳號"
                >
                  <Copy size={17} />
                </button>
              </div>
              {copied && <p className="mt-1 text-xs font-extrabold text-mintDeep">已複製帳號</p>}
            </div>

            <button
              type="button"
              onClick={() => void notifyAdmin()}
              disabled={notifying}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl bg-lilacDeep py-3.5 text-sm font-extrabold text-white shadow-softer active:scale-[0.98] disabled:opacity-60"
            >
              {notifying ? <RefreshCw size={17} className="animate-spin" /> : <Bell size={17} />}
              {notifying ? "通知中..." : "已付款，通知管理員"}
            </button>
          </section>
        )}

        {purchaseMessage && (
          <p className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold text-peachDeep">
            {purchaseMessage}
          </p>
        )}

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
          轉帳後請按「已付款，通知管理員」；管理員核對款項後會在後台開通 Premium。
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
