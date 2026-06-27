"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Globe, Volume2, ShieldCheck, Users, Plus, MessageSquareWarning } from "lucide-react";
import type { User, UserSettings, OnboardingProfile } from "@/types";
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
  const [accountUser, setAccountUser] = useState<User | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    if (!user) return;
    setSettings(learningService.getSettings(user.id));
    setProfile(learningService.getProfile());
    setAccountUser(user);
  }, [user]);

  if (!ready || !user || !settings) return <div className="p-10 text-center text-inkSoft">載入中…</div>;

  const shownUser = accountUser || user;
  const deviceInfo = authService.getDeviceInfo(shownUser);
  const profiles = shownUser.profiles || [];
  const activeProfileId = shownUser.activeProfileId || profiles[0]?.id;

  function update(patch: Partial<UserSettings>) {
    const next = { ...settings!, ...patch };
    setSettings(next);
    learningService.saveSettings(next);
  }

  function addProfile() {
    const res = authService.addProfile(newProfileName);
    if (!res.ok || !res.user) {
      setProfileError(res.error || "新增學習者失敗");
      return;
    }
    setAccountUser(res.user);
    setNewProfileName("");
    setProfileError("");
  }

  function switchProfile(profileId: string) {
    const res = authService.switchProfile(profileId);
    if (!res.ok || !res.user) {
      setProfileError(res.error || "切換學習者失敗");
      return;
    }
    setAccountUser(res.user);
    setProfileError("");
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
            <p className="font-extrabold text-ink">{shownUser.name}{shownUser.isDemo && <span className="chip bg-peach text-peachDeep text-xs ml-2">Google 綁定</span>}</p>
            <p className="text-sm text-inkSoft">{shownUser.email}</p>
          </div>
          <LevelBadge level={shownUser.level} />
        </div>

        <div className="card space-y-3">
          <p className="font-bold text-ink flex items-center gap-2"><ShieldCheck size={18} className="text-mintDeep" /> Google 帳號與手機綁定</p>
          <Row label="登入方式" value={shownUser.provider === "google" ? "Google 帳號" : "本機帳號"} />
          <Row label="綁定規則" value="一個帳號只能綁定 1 支手機" />
          <Row label="綁定手機" value={`${shownUser.deviceName || deviceInfo.currentDeviceName} · ${deviceInfo.shortId}`} />
          <p className="text-xs text-inkSoft leading-relaxed">
            多位家人或同學共用同一帳號時，只能在這支手機上切換學習者；不能在多支手機同時綁定。
          </p>
        </div>

        <div className="card space-y-3">
          <p className="font-bold text-ink flex items-center gap-2"><Users size={18} className="text-lilacDeep" /> 同手機學習者</p>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => switchProfile(p.id)}
                className={`chip transition ${activeProfileId === p.id ? "bg-lilacDeep text-white" : "bg-cream text-ink"}`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="新增學習者名稱"
              className="min-w-0 flex-1 rounded-2xl bg-cream px-3 py-2 outline-none text-ink"
            />
            <button onClick={addProfile} className="h-11 w-11 rounded-2xl bg-lilacDeep text-white flex items-center justify-center active:scale-90 transition">
              <Plus size={18} />
            </button>
          </div>
          {profileError && <p className="text-sm font-semibold text-peachDeep">{profileError}</p>}
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

        <button onClick={() => router.push("/feedback")} className="w-full card !py-4 flex items-center gap-3 text-left active:scale-[0.99] transition">
          <span className="h-12 w-12 rounded-2xl bg-peach flex items-center justify-center text-peachDeep">
            <MessageSquareWarning size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-extrabold text-ink">意見回饋與日誌</span>
            <span className="block text-sm text-inkSoft">回報錯誤、語音問題或測驗建議</span>
          </span>
        </button>

        <div className="card space-y-2">
          <p className="font-bold text-ink">真人感 AI 串接建議</p>
          <Row label="免費 MVP" value="本機規則 + 內容題庫" />
          <Row label="真人對話" value="OpenAI Realtime / LLM" />
          <Row label="語音輸入" value="Whisper / Google STT" />
          <Row label="自然發音" value="OpenAI TTS 已支援；可再升級 ElevenLabs" />
          <Row label="登入綁定" value="Firebase / Supabase Auth" />
          <Row label="錯誤日誌" value="Sentry / Firebase Crashlytics" />
          <p className="text-xs text-inkSoft leading-relaxed">
            已有 OpenAI key 時會優先使用 LLM 與高品質 TTS；沒有 key 時會自動退回本機回覆與系統語音。
          </p>
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
