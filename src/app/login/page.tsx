"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, ShieldCheck, Apple } from "lucide-react";
import { authService } from "@/services/authService";
import CheerImage from "@/components/CheerImage";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function go(user: { onboarded: boolean }) {
    router.replace(user.onboarded ? "/dashboard" : "/onboarding");
  }

  function handleLogin() {
    const res = authService.login(email, password);
    if (!res.ok) {
      setError(res.error || "登入失敗");
      return;
    }
    go(res.user!);
  }

  function handleGoogle() {
    const res = authService.loginWithGoogle();
    if (!res.ok || !res.user) {
      setError(res.error || "Google 登入失敗");
      return;
    }
    go(res.user);
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
        // In production, send this to backend to verify with Apple
        // For now, create a mock user
        const mockUser = {
          id: result.response.user || "apple_" + Date.now(),
          email: result.response.email || "apple@example.com",
          name: result.response.givenName || "Apple User",
          onboarded: false,
        };
        go(mockUser);
      }
    } catch (error) {
      setError("Apple 登入失敗");
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-12 pb-8">
      <div className="text-center">
        <div className="flex justify-center mb-2">
          <CheerImage size={120} />
        </div>
        <h1 className="text-2xl font-extrabold text-ink">歡迎回來！</h1>
        <p className="text-inkSoft">登入繼續你的英文旅程</p>
      </div>

      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={handleGoogle}
        className="mt-6 w-full rounded-3xl bg-white text-ink font-bold py-4 shadow-soft flex items-center justify-center gap-2 active:scale-95 transition border-2 border-lilac"
      >
        <ShieldCheck size={20} className="text-lilacDeep" />
        使用 Google 帳號登入
      </motion.button>

      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={handleApple}
        className="mt-3 w-full rounded-3xl bg-black text-white font-bold py-4 shadow-soft flex items-center justify-center gap-2 active:scale-95 transition"
      >
        <Apple size={20} />
        使用 Apple 帳號登入
      </motion.button>

      <p className="text-center text-xs text-inkSoft mt-2">
        一個帳號只能綁定 1 支手機；同一支手機可切換多位學習者。
      </p>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-lilac" />
        <span className="text-xs text-inkSoft">或使用本機帳密登入</span>
        <div className="flex-1 h-px bg-lilac" />
      </div>

      <div className="space-y-3">
        <Field icon={<Mail size={18} />} placeholder="Email" value={email} onChange={setEmail} type="email" />
        <Field icon={<Lock size={18} />} placeholder="密碼" value={password} onChange={setPassword} type="password" />
        {error && <p className="text-peachDeep text-sm font-semibold">{error}</p>}
        <button className="btn-primary w-full" onClick={handleLogin}>
          登入
        </button>
      </div>

      <p className="text-center text-inkSoft mt-6">
        還沒有帳號？{" "}
        <button className="text-lilacDeep font-bold" onClick={() => router.push("/register")}>
          立即註冊
        </button>
      </p>
    </div>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-3xl px-4 py-3 shadow-softer">
      <span className="text-inkSoft">{icon}</span>
      <input
        className="flex-1 bg-transparent outline-none text-ink"
        placeholder={placeholder}
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
