"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Flame, Star, MessageSquare, Trophy, Volume2, Languages, ChevronRight,
  BookOpen, Sparkles, GraduationCap, Wand2, Search, Newspaper,
} from "lucide-react";
import type { GardenState, Stats, UserSettings, EnglishLevel } from "@/types";
import { useUser } from "@/hooks/useUser";
import { learningService } from "@/services/learningService";
import { gardenService } from "@/services/gardenService";
import { vocabularyService } from "@/services/vocabularyService";
import { examService } from "@/services/examService";
import { sceneService } from "@/services/sceneService";
import { sceneCardStyle } from "@/data/sceneVisuals";
import { LEARNING_LANGUAGES, getLearningLanguage } from "@/data/learningLanguages";
import CheerImage from "@/components/CheerImage";
import BottomNav from "@/components/BottomNav";
import HorizontalScrollChips from "@/components/HorizontalScrollChips";
import SubscriptionLaunchPrompt from "@/components/SubscriptionLaunchPrompt";
import { LevelBadge, ProgressBar, Toggle } from "@/components/ui";
import { trialAccessService, type AccessState } from "@/services/trialAccessService";
import { trialUsageService } from "@/services/trialUsageService";

const dailySentences = [
  { en: "Every day is a fresh start.", zh: "每一天都是嶄新的開始。" },
  { en: "Practice makes progress.", zh: "練習帶來進步。" },
  { en: "Small steps lead to big results.", zh: "小步前進，成就大事。" },
  { en: "You are capable of amazing things.", zh: "你能做到很棒的事。" },
];

const recByLevel: Record<EnglishLevel, { id: string; label: string }[]> = {
  Beginner: [
    { id: "daily-1", label: "打招呼" }, { id: "cafe-1", label: "咖啡廳點餐" },
    { id: "shopping-1", label: "購物詢價" }, { id: "airport-4", label: "機場英文" },
  ],
  Elementary: [
    { id: "travel-1", label: "旅遊問路" }, { id: "social-1", label: "認識新朋友" },
    { id: "airport-6", label: "飯店入住" }, { id: "phone-4", label: "電話預約" },
  ],
  Intermediate: [
    { id: "work-1", label: "職場會議" }, { id: "interview-1", label: "英文面試" },
    { id: "airport-6", label: "旅館入住" }, { id: "phone-5", label: "客訴處理" },
  ],
  "Upper-Intermediate": [
    { id: "work-6", label: "商務簡報" }, { id: "exam-1", label: "考試英文" },
    { id: "interview-6", label: "薪資談判" }, { id: "phone-8", label: "技術支援" },
  ],
  Advanced: [
    { id: "work-7", label: "客戶溝通" }, { id: "exam-9", label: "寫作開頭" },
    { id: "interview-5", label: "情境問題" }, { id: "work-6", label: "商務簡報" },
  ],
};

export default function Dashboard() {
  const { user, ready } = useUser({ requireOnboarded: true });
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [garden, setGarden] = useState<GardenState | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [accessState, setAccessState] = useState<AccessState | null>(null);
  const [subscriptionPromptDismissed, setSubscriptionPromptDismissed] = useState(false);
  const [forcedSubscriptionPrompt, setForcedSubscriptionPrompt] = useState(false);
  const sentence = dailySentences[new Date().getDate() % dailySentences.length];

  useEffect(() => {
    if (!user) return;
    setStats(learningService.getStats());
    const nextSettings = learningService.getSettings(user.id);
    setSettings(nextSettings);
    setGarden(gardenService.getState(nextSettings.targetLanguage));
    setSavedCount(vocabularyService.getSaved().length);
    void learningService.syncRecords(user.id);
    trialAccessService
      .getAccessState(user, { fresh: true })
      .then(setAccessState)
      .catch(() => setAccessState(null));
  }, [user]);

  if (!ready || !user || !stats || !settings) {
    return <div className="p-10 text-center text-inkSoft">載入中…</div>;
  }

  const goal = learningService.getProfile().dailyGoalMinutes || 15;
  const progress = Math.min(100, (stats.todayMinutes / goal) * 100);
  const examResults = examService.getResults();
  const lastExam = examResults[0];
  const recs = recByLevel[user.level] || recByLevel.Beginner;
  const currentLanguage = getLearningLanguage(settings.targetLanguage);

  function updateSetting(patch: Partial<UserSettings>) {
    const next = { ...settings!, ...patch };
    setSettings(next);
    learningService.saveSettings(next);
  }

  function updateChineseSupport(enabled: boolean) {
    updateSetting({
      showChineseGlobal: enabled,
      sceneChinese: enabled,
      dialogueChinese: enabled,
      wordReviewChinese: enabled,
      sentenceReviewChinese: enabled,
      examChinese: enabled,
    });
  }

  function changeLanguage(code: UserSettings["targetLanguage"]) {
    const next = { ...settings!, targetLanguage: code };
    setSettings(next);
    learningService.saveSettings(next);
    learningService.saveProfile({ language: getLearningLanguage(code).label });
    setGarden(gardenService.getState(code));
  }

  function openCustomScene() {
    if (trialUsageService.isLimited(accessState)) {
      setForcedSubscriptionPrompt(true);
      return;
    }
    router.push("/custom-scene");
  }

  const levelStyle: Record<string, string> = {
    Beginner: "from-mint to-sky",
    Elementary: "from-sky to-lilac",
    Intermediate: "from-lilac to-peach",
    "Upper-Intermediate": "from-peach to-lilac",
    Advanced: "from-ink to-lilacDeep",
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="px-5 pt-10 pb-2 flex items-center justify-between">
        <div>
          <p className="text-inkSoft text-sm">歡迎回來</p>
          <h1 className="text-2xl font-extrabold text-ink">{user.name} 👋</h1>
        </div>
        <LevelBadge level={user.level} />
      </div>

      {/* Hero encouragement with cheer image */}
      <div className="px-5">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-4xl p-4 bg-gradient-to-br ${levelStyle[user.level]} shadow-soft flex items-center gap-3`}
        >
          <CheerImage size={92} />
          <div className="flex-1">
            <p className="font-extrabold text-ink">加油！你今天進步了！</p>
            <p className="text-sm text-ink/70">Great job! 連續學習 {stats.streak} 天</p>
            <div className="mt-2"><ProgressBar value={progress} /></div>
            <p className="text-xs text-ink/70 mt-1">
              今日 {stats.todayMinutes} / {goal} 分鐘 · XP {stats.xp}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Stat grid */}
      <div className="px-5 mt-4 grid grid-cols-3 gap-3">
        <Stat icon={<Flame className="text-peachDeep" />} value={`${stats.streak}`} label="連續天數" />
        <Stat icon={<Star className="text-lilacDeep" />} value={`${savedCount}`} label="收藏單字" />
        <Stat icon={<MessageSquare className="text-mintDeep" />} value={`${stats.completedDialogues}`} label="完成對話" />
      </div>

      {/* Today sentence */}
      <div className="px-5 mt-4">
        <div className="card">
          <p className="text-xs font-bold text-inkSoft">今日一句英文</p>
          <p className="text-lg font-extrabold text-ink mt-1">{sentence.en}</p>
          {settings.showChineseGlobal && <p className="text-inkSoft">{sentence.zh}</p>}
        </div>
      </div>

      <div className="px-5 mt-4">
        <div className="relative overflow-hidden rounded-[30px] bg-white/95 p-4 shadow-soft border border-white/80">
          <div className="absolute right-0 top-0 h-24 w-28 rounded-bl-[42px] bg-gradient-to-br from-lilac/70 to-mint/70" />
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex items-center gap-3 min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lilac text-lilacDeep">
                <Languages size={22} />
              </span>
              <div className="min-w-0">
              <p className="text-xs font-bold text-inkSoft">目前學習語言</p>
              <p className="font-extrabold text-ink">{currentLanguage.flag} {currentLanguage.zhName}</p>
              </div>
            </div>
            <button className="relative chip bg-lilac text-lilacDeep shadow-softer" onClick={() => router.push("/settings")}>設定</button>
          </div>
          <HorizontalScrollChips className="mt-4">
            {LEARNING_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`rounded-3xl px-4 py-3 text-sm font-extrabold whitespace-nowrap active:scale-95 transition ${
                  settings.targetLanguage === lang.code
                    ? "bg-lilacDeep text-white shadow-soft"
                    : "bg-cream text-ink shadow-softer"
                }`}
              >
                {lang.flag} {lang.zhName}
              </button>
            ))}
          </HorizontalScrollChips>
        </div>
      </div>

      <div className="px-5 mt-4">
        <button
          onClick={() => router.push("/garden")}
          className="relative w-full overflow-hidden rounded-[30px] bg-gradient-to-br from-mint via-white to-peach p-4 text-left shadow-soft active:scale-[0.98] transition"
        >
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/50" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white text-3xl shadow-softer">🌱</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-inkSoft">學習遊戲</p>
              <p className="text-lg font-extrabold text-ink">語言小農場</p>
              <p className="truncate text-sm font-semibold text-inkSoft">
                🪙 {garden?.coins ?? 0} 金幣 · 💧 {garden?.water ?? 0} 水滴 · 🧺 {garden?.harvests ?? 0} 收成
              </p>
            </div>
            <ChevronRight className="relative text-inkSoft" />
          </div>
        </button>
      </div>

      {/* Daily Reading Article */}
      <div className="px-5 mt-4">
        <button
          onClick={() => router.push("/reading")}
          className="relative w-full overflow-hidden rounded-[30px] bg-gradient-to-br from-lilac via-white to-sky p-4 text-left shadow-soft active:scale-[0.98] transition"
        >
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/50" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white text-3xl shadow-softer">📰</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-inkSoft">每日閱讀</p>
              <p className="text-lg font-extrabold text-ink">五語閱讀文章</p>
              <p className="truncate text-sm font-semibold text-inkSoft">
                🌍 五種語言 · 🔊 語音播放 · 📚 單字卡
              </p>
            </div>
            <ChevronRight className="relative text-inkSoft" />
          </div>
        </button>
      </div>

      {/* Quick actions */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-3">
        <Action color="bg-lilac" icon={<MessageSquare className="text-lilacDeep" />} title="開始對話" onClick={() => router.push("/dialogue")} />
        <Action color="bg-peach" icon={<Wand2 className="text-peachDeep" />} title="自創場景" onClick={openCustomScene} />
        <Action color="bg-mint" icon={<Search className="text-mintDeep" />} title="同尾字" onClick={() => router.push("/rhyme")} />
        <Action color="bg-sky" icon={<BookOpen className="text-skyDeep" />} title="語言字典" onClick={() => router.push("/dictionary")} />
        <Action color="bg-lilac" icon={<GraduationCap className="text-lilacDeep" />} title="測驗中心" onClick={() => router.push("/exam")} />
        <Action color="bg-peach" icon={<Trophy className="text-peachDeep" />} title="我的紀錄" onClick={() => router.push("/records")} />
      </div>

      {/* Recommended scenes by level */}
      <div className="px-5 mt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-extrabold text-ink">今日推薦場景</h2>
          <button className="text-sm text-lilacDeep font-bold flex items-center" onClick={() => router.push("/scenes")}>
            全部 <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {recs.map((r) => {
            const scene = sceneService.getScene(r.id);
            if (!scene) return null;
            const theme = sceneService.getTheme(scene.themeId);
            return (
              <button
                key={r.id}
                onClick={() => router.push(`/scenes/${scene.themeId}/${scene.id}`)}
                className="min-w-[160px] card !p-4 text-left active:scale-95 transition overflow-hidden"
                style={sceneCardStyle(theme?.color || "#E8E1FF", 0.22, scene.themeId)}
              >
                <Sparkles className="text-lilacDeep" size={20} />
                <p className="font-bold text-ink mt-2">{scene.name}</p>
                <p className="text-xs text-inkSoft">{scene.enName}</p>
                <span className="chip bg-mint text-mintDeep text-xs mt-2 inline-block">{scene.minutes} 分鐘</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Exam summary */}
      <div className="px-5 mt-5">
        <div className="card flex items-center gap-3">
          <Trophy className="text-peachDeep" />
          <div className="flex-1">
            <p className="font-bold text-ink">測驗成績摘要</p>
            <p className="text-sm text-inkSoft">
              {lastExam ? `最近 ${lastExam.exam}：${lastExam.percent}%（${lastExam.level}）` : "尚未測驗，快去挑戰看看！"}
            </p>
          </div>
          <button className="chip bg-lilacDeep text-white" onClick={() => router.push("/exam")}>前往</button>
        </div>
      </div>

      {/* Toggles */}
      <div className="px-5 mt-4">
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <Languages className="text-lilacDeep" size={20} />
            <div className="flex-1"><Toggle label="中文輔助顯示" checked={settings.showChineseGlobal} onChange={updateChineseSupport} /></div>
          </div>
          <div className="flex items-center gap-3">
            <Volume2 className="text-mintDeep" size={20} />
            <div className="flex-1"><Toggle label="發音功能" checked={settings.pronunciationOn} onChange={(v) => updateSetting({ pronunciationOn: v })} /></div>
          </div>
        </div>
      </div>

      <BottomNav />

      {accessState && (!subscriptionPromptDismissed || forcedSubscriptionPrompt) && (
        <SubscriptionLaunchPrompt
          access={accessState}
          onSubscribe={() => router.push("/subscription")}
          onContinueTrial={
            accessState.reason === "trial"
              ? () => {
                  setSubscriptionPromptDismissed(true);
                  setForcedSubscriptionPrompt(false);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="card !p-3 text-center">
      <div className="flex justify-center">{icon}</div>
      <p className="text-xl font-extrabold text-ink mt-1">{value}</p>
      <p className="text-[11px] text-inkSoft">{label}</p>
    </div>
  );
}

function Action({ color, icon, title, onClick }: { color: string; icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card !p-4 flex items-center gap-3 active:scale-95 transition">
      <span className={`h-11 w-11 rounded-2xl ${color} flex items-center justify-center`}>{icon}</span>
      <span className="font-bold text-ink">{title}</span>
    </button>
  );
}
