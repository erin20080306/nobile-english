"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EnglishLevel } from "@/types";
import { authService } from "@/services/authService";
import { Toggle } from "@/components/ui";
import AppHeader from "@/components/AppHeader";
import { ShieldCheck } from "lucide-react";

const goals = ["旅遊英文", "職場英文", "日常會話", "面試英文", "考試英文"];
const levels: EnglishLevel[] = ["Beginner", "Elementary", "Intermediate", "Upper-Intermediate", "Advanced"];
const minutes = [5, 10, 15, 30];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    learningGoal: "日常會話",
    dailyGoalMinutes: 15,
    selfRatedLevel: "Beginner" as EnglishLevel,
    showChinese: true,
  });
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit() {
    if (!form.name || !form.email || !form.password) {
      setError("請填寫姓名、Email 與密碼");
      return;
    }
    if (form.password !== form.confirm) {
      setError("兩次密碼不一致");
      return;
    }
    const res = authService.register({
      name: form.name,
      email: form.email,
      password: form.password,
      learningGoal: form.learningGoal,
      dailyGoalMinutes: form.dailyGoalMinutes,
      selfRatedLevel: form.selfRatedLevel,
      showChinese: form.showChinese,
    });
    if (!res.ok) {
      setError(res.error || "註冊失敗");
      return;
    }
    // auto login then onboarding
    authService.login(form.email, form.password);
    router.replace("/onboarding");
  }

  return (
    <div className="min-h-[100dvh] flex flex-col pb-8">
      <AppHeader title="建立帳號" subtitle="填寫基本資料開始學習" />
      <div className="px-5 space-y-4">
        <button
          onClick={() => router.push("/login")}
          className="card !py-4 w-full text-left flex items-center gap-3 active:scale-[0.99] transition"
        >
          <span className="h-11 w-11 rounded-2xl bg-mint flex items-center justify-center text-mintDeep">
            <ShieldCheck size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-extrabold text-ink">建議使用 Google 帳號綁定</span>
            <span className="block text-sm text-inkSoft">一個帳號只綁定 1 支手機，同手機可切換多位學習者。</span>
          </span>
        </button>

        <Input label="姓名" value={form.name} onChange={(v) => set("name", v)} />
        <Input label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
        <Input label="密碼" type="password" value={form.password} onChange={(v) => set("password", v)} />
        <Input label="確認密碼" type="password" value={form.confirm} onChange={(v) => set("confirm", v)} />

        <Group label="學習目標">
          <Chips options={goals} value={form.learningGoal} onChange={(v) => set("learningGoal", v)} />
        </Group>

        <Group label="每日預計學習時間">
          <Chips
            options={minutes.map((m) => `${m} 分鐘`)}
            value={`${form.dailyGoalMinutes} 分鐘`}
            onChange={(v) => set("dailyGoalMinutes", parseInt(v))}
          />
        </Group>

        <Group label="英文程度自評">
          <Chips
            options={levels}
            value={form.selfRatedLevel}
            onChange={(v) => set("selfRatedLevel", v as EnglishLevel)}
          />
        </Group>

        <div className="card !py-4">
          <Toggle label="顯示繁體中文輔助" checked={form.showChinese} onChange={(v) => set("showChinese", v)} />
        </div>

        {error && <p className="text-peachDeep text-sm font-semibold">{error}</p>}
        <button className="btn-primary w-full" onClick={submit}>
          註冊並開始
        </button>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-inkSoft">{label}</span>
      <input
        className="mt-1 w-full bg-white rounded-3xl px-4 py-3 shadow-softer outline-none text-ink"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-inkSoft mb-2">{label}</p>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`chip transition ${value === o ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
