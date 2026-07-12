"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { authService } from "@/services/authService";
import { trialAccessService } from "@/services/trialAccessService";

type CaptureState = "processing" | "success" | "error";

export default function PayPalReturnClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CaptureState>("processing");
  const [message, setMessage] = useState("正在向 PayPal 確認付款，請不要關閉此頁。");
  const [hasSignedInUser, setHasSignedInUser] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void confirmPayment();
  }, []);

  async function confirmPayment() {
    const orderId = searchParams.get("token") || "";
    const user = authService.getCurrentUser();
    setHasSignedInUser(Boolean(user?.id));

    if (!orderId) {
      setState("error");
      setMessage("找不到 PayPal 訂單編號，請回到訂閱頁重新付款。");
      return;
    }
    setState("processing");
    setMessage("正在向 PayPal 確認付款，請不要關閉此頁。");
    try {
      const response = await fetch("/api/subscriptions/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          userId: user?.id || "",
          email: user?.email || "",
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setState("error");
        setMessage(String(data?.message || "付款確認失敗，請稍後再試。"));
        return;
      }

      trialAccessService.clearCache();
      setState("success");
      setMessage(
        user?.id
          ? "付款已確認，Premium 訂閱已經解鎖。"
          : "付款已確認並綁定原本的 Google 帳號，請登入該帳號使用 Premium。"
      );
    } catch {
      setState("error");
      setMessage("網路連線中斷，請重新確認付款。");
    }
  }

  return (
    <div className="min-h-[100dvh] pb-8">
      <AppHeader title="PayPal 付款確認" subtitle="安全確認訂閱狀態" back />
      <div className="px-5">
        <div className="card text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream">
            {state === "processing" ? (
              <Loader2 size={34} className="animate-spin text-lilacDeep" />
            ) : state === "success" ? (
              <CheckCircle2 size={36} className="text-mintDeep" />
            ) : (
              <TriangleAlert size={36} className="text-peachDeep" />
            )}
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-ink">
            {state === "processing" ? "確認付款中" : state === "success" ? "付款成功" : "付款尚未完成"}
          </h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-inkSoft">{message}</p>

          {state === "success" ? (
            <button
              onClick={() => router.replace(hasSignedInUser ? "/dashboard" : "/login")}
              className="mt-6 w-full rounded-3xl bg-lilacDeep py-3 font-extrabold text-white active:scale-95"
            >
              {hasSignedInUser ? "開始使用 Premium" : "登入原本的 Google 帳號"}
            </button>
          ) : state === "error" ? (
            <div className="mt-6 grid gap-3">
              <button
                onClick={() => { void confirmPayment(); }}
                className="flex w-full items-center justify-center gap-2 rounded-3xl bg-lilacDeep py-3 font-extrabold text-white active:scale-95"
              >
                <RefreshCw size={17} /> 重新確認付款
              </button>
              <button
                onClick={() => router.replace("/subscription")}
                className="w-full rounded-3xl bg-white py-3 font-extrabold text-ink shadow-softer active:scale-95"
              >
                返回訂閱方案
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
