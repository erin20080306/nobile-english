"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Apple } from "lucide-react";
import { authService } from "@/services/authService";
import { cloudAppStateService } from "@/services/cloudAppStateService";
import CheerImage from "@/components/CheerImage";

const SHOW_APPLE_LOGIN = false;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function go(user: { onboarded: boolean; id: string; email?: string }) {
    // Restore cloud data immediately after login
    await cloudAppStateService.restoreForUser({ id: user.id, email: user.email || "" });
    router.replace(user.onboarded ? "/dashboard" : "/onboarding");
  }

  async function handleGoogle() {
    const res = authService.loginWithGoogle();
    if (!res.ok || !res.user) {
      setError(res.error || "Google 登入失敗");
      return;
    }
    await go(res.user);
  }

  async function handleApple() {
    try {
      const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
      const result = await SignInWithApple.authorize({
        clientId: "com.mobileenglish.app",
        redirectURI: "https://nobile-english.vercel.app",
        scopes: "email name",
        state: "123456",
        nonce: "nonce",
      });

      if (result.response) {
        const res = authService.loginWithApple({
          id: result.response.user || "apple_" + Date.now(),
          email: result.response.email || "apple@example.com",
          name: result.response.givenName || "Apple User",
        });
        if (!res.ok || !res.user) {
          setError(res.error || "Apple 登入失敗");
          return;
        }
        await go(res.user);
      }
    } catch {
      setError("Apple 登入僅支援 iOS 裝置");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-[100dvh] flex flex-col px-6 pt-12 pb-8"
    >
      <div className="text-center">
        <div className="flex justify-center mb-2">
          <CheerImage size={120} />
        </div>
        <h1 className="text-2xl font-extrabold text-ink">歡迎回來！</h1>
        <p className="text-inkSoft">登入繼續你的語言旅程</p>
      </div>

      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full rounded-3xl bg-white text-ink font-bold py-4 shadow-soft flex items-center justify-center gap-2 transition-colors border-2 border-lilac active:scale-95"
        >
          <ShieldCheck size={20} className="text-lilacDeep" />
          使用 Google 帳號登入
        </button>

        {SHOW_APPLE_LOGIN && (
          <button
            type="button"
            onClick={handleApple}
            className="w-full rounded-3xl bg-black text-white font-bold py-4 shadow-soft flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <Apple size={20} />
            使用 Apple 帳號登入
          </button>
        )}

        {error && <p className="text-peachDeep text-sm font-semibold text-center">{error}</p>}
      </div>

      <p className="text-center text-xs text-inkSoft mt-6">
        一個帳號只能綁定 1 支手機；同一支手機可切換多位學習者。
      </p>
    </motion.div>
  );
}
