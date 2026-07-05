"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Mic, Square, Loader2 } from "lucide-react";
import type { CustomScene, EnglishLevel, LearningLanguageCode } from "@/types";
import { sceneService } from "@/services/sceneService";
import { learningService } from "@/services/learningService";
import { speechService } from "@/services/speechService";
import { authService } from "@/services/authService";
import { trialAccessService, type AccessState } from "@/services/trialAccessService";
import { trialUsageService } from "@/services/trialUsageService";
import { subscriptionReminderService } from "@/services/subscriptionReminderService";
import { getLearningLanguage } from "@/data/learningLanguages";
import AppHeader from "@/components/AppHeader";
import CustomScenePreview from "@/components/CustomScenePreview";
import SubscriptionLaunchPrompt from "@/components/SubscriptionLaunchPrompt";
import { Toggle, levelLabel } from "@/components/ui";

const levels: EnglishLevel[] = ["Beginner", "Elementary", "Intermediate", "Upper-Intermediate", "Advanced"];
const examples = [
  "我要練習餐廳點餐完整流程",
  "我要練習到外商公司面試行政助理",
  "我要練習在咖啡廳點餐",
  "我要練習向國外客戶確認資料",
  "我要練習在機場詢問登機門",
];

export default function CustomScenePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    situation: "",
    role: "",
    place: "",
    difficulty: "Elementary" as EnglishLevel,
    topic: "",
    pattern: "",
    showChinese: true,
    rounds: 4,
  });
  const [created, setCreated] = useState<CustomScene | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<LearningLanguageCode>("en");
  const [access, setAccess] = useState<AccessState | null>(null);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [listening, setListening] = useState(false);
  const stopListenRef = useRef<(() => void) | null>(null);
  const languageInfo = getLearningLanguage(targetLanguage);

  useEffect(() => {
    setTargetLanguage(learningService.getCurrentLanguage());
    trialAccessService.getAccessState(undefined, { fresh: true }).then(setAccess).catch(() => setAccess(null));
  }, []);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function showLimitPrompt(scope: "session" | "lifetime" = "session") {
    const userId = authService.getCurrentUser()?.id;
    if (subscriptionReminderService.shouldShowLimitReminder(userId, "customScene", access, scope)) {
      subscriptionReminderService.markLimitReminderShown(userId, "customScene", scope);
      setShowSubscriptionPrompt(true);
    }
  }

  function toggleMic() {
    if (listening) {
      stopListenRef.current?.();
      stopListenRef.current = null;
      setListening(false);
      return;
    }
    const stop = speechService.listen({
      lang: "zh-TW",
      onResult: (text) => set("situation", text),
      onError: (message) => {
        alert(message);
        stopListenRef.current = null;
        setListening(false);
      },
      onEnd: () => {
        stopListenRef.current = null;
        setListening(false);
      },
    });
    if (stop) {
      stopListenRef.current = stop;
      setListening(true);
    }
  }

  async function generate() {
    if (trialUsageService.isPromoTrial(access)) {
      const usage = await trialUsageService.usePromoFeature(access, "customScene");
      if (!usage.ok) {
        showLimitPrompt("lifetime");
        return;
      }
    } else if (trialUsageService.isLimited(access)) {
      showLimitPrompt("session");
      return;
    }
    if (!form.situation.trim()) {
      alert("請至少描述想練習的情境");
      return;
    }
    setGenerating(true);
    try {
      const c = await sceneService.createCustomScene({ ...form, targetLanguage });
      if (trialUsageService.isPromoTrial(access)) {
        window.sessionStorage.setItem(`promo_custom_scene_generated:${c.scene.id}`, "1");
      }
      setCreated(c);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setGenerating(false);
    }
  }

  if (created) {
    const startScene = () => {
      router.push(`/scenes/custom/${created.scene.id}`);
    };
    return (
      <div className="min-h-[100dvh] pb-10">
        <AppHeader title="自訂場景練習" subtitle="已為你產生階段式情境" back={true} />
        <div className="px-5">
          <CustomScenePreview
            created={created}
            targetLanguage={targetLanguage}
            onStart={startScene}
            startLabel="開始角色扮演"
            secondaryAction={{ label: "再建立一個", onClick: () => setCreated(null) }}
          />
        </div>
        {access && showSubscriptionPrompt && (
          <SubscriptionLaunchPrompt
            access={access}
            promptReason="limit"
            featureName="自訂場景"
            onSubscribe={() => router.push("/subscription")}
            onDismiss={() => setShowSubscriptionPrompt(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-10">
      <AppHeader title="自訂場景練習" subtitle={`目前語言：${languageInfo.flag} ${languageInfo.zhName}`} back={true} />
      <div className="px-5 space-y-4">
        <div className="card bg-gradient-to-br from-lilac to-sky">
          <p className="text-sm text-ink">試試這些例子：</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {examples.map((e) => (
              <button key={e} onClick={() => set("situation", e)} className="chip bg-white/70 text-ink text-xs">{e}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-inkSoft">想練習的情境</span>
            <button
              type="button"
              onClick={toggleMic}
              className={`h-8 w-8 rounded-2xl flex items-center justify-center shadow-softer ${listening ? "bg-peachDeep text-white animate-pulse" : "bg-white text-lilacDeep"}`}
            >
              {listening ? <Square size={14} /> : <Mic size={14} />}
            </button>
          </div>
          <input
            className="mt-1 w-full bg-white rounded-3xl px-4 py-3 shadow-softer outline-none text-ink"
            value={form.situation}
            placeholder="例如：到外商公司面試行政助理，或點一下麥克風直接說（自動辨識中英文）"
            onChange={(e) => set("situation", e.target.value)}
          />
          {listening && <p className="mt-1 text-xs font-bold text-peachDeep">聆聽中... 說完後再按一次麥克風停止</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="角色" value={form.role} onChange={(v) => set("role", v)} placeholder="面試者" />
          <Input label="地點" value={form.place} onChange={(v) => set("place", v)} placeholder="會議室" />
        </div>
        <Input label="想練習的主題" value={form.topic} onChange={(v) => set("topic", v)} placeholder="job interview" />
        <Input label="想學習的句型（選填）" value={form.pattern} onChange={(v) => set("pattern", v)} placeholder="I'm confident that..." />

        <div>
          <p className="text-sm font-bold text-inkSoft mb-2">難度</p>
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => (
              <button key={l} onClick={() => set("difficulty", l)} className={`chip ${form.difficulty === l ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}>{levelLabel(l)}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-inkSoft mb-2">對話回合數：{form.rounds}</p>
          <input type="range" min={2} max={8} value={form.rounds} onChange={(e) => set("rounds", parseInt(e.target.value))} className="w-full accent-lilacDeep" />
        </div>

        <div className="card !py-4">
          <Toggle label="顯示中文" checked={form.showChinese} onChange={(v) => set("showChinese", v)} />
        </div>

        <button className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60" onClick={() => { void generate(); }} disabled={generating}>
          {generating ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
          {generating ? "AI 正在設計場景..." : "產生練習卡"}
        </button>
      </div>
      {access && showSubscriptionPrompt && (
        <SubscriptionLaunchPrompt
          access={access}
          promptReason="limit"
          featureName="自訂場景"
          onSubscribe={() => router.push("/subscription")}
          onDismiss={() => setShowSubscriptionPrompt(false)}
        />
      )}
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-inkSoft">{label}</span>
      <input className="mt-1 w-full bg-white rounded-3xl px-4 py-3 shadow-softer outline-none text-ink" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
