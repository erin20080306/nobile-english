"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Wand2, Play, Volume2 } from "lucide-react";
import type { CustomScene, EnglishLevel } from "@/types";
import { sceneService } from "@/services/sceneService";
import { learningService } from "@/services/learningService";
import { speechService } from "@/services/speechService";
import { getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import AppHeader from "@/components/AppHeader";
import { LevelBadge, Toggle } from "@/components/ui";

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
  const targetLanguage = learningService.getCurrentLanguage();
  const languageInfo = getLearningLanguage(targetLanguage);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function generate() {
    if (!form.situation.trim()) {
      alert("請至少描述想練習的情境");
      return;
    }
    const c = sceneService.createCustomScene({ ...form, targetLanguage });
    setCreated(c);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (created) {
    const s = created.scene;
    return (
      <div className="min-h-[100dvh] pb-10">
        <AppHeader title="自訂場景練習" subtitle="已為你產生階段式情境" back={true} />
        <div className="px-5 space-y-4">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="card bg-gradient-to-br from-peach to-lilac">
            <div className="flex items-center gap-2"><Wand2 className="text-peachDeep" /><p className="font-extrabold text-ink">{s.name}</p></div>
            <p className="text-sm text-ink mt-1">{s.intro}</p>
            <div className="mt-2"><LevelBadge level={s.difficulty} /></div>
          </motion.div>

          {created.stages && created.stages.length > 0 && (
            <Section title={`自動階段（${created.stages.length}）`}>
              <div className="space-y-2">
                {created.stages.map((stage, index) => (
                  <div key={stage.title} className="rounded-3xl bg-cream p-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-peachDeep px-2 py-1 text-[11px] font-extrabold text-white">STEP {index + 1}</span>
                      <p className="font-extrabold text-ink">{stage.title}</p>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-lilacDeep">{stage.enTitle}</p>
                    <p className="mt-1 text-sm text-inkSoft">{stage.learnerGoal}</p>
                    <p className="mt-2 rounded-2xl bg-white/70 px-3 py-2 text-sm font-semibold text-ink">{stage.sampleUser}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="學習目標">
            <ul className="list-disc list-inside text-ink text-sm">{s.goals.map((g) => <li key={g}>{g}</li>)}</ul>
          </Section>

          <Section title={`關鍵單字（${s.keyWords.length}）`}>
            <div className="flex flex-wrap gap-2">{s.keyWords.map((w) => <span key={w} className="chip bg-lilac text-lilacDeep">{w}</span>)}</div>
          </Section>

          <Section title="重要句型（5）">
            <div className="space-y-2">
              {s.keyPatterns.map((p, i) => (
                <div key={i} className="rounded-3xl bg-cream p-3 flex items-start gap-2">
                    <button
                      onClick={() => speechService.speak(p.en, {
                        ...voiceForLanguage(created.targetLanguage || targetLanguage, learningService.getSpeechRate(created.targetLanguage || targetLanguage)),
                        onError: (message) => alert(message),
                      })}
                      className="text-lilacDeep mt-0.5"
                    >
                      <Volume2 size={16} />
                    </button>
                  <div><p className="text-ink font-semibold">{p.en}</p>{created.showChinese && <p className="text-sm text-inkSoft">{p.zh}</p>}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="範例對話">
            <div className="space-y-2">
              {s.dialogue.map((d, i) => (
                <div key={i} className={`rounded-3xl p-3 ${d.speaker === "user" ? "bg-lilacDeep text-white ml-6" : "bg-cream text-ink mr-6"}`}>
                  <p>{d.en}</p>
                  {created.showChinese && <p className={`text-sm ${d.speaker === "user" ? "text-white/80" : "text-inkSoft"}`}>{d.zh}</p>}
                </div>
              ))}
            </div>
          </Section>

          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => router.push(`/dialogue?scene=${s.id}`)}>
            <Play size={18} /> 開始角色扮演
          </button>
          <button className="btn-secondary w-full" onClick={() => setCreated(null)}>再建立一個</button>
        </div>
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

        <Input label="想練習的情境" value={form.situation} onChange={(v) => set("situation", v)} placeholder="例如：到外商公司面試行政助理" />
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
              <button key={l} onClick={() => set("difficulty", l)} className={`chip ${form.difficulty === l ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}>{l}</button>
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

        <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={generate}>
          <Wand2 size={18} /> 產生練習卡
        </button>
      </div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <p className="font-bold text-ink mb-2">{title}</p>
      {children}
    </div>
  );
}
