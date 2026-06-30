"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Globe, Volume2, ShieldCheck, Users, Plus, MessageSquareWarning, GraduationCap, Crown, RefreshCw, Trash2, FileText, Mail, ArrowRight } from "lucide-react";
import type { User, UserSettings, OnboardingProfile } from "@/types";
import { useUser } from "@/hooks/useUser";
import { learningService } from "@/services/learningService";
import { authService } from "@/services/authService";
import { LEARNING_LANGUAGES, getLearningLanguage } from "@/data/learningLanguages";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import TutorSelector from "@/components/TutorSelector";
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
  const currentLanguage = getLearningLanguage(settings.targetLanguage);
  const currentSpeechRate = settings.speechRateByLanguage?.[settings.targetLanguage] ?? 1;

  function update(patch: Partial<UserSettings>) {
    const next = { ...settings!, ...patch };
    setSettings(next);
    learningService.saveSettings(next);
  }

  function updateChineseSupport(enabled: boolean) {
    update({
      showChineseGlobal: enabled,
      sceneChinese: enabled,
      dialogueChinese: enabled,
      wordReviewChinese: enabled,
      sentenceReviewChinese: enabled,
      examChinese: enabled,
    });
  }

  function updateLanguage(code: UserSettings["targetLanguage"]) {
    const language = getLearningLanguage(code);
    const next = { ...settings!, targetLanguage: code };
    setSettings(next);
    learningService.saveSettings(next);
    const nextProfile = { ...profile, language: language.label };
    setProfile(nextProfile);
    learningService.saveProfile(nextProfile);
  }

  function updateSpeechRate(code: UserSettings["targetLanguage"], value: number) {
    const next = {
      ...settings!,
      speechRateByLanguage: {
        ...settings!.speechRateByLanguage,
        [code]: value,
      },
    };
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
          <Row label="學習語言" value={`${currentLanguage.flag} ${currentLanguage.zhName}`} />
          <Row label="學習目標" value={profile.learningGoal || "—"} />
          <Row label="每日目標" value={`${profile.dailyGoalMinutes || 15} 分鐘`} />
          <Row label="興趣" value={(profile.interests || []).join("、") || "—"} />
        </div>

        <div className="card">
          <p className="font-bold text-ink flex items-center gap-2"><Globe size={18} className="text-mintDeep" /> 切換學習語言</p>
          <p className="mt-1 text-xs text-inkSoft">英文、日文、韓文、義大利文、西班牙文可自由切換；舊紀錄會保留在學習紀錄中。</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {LEARNING_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => updateLanguage(lang.code)}
                className={`rounded-2xl px-3 py-3 text-left font-extrabold transition active:scale-95 ${
                  settings.targetLanguage === lang.code ? "bg-lilacDeep text-white shadow-soft" : "bg-cream text-ink"
                }`}
              >
                <span className="block text-base">{lang.flag} {lang.zhName}</span>
                <span className={`block text-xs ${settings.targetLanguage === lang.code ? "text-white/75" : "text-inkSoft"}`}>{lang.nativeName}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card space-y-3">
          <p className="font-bold text-ink flex items-center gap-2"><GraduationCap size={18} className="text-lilacDeep" /> AI 導師</p>
          <p className="text-xs text-inkSoft">為「{currentLanguage.flag} {currentLanguage.zhName}」選擇男生或女生導師，對話與情境練習都會使用這位導師的聲音。</p>
          <TutorSelector targetLanguage={settings.targetLanguage} />
        </div>

        <div className="card space-y-4">
          <p className="font-bold text-ink flex items-center gap-2"><Volume2 size={18} className="text-lilacDeep" /> 一般</p>
          <Toggle label={`${currentLanguage.zhName}發音功能`} checked={settings.pronunciationOn} onChange={(v) => update({ pronunciationOn: v })} />
          <div className="rounded-3xl bg-cream p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-ink">目前語速</span>
              <span className="chip bg-lilac text-lilacDeep text-xs">{currentSpeechRate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.75"
              max="1.25"
              step="0.05"
              value={currentSpeechRate}
              onChange={(e) => updateSpeechRate(settings.targetLanguage, Number(e.target.value))}
              className="mt-3 w-full accent-lilacDeep"
              aria-label={`${currentLanguage.zhName}語速`}
            />
          </div>
          <Toggle label="全域中文輔助" checked={settings.showChineseGlobal} onChange={updateChineseSupport} />
        </div>

        <div className="card space-y-3">
          <p className="font-bold text-ink flex items-center gap-2"><Volume2 size={18} className="text-mintDeep" /> 各語言語速</p>
          {LEARNING_LANGUAGES.map((lang) => {
            const rate = settings.speechRateByLanguage?.[lang.code] ?? 1;
            return (
              <div key={lang.code} className="rounded-3xl bg-cream p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-extrabold text-ink">{lang.flag} {lang.zhName}</span>
                  <span className="text-xs font-bold text-inkSoft">{rate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.25"
                  step="0.05"
                  value={rate}
                  onChange={(e) => updateSpeechRate(lang.code, Number(e.target.value))}
                  className="mt-2 w-full accent-lilacDeep"
                  aria-label={`${lang.zhName}語速`}
                />
              </div>
            );
          })}
        </div>

        <div className="card space-y-4">
          <p className="font-bold text-ink flex items-center gap-2"><Globe size={18} className="text-mintDeep" /> 中文顯示控制</p>
          <Toggle label="場景練習顯示中文" checked={settings.sceneChinese} onChange={(v) => update({ sceneChinese: v })} />
          <Toggle label="對話練習顯示中文" checked={settings.dialogueChinese} onChange={(v) => update({ dialogueChinese: v })} />
          <Toggle label="單字複習顯示中文" checked={settings.wordReviewChinese} onChange={(v) => update({ wordReviewChinese: v })} />
          <Toggle label="句子複習顯示中文" checked={settings.sentenceReviewChinese} onChange={(v) => update({ sentenceReviewChinese: v })} />
          <Toggle label="測驗解析顯示中文" checked={settings.examChinese} onChange={(v) => update({ examChinese: v })} />
        </div>

        <button onClick={() => router.push("/subscription")} className="w-full card !py-4 flex items-center gap-3 text-left active:scale-[0.99] transition">
          <span className="h-12 w-12 rounded-2xl bg-lilac flex items-center justify-center text-lilacDeep">
            <Crown size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-extrabold text-ink">訂閱與付款</span>
            <span className="block text-sm text-inkSoft">查看方案、恢復購買、管理訂閱</span>
          </span>
          <ArrowRight size={18} className="text-inkSoft" />
        </button>

        <button onClick={() => router.push("/feedback")} className="w-full card !py-4 flex items-center gap-3 text-left active:scale-[0.99] transition">
          <span className="h-12 w-12 rounded-2xl bg-peach flex items-center justify-center text-peachDeep">
            <MessageSquareWarning size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-extrabold text-ink">意見回饋與日誌</span>
            <span className="block text-sm text-inkSoft">回報錯誤、語音問題或測驗建議</span>
          </span>
        </button>

        <div className="card space-y-3">
          <p className="font-bold text-ink flex items-center gap-2"><ShieldCheck size={18} className="text-mintDeep" /> 隱私與資料</p>
          <button onClick={() => window.open("/privacy", "_blank")} className="w-full flex items-center gap-3 py-2 text-left active:scale-[0.99] transition">
            <FileText size={18} className="text-inkSoft" />
            <span className="flex-1 text-sm text-ink">隱私權政策</span>
            <ArrowRight size={16} className="text-inkSoft" />
          </button>
          <button onClick={() => window.open("/delete-account", "_blank")} className="w-full flex items-center gap-3 py-2 text-left active:scale-[0.99] transition">
            <Trash2 size={18} className="text-peachDeep" />
            <span className="flex-1 text-sm text-ink">刪除帳號與資料</span>
            <ArrowRight size={16} className="text-inkSoft" />
          </button>
          <button onClick={() => window.open("mailto:erin20080306@gmail.com", "_blank")} className="w-full flex items-center gap-3 py-2 text-left active:scale-[0.99] transition">
            <Mail size={18} className="text-inkSoft" />
            <span className="flex-1 text-sm text-ink">聯絡客服</span>
            <ArrowRight size={16} className="text-inkSoft" />
          </button>
        </div>

        <button onClick={logout} className="w-full rounded-3xl bg-white text-peachDeep font-bold py-4 shadow-softer flex items-center justify-center gap-2 active:scale-95 transition">
          <LogOut size={18} /> 登出
        </button>
        <p className="text-center text-xs text-inkSoft">Mobile Language · MVP · 資料儲存在本機 localStorage</p>
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
