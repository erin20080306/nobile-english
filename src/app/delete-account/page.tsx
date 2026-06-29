"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react";
import AppHeader from "@/components/AppHeader";

export default function DeleteAccountPage() {
  const router = useRouter();
  const [step, setStep] = useState<"confirm" | "verify" | "processing" | "done">("confirm");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleDelete() {
    if (step === "confirm") {
      setStep("verify");
      return;
    }

    if (step === "verify") {
      if (!email || !password) {
        setError("請輸入電子郵件與密碼");
        return;
      }
      setStep("processing");
      setError("");

      try {
        const res = await fetch("/api/account/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (res.ok) {
          setStep("done");
        } else {
          const data = await res.json();
          setError(data.error || "刪除失敗");
          setStep("verify");
        }
      } catch (err) {
        setError("網路錯誤，請稍後再試");
        setStep("verify");
      }
    }
  }

  if (step === "done") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 rounded-full bg-mint flex items-center justify-center mb-4"
        >
          <Check size={40} className="text-mintDeep" />
        </motion.div>
        <h1 className="text-2xl font-extrabold text-ink mb-2">帳號已刪除</h1>
        <p className="text-center text-inkSoft mb-6">
          您的帳號與所有資料已被永久刪除。
          <br />
          感謝您使用 Mobile English。
        </p>
        <button onClick={() => router.push("/")} className="btn-primary">
          回到首頁
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader
        title="刪除帳號"
        subtitle="永久刪除您的帳號與資料"
        back={true}
      />

      <div className="px-5 space-y-4">
        <div className="card bg-peach/10 border-2 border-peach">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-peachDeep shrink-0 mt-0.5" />
            <div className="text-sm text-ink">
              <p className="font-bold text-peachDeep mb-1">此操作無法復原</p>
              <p className="leading-relaxed">
                刪除帳號後，以下資料將被永久刪除：
              </p>
              <ul className="mt-2 space-y-1 text-inkSoft">
                <li>• 個人資料與設定</li>
                <li>• 學習紀錄與進度</li>
                <li>• 對話紀錄與語音辨識文字</li>
                <li>• 單字複習與收藏</li>
                <li>• 訂閱記錄（法律必要資料除外）</li>
              </ul>
            </div>
          </div>
        </div>

        {step === "verify" && (
          <div className="card space-y-3">
            <div>
              <label className="text-sm font-bold text-ink mb-1 block">電子郵件</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="請輸入您的電子郵件"
                className="w-full rounded-2xl bg-cream px-4 py-3 outline-none text-ink"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-ink mb-1 block">密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請輸入您的密碼"
                className="w-full rounded-2xl bg-cream px-4 py-3 outline-none text-ink"
              />
            </div>
            {error && <p className="text-sm font-semibold text-peachDeep">{error}</p>}
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={step === "processing"}
          className="w-full rounded-3xl bg-peachDeep text-white font-bold py-4 shadow-softer flex items-center justify-center gap-2 active:scale-95 transition"
        >
          {step === "processing" ? "處理中…" : step === "confirm" ? "確認刪除" : "確認並刪除"}
        </button>

        <button
          onClick={() => router.back()}
          className="w-full rounded-3xl bg-white text-ink font-bold py-4 shadow-softer active:scale-95 transition"
        >
          取消
        </button>

        <p className="text-xs text-inkSoft text-center leading-relaxed">
          如果您遇到問題，請聯絡客服：
          <br />
          <a href="mailto:support@mobileenglish.app" className="text-lilacDeep">
            support@mobileenglish.app
          </a>
        </p>
      </div>
    </div>
  );
}
