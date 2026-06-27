"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock } from "lucide-react";
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

  function handleDemo() {
    const user = authService.loginDemo();
    go(user);
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
        onClick={handleDemo}
        className="mt-6 w-full rounded-3xl bg-gradient-to-r from-lilacDeep to-peachDeep text-white font-bold py-4 shadow-soft flex items-center justify-center gap-2 active:scale-95 transition"
      >
        <Sparkles size={20} />
        使用示範帳號快速登入
      </motion.button>
      <p className="text-center text-xs text-inkSoft mt-2">
        Demo：erin20080306@gmail.com（免密碼）
      </p>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-lilac" />
        <span className="text-xs text-inkSoft">或使用帳號登入</span>
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
