"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wand2, Play, Volume2, Mic } from "lucide-react";
import type { CustomScene, LearningLanguageCode } from "@/types";
import { speechService } from "@/services/speechService";
import { voiceForLanguage } from "@/data/learningLanguages";
import ShadowingPractice from "@/components/ShadowingPractice";
import { LevelBadge } from "@/components/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <p className="font-extrabold text-ink mb-3">{title}</p>
      {children}
    </div>
  );
}

// Shared detail/preview view for a freshly generated CustomScene. Used by both
// the dedicated 自訂場景練習 page and the Free Chat "建立自訂場景" flow so both
// entry points show the same stages, key patterns, dialogue, and quiz UI.
export default function CustomScenePreview({
  created,
  targetLanguage,
  onStart,
  startLabel = "開始角色扮演",
  secondaryAction,
}: {
  created: CustomScene;
  targetLanguage: LearningLanguageCode;
  onStart: () => void;
  startLabel?: string;
  secondaryAction?: { label: string; onClick: () => void };
}) {
  const s = created.scene;
  const studyPhrases = s.keyPatterns.slice(0, 3);
  const [studiedPhrases, setStudiedPhrases] = useState<string[]>([]);
  const [shadowingPatternIndex, setShadowingPatternIndex] = useState<number | null>(null);
  const [pronunciationScores, setPronunciationScores] = useState<Record<number, number>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});

  // Reset local practice state whenever a new scene is generated.
  useEffect(() => {
    setStudiedPhrases([]);
    setShadowingPatternIndex(null);
    setPronunciationScores({});
    setQuizAnswers({});
  }, [created.id]);

  const voiceOptions = voiceForLanguage(created.targetLanguage || targetLanguage, 1);
  const speak = (text: string) => {
    speechService.speak(text, {
      ...voiceOptions,
      onError: (message) => alert(message),
    });
  };
  const markStudied = (text: string) => {
    setStudiedPhrases((items) => (items.includes(text) ? items : [...items, text]));
  };

  return (
    <div className="space-y-4">
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

      <Section title="先跟讀幾個短句">
        <div className="space-y-2">
          {studyPhrases.map((p, i) => {
            const studied = studiedPhrases.includes(p.en);
            return (
              <div key={p.en} className="rounded-3xl bg-cream p-3">
                <div className="flex items-start gap-2">
                  <button onClick={() => speak(p.en)} className="mt-0.5 text-lilacDeep">
                    <Volume2 size={16} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-peachDeep">PRACTICE {i + 1}</p>
                    <p className="font-semibold text-ink">{p.en}</p>
                    {created.showChinese && <p className="text-sm text-inkSoft">{p.zh}</p>}
                  </div>
                </div>
                <button
                  onClick={() => markStudied(p.en)}
                  className={`mt-2 rounded-2xl px-3 py-2 text-xs font-extrabold ${
                    studied ? "bg-mint text-mintDeep" : "bg-white text-lilacDeep"
                  }`}
                >
                  {studied ? "已跟讀" : "我已跟讀一次"}
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="重要句型">
        <div className="space-y-2">
          {s.keyPatterns.map((p, i) => (
            <div key={i}>
              {shadowingPatternIndex === i ? (
                <ShadowingPractice
                  sentence={p.en}
                  translation={p.zh}
                  targetLanguage={created.targetLanguage || targetLanguage}
                  onComplete={(score) => {
                    setPronunciationScores((prev) => ({ ...prev, [i]: score }));
                    setShadowingPatternIndex(null);
                  }}
                />
              ) : (
                <div className="rounded-3xl bg-cream p-3 flex items-start gap-2">
                  <button onClick={() => speak(p.en)} className="text-lilacDeep mt-0.5">
                    <Volume2 size={16} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink font-semibold">{p.en}</p>
                    {created.showChinese && <p className="text-sm text-inkSoft">{p.zh}</p>}
                  </div>
                  {pronunciationScores[i] !== undefined && (
                    <span className={`text-xs font-bold ${pronunciationScores[i] >= 75 ? "text-mintDeep" : "text-peachDeep"}`}>
                      {pronunciationScores[i]}%
                    </span>
                  )}
                  <button
                    onClick={() => setShadowingPatternIndex(i)}
                    className="text-lilacDeep hover:text-lilacDeep/80 transition"
                    title="跟讀練習"
                  >
                    <Mic size={16} />
                  </button>
                </div>
              )}
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

      {s.quiz.length > 0 && (
        <Section title="互動選擇題">
          <div className="space-y-4">
            {s.quiz.map((q, qi) => (
              <div key={qi}>
                <p className="font-semibold text-ink">{qi + 1}. {q.question}</p>
                <div className="mt-2 space-y-2">
                  {q.options.map((opt, oi) => {
                    const picked = quizAnswers[qi];
                    const isPicked = picked === oi;
                    const isCorrect = oi === q.answerIndex;
                    const show = picked !== undefined;
                    return (
                      <button
                        key={oi}
                        disabled={show}
                        onClick={() => setQuizAnswers((a) => ({ ...a, [qi]: oi }))}
                        className={`w-full text-left rounded-2xl px-3 py-2 font-semibold transition ${
                          show
                            ? isCorrect
                              ? "bg-mint text-mintDeep"
                              : isPicked
                              ? "bg-peach text-peachDeep"
                              : "bg-cream text-inkSoft"
                            : "bg-cream text-ink"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {quizAnswers[qi] !== undefined && (
                  <p className="text-sm text-inkSoft mt-1">💡 {q.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={onStart}>
        <Play size={18} /> {startLabel}
      </button>
      {secondaryAction && (
        <button className="btn-secondary w-full" onClick={secondaryAction.onClick}>{secondaryAction.label}</button>
      )}
    </div>
  );
}
