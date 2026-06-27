"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Globe, Volume2 } from "lucide-react";
import type { UserSettings, OnboardingProfile } from "@/types";
import { useUser } from "@/hooks/useUser";
import { learningService } from "@/services/learningService";
import { authService } from "@/services/authService";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import { Toggle, LevelBadge } from "@/components/ui";

export default function SettingsPage() {
  const { user, ready } = useUser({ requireOnboarded: true });
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [profile, setProfile] = useState<Partial<OnboardingProfile>>({});

  useEffect(() => {
    if (!user) return;
    setSettings(learningService.getSettings(user.id));
    setProfile(learningService.getProfile());
  }, [user]);

  if (!ready || !user || !settings) return <div className="p-10 text-center text-inkSoft">載入中…</div>;

  function update(patch: Partial<UserSettings>) {
    const next = { ...settings!, ...patch };
    setSettings(next);
    learningService.saveSettings(next);
  }

  function logout() {
    authService.logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader title="個人設定" subtitle="帳號與中文輔助設定" back={false} />
      <div className="px-5 space-y-4">
        <div className="card flex items-center gap-3">
          <div className="h-14 w-14 rounded-3xl bg-lilac flex items-center justify-center"><UserIcon className="text-lilacDeep" /></div>
          <div className="flex-1">
            <p className="font-extrabold text-ink">{user.name}{user.isDemo && <span className="chip bg-peach text-peachDeep text-xs ml-2">示範帳號</span>}</p>
            <p className="text-sm text-inkSoft">{user.email}</p>
          </div>
          <LevelBadge level={user.level} />
        </div>

        <div className="card">
          <p className="font-bold text-ink mb-2">學習資料</p>
          <Row label="學習語言" value={profile.language || "English"} />
          <Row label="學習目標" value={profile.learningGoal || "—"} />
          <Row label="每日目標" value={`${profile.dailyGoalMinutes || 15} 分鐘`} />
          <Row label="興趣" value={(profile.interests || []).join("、") || "—"} />
        </div>

        <div className="card space-y-4">
          <p className="font-bold text-ink flex items-center gap-2"><Volume2 size={18} className="text-lilacDeep" /> 一般</p>
          <Toggle label="發音功能（美式優先）" checked={settings.pronunciationOn} onChange={(v) => update({ pronunciationOn: v })} />
          <Toggle label="全域中文輔助" checked={settings.showChineseGlobal} onChange={(v) => update({ showChineseGlobal: v })} />
        </div>

        <div className="card space-y-4">
          <p className="font-bold text-ink flex items-center gap-2"><Globe size={18} className="text-mintDeep" /> 中文顯示控制</p>
          <Toggle label="場景練習顯示中文" checked={settings.sceneChinese} onChange={(v) => update({ sceneChinese: v })} />
          <Toggle label="對話練習顯示中文" checked={settings.dialogueChinese} onChange={(v) => update({ dialogueChinese: v })} />
          <Toggle label="單字複習顯示中文" checked={settings.wordReviewChinese} onChange={(v) => update({ wordReviewChinese: v })} />
          <Toggle label="句子複習顯示中文" checked={settings.sentenceReviewChinese} onChange={(v) => update({ sentenceReviewChinese: v })} />
          <Toggle label="測驗解析顯示中文" checked={settings.examChinese} onChange={(v) => update({ examChinese: v })} />
        </div>

        <button onClick={logout} className="w-full rounded-3xl bg-white text-peachDeep font-bold py-4 shadow-softer flex items-center justify-center gap-2 active:scale-95 transition">
          <LogOut size={18} /> 登出
        </button>
        <p className="text-center text-xs text-inkSoft">Mobile English · MVP · 資料儲存在本機 localStorage</p>
      </div>
      <BottomNav />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-cream last:border-0">
      <span className="text-inkSoft text-sm">{label}</span>
      <span className="text-ink font-semibold text-sm text-right max-w-[60%]">{value}</span>
    </div>
  );
}
