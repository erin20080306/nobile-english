"use client";

import { useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Volume2, Star, Target, BookOpen, Mic } from "lucide-react";
import { sceneService } from "@/services/sceneService";
import { learningService } from "@/services/learningService";
import { dictionaryService } from "@/services/dictionaryService";
import { speechService } from "@/services/speechService";
import { storageService, KEYS } from "@/services/storageService";
import { authService } from "@/services/authService";
import AppHeader from "@/components/AppHeader";
import ClickableText from "@/components/ClickableText";
import WordSheet from "@/components/WordSheet";
import ConversationPractice from "@/components/ConversationPractice";
import { LevelBadge } from "@/components/ui";
import type { DialogueResult, TutorFeedback, DialogueTranscriptLine } from "@/types";

const sceneVoice = {
  lang: "en-US",
  voiceKeywords: ["samantha", "ava", "en-us"],
  ttsVoice: "nova" as const,
  ttsInstructions: "Speak clearly and naturally for English learning. Use a warm, crisp, non-raspy voice with strong volume.",
  ttsVolumeGain: 1.55,
};

function buildTranscript(userTurns: string[], feedbacks: TutorFeedback[]): DialogueTranscriptLine[] {
  const transcript: DialogueTranscriptLine[] = [];
  feedbacks.forEach((fb, index) => {
    const userLine = userTurns[index]?.trim();
    if (userLine) {
      transcript.push({
        role: "user",
        en: userLine,
        naturalness: fb.naturalness,
        betterWay: fb.betterWay,
        grammarTip: fb.grammarTip,
        zhExplain: fb.zhExplain,
      });
    }
    if (fb.reply) {
      transcript.push({
        role: "tutor",
        en: fb.reply,
        zh: fb.replyZh,
      });
    }
  });
  if (transcript.length === 0) {
    return userTurns.filter(Boolean).map((en) => ({ role: "user", en }));
  }
  return transcript;
}

export default function ScenePracticePage() {
  const router = useRouter();
  const params = useParams();
  const sceneId = String(params.sceneId);
  const scene = useMemo(() => sceneService.getScene(sceneId), [sceneId]);

  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [savedSentences, setSavedSentences] = useState<string[]>([]);
  const [phase, setPhase] = useState<"preview" | "conversation">("preview");

  const settings = useMemo(() => {
    const u = authService.getCurrentUser();
    return u ? learningService.getSettings(u.id) : null;
  }, []);
  const showZh = settings ? settings.sceneChinese : true;

  if (!scene) {
    return (
      <div className="p-10 text-center text-inkSoft">
        <p>找不到此場景。</p>
        <button className="block mx-auto mt-4 btn-secondary" onClick={() => router.push("/scenes")}>回場景列表</button>
      </div>
    );
  }

  function speak(text: string) {
    if (settings && !settings.pronunciationOn) {
      alert("發音功能已關閉，可至設定開啟。");
      return;
    }
    const r = speechService.speak(text, sceneVoice);
    if (!r.ok) alert(r.message);
  }

  function toggleSentence(en: string, zh: string) {
    const now = dictionaryService.toggleSentence(en, zh, scene!.name);
    setSavedSentences((arr) => (now ? [...arr, en] : arr.filter((x) => x !== en)));
  }

  function handleFinish(result: DialogueResult, userTurns: string[], feedbacks: TutorFeedback[]) {
    const quizQuestions = scene!.quiz;
    const correct = quizQuestions.reduce(
      (acc, q, i) => acc + (quizAnswers[i] === q.answerIndex ? 1 : 0),
      0
    );
    const quizScore = quizQuestions.length ? (correct / quizQuestions.length) * 30 : 25;
    const convScore = Math.round((result.total / 100) * 70);
    const score = Math.round(quizScore + convScore);

    sceneService.setProgress(scene!.id, score);
    learningService.addScene();
    learningService.touchActivity(scene!.minutes, 20 + correct * 5);
    learningService.addRecord({
      type: "scene",
      title: scene!.name,
      sceneName: scene!.name,
      enContent: scene!.dialogue.map((d) => d.en).join(" / "),
      zhContent: scene!.dialogue.map((d) => d.zh).join(" / "),
      userAnswer: userTurns.join(" / "),
      suggestion: feedbacks.length > 0 ? feedbacks[feedbacks.length - 1].betterWay : "持續練習關鍵句型，注意禮貌用語。",
      transcript: buildTranscript(userTurns, feedbacks),
      score,
      completed: true,
      minutes: scene!.minutes,
    });

    storageService.set(KEYS.lastResult, {
      kind: "scene",
      title: scene!.name + "（場景對話）",
      total: score,
      breakdown: [
        { label: "測驗", value: Math.round(quizScore / 30 * 100) },
        { label: "對話", value: convScore },
      ],
      newWords: scene!.keyWords,
      reviewSentences: scene!.keyPatterns.map((p) => p.en),
      conversationWords: result.conversationWords,
      suggestions: result.suggestions,
      dialogueReview: result.dialogueReview,
      nextHref: "/scenes",
    });
    router.push("/results");
  }

  // ---- Conversation phase ----
  if (phase === "conversation") {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <AppHeader
          title={scene.name}
          subtitle="AI 語音對話練習"
          right={
            <button onClick={() => setPhase("preview")} className="chip bg-white text-inkSoft shadow-softer flex items-center gap-1">
              <BookOpen size={14} /> 看材料
            </button>
          }
        />
        <ConversationPractice
          scene={scene}
          showZh={showZh}
          pronunciationOn={settings ? settings.pronunciationOn : true}
          finishLabel="結束對話並看成果"
          onFinish={handleFinish}
        />
      </div>
    );
  }

  // ---- Preview phase ----
  return (
    <div className="min-h-[100dvh] pb-28">
      <AppHeader title={scene.name} subtitle={scene.enName} />

      <div className="px-5 space-y-4">
        {/* Overview */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <LevelBadge level={scene.difficulty} />
            <span className="chip bg-cream text-inkSoft text-xs">{scene.minutes} 分鐘</span>
          </div>
          <p className="text-ink">{scene.intro}</p>
          <div className="mt-3">
            <p className="text-sm font-bold text-inkSoft flex items-center gap-1"><Target size={14} /> 學習目標</p>
            <ul className="mt-1 list-disc list-inside text-sm text-ink">
              {scene.goals.map((g) => <li key={g}>{g}</li>)}
            </ul>
          </div>
        </div>

        {/* Key words */}
        <div className="card">
          <p className="font-bold text-ink flex items-center gap-2"><BookOpen size={18} className="text-lilacDeep" /> 關鍵單字</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {scene.keyWords.map((w) => (
              <button key={w} onClick={() => setActiveWord(w)} className="chip bg-lilac text-lilacDeep">{w}</button>
            ))}
          </div>
        </div>

        {/* Patterns */}
        <div className="card">
          <p className="font-bold text-ink">重要句型</p>
          <div className="mt-2 space-y-2">
            {scene.keyPatterns.map((p, i) => (
              <div key={i} className="rounded-3xl bg-cream p-3 flex items-start gap-2">
                <button onClick={() => speak(p.en)} className="mt-0.5 text-lilacDeep"><Volume2 size={18} /></button>
                <div>
                  <p className="text-ink font-semibold">
                    <ClickableText text={p.en} onWord={setActiveWord} />
                  </p>
                  {showZh && <p className="text-sm text-inkSoft">{p.zh}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dialogue reference */}
        <div className="card">
          <p className="font-bold text-ink mb-2">參考對話（點單字看解釋）</p>
          <div className="space-y-3">
            {scene.dialogue.map((line, i) => {
              const isUser = line.speaker === "user";
              return (
                <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-3xl p-3 ${isUser ? "bg-lilacDeep text-white" : "bg-cream text-ink"}`}>
                    <div className="flex items-start gap-2">
                      <ClickableText text={line.en} onWord={setActiveWord} className={isUser ? "text-white" : "text-ink"} />
                    </div>
                    {showZh && <p className={`text-sm mt-1 ${isUser ? "text-white/80" : "text-inkSoft"}`}>{line.zh}</p>}
                    <div className="mt-1 flex gap-3">
                      <button onClick={() => speak(line.en)} className={isUser ? "text-white/90" : "text-lilacDeep"}><Volume2 size={16} /></button>
                      <button onClick={() => toggleSentence(line.en, line.zh)} className={savedSentences.includes(line.en) ? "text-yellow-300" : (isUser ? "text-white/90" : "text-peachDeep")}>
                        <Star size={16} fill={savedSentences.includes(line.en) ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quiz */}
        <div className="card">
          <p className="font-bold text-ink mb-2">互動選擇題</p>
          <div className="space-y-4">
            {scene.quiz.map((q, qi) => (
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
        </div>
      </div>

      {/* Start voice conversation bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-cream/90 backdrop-blur">
        <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => setPhase("conversation")}>
          <Mic size={18} /> 開始語音對話練習
        </button>
      </div>

      <WordSheet word={activeWord} onClose={() => setActiveWord(null)} />
    </div>
  );
}
