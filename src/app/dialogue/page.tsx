"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, RotateCcw } from "lucide-react";
import type { Scene, TutorFeedback, DialogueResult, DialogueTranscriptLine } from "@/types";
import { sceneService } from "@/services/sceneService";
import { learningService } from "@/services/learningService";
import { authService } from "@/services/authService";
import { storageService, KEYS } from "@/services/storageService";
import { sceneCardStyle } from "@/data/sceneVisuals";
import AppHeader from "@/components/AppHeader";
import ConversationPractice from "@/components/ConversationPractice";

export default function DialoguePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-inkSoft">載入中…</div>}>
      <DialogueInner />
    </Suspense>
  );
}

function DialogueInner() {
  const router = useRouter();
  const search = useSearchParams();
  const preset = search.get("scene");
  const [scene, setScene] = useState<Scene | null>(null);
  const [isFreeMode, setIsFreeMode] = useState(false);

  function startFreeMode() {
    setIsFreeMode(true);
    setScene(buildFreeScene());
  }

  if (!scene) return <ScenerPicker onPick={setScene} preset={preset} onFreeMode={startFreeMode} router={router} />;
  if (isFreeMode) return <FreeChat onExit={() => { setScene(null); setIsFreeMode(false); }} />;
  return <Chat scene={scene} onExit={() => setScene(null)} />;
}

function ScenerPicker({
  onPick,
  preset,
  onFreeMode,
  router,
}: {
  onPick: (s: Scene) => void;
  preset: string | null;
  onFreeMode: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  useEffect(() => {
    if (preset) {
      const s = sceneService.getScene(preset);
      if (s) onPick(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const themes = sceneService.getThemes();
  return (
    <div className="min-h-[100dvh] pb-10">
      <AppHeader
        title="對話學習"
        subtitle="選一個情境開始語音或打字對話"
        back={false}
        right={
          <button onClick={() => router.push("/dashboard")} className="chip bg-white text-inkSoft shadow-softer flex items-center gap-1">
            <Home size={14} /> 首頁
          </button>
        }
      />
      <div className="px-5">
        <button onClick={onFreeMode} className="w-full card !p-4 text-left active:scale-95 transition mb-4 bg-gradient-to-r from-peach to-peachDeep text-white">
          <p className="font-bold">自由對話</p>
          <p className="text-xs opacity-90">無特定情境，支援語音或手動輸入練習</p>
        </button>
        {themes.map((t) => {
          const scenes = sceneService.getScenesByTheme(t.id).slice(0, 4);
          return (
            <div key={t.id} className="mb-4">
              <p className="font-bold text-ink mb-2">{t.emoji} {t.name}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {scenes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onPick(s)}
                    className="relative h-36 rounded-3xl p-4 text-left active:scale-95 transition overflow-hidden shadow-soft flex flex-col justify-between"
                    style={sceneCardStyle(t.color, 0.16, t.id)}
                  >
                    <div className="relative z-10 min-w-0">
                      <p className="text-lg leading-tight font-extrabold text-ink break-words">{s.name}</p>
                      <p className="mt-1 text-xs font-semibold text-inkSoft truncate">{s.enName}</p>
                    </div>
                    <span className="relative z-10 self-start rounded-full bg-white/85 px-3 py-1.5 text-xs font-extrabold text-lilacDeep shadow-softer">
                      {s.difficulty}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

function Chat({ scene, onExit }: { scene: Scene; onExit: () => void }) {
  const router = useRouter();
  const settings = useMemo(() => {
    const u = authService.getCurrentUser();
    return u ? learningService.getSettings(u.id) : null;
  }, []);
  const showZh = settings ? settings.dialogueChinese : true;
  const pron = settings ? settings.pronunciationOn : true;

  function handleFinish(result: DialogueResult, userTurns: string[], feedbacks: TutorFeedback[]) {
    const transcript = buildTranscript(userTurns, feedbacks);
    learningService.addDialogue();
    learningService.touchActivity(8, 30);
    learningService.addRecord({
      type: "dialogue",
      title: scene.name,
      sceneName: scene.name,
      enContent: userTurns.join(" / "),
      zhContent: "",
      userAnswer: userTurns.join(" / "),
      suggestion: feedbacks[feedbacks.length - 1]?.betterWay || "持續練習，注意禮貌用語。",
      transcript,
      score: result.total,
      completed: true,
      minutes: 8,
    });
    storageService.set(KEYS.lastResult, {
      kind: "dialogue",
      title: scene.name + "（對話）",
      total: result.total,
      breakdown: [
        { label: "單字量", value: result.vocab },
        { label: "文法", value: result.grammar },
        { label: "流暢度", value: result.fluency },
        { label: "任務完成", value: result.taskCompletion },
      ],
      newWords: result.newWords,
      reviewSentences: result.reviewSentences,
      conversationWords: result.conversationWords,
      suggestions: result.suggestions,
      nextHref: "/dialogue",
    });
    router.push("/results");
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppHeader
        title={scene.name}
        subtitle="AI 語音對話練習"
        right={
          <button onClick={onExit} className="chip bg-white text-inkSoft shadow-softer flex items-center gap-1">
            <RotateCcw size={14} /> 回選單
          </button>
        }
      />
      <ConversationPractice
        scene={scene}
        showZh={showZh}
        pronunciationOn={pron}
        finishLabel="結束對話並看成果"
        onFinish={handleFinish}
      />
    </div>
  );
}

function FreeChat({ onExit }: { onExit: () => void }) {
  const router = useRouter();
  const settings = useMemo(() => {
    const u = authService.getCurrentUser();
    return u ? learningService.getSettings(u.id) : null;
  }, []);
  const showZh = settings ? settings.dialogueChinese : true;
  const pron = settings ? settings.pronunciationOn : true;

  const freeScene = buildFreeScene();

  function handleFinish(result: DialogueResult, userTurns: string[], feedbacks: TutorFeedback[]) {
    const transcript = buildTranscript(userTurns, feedbacks);
    learningService.addDialogue();
    learningService.touchActivity(10, 30);
    learningService.addRecord({
      type: "dialogue",
      title: "自由對話",
      sceneName: "自由對話",
      enContent: userTurns.join(" / "),
      zhContent: "",
      userAnswer: userTurns.join(" / "),
      suggestion: feedbacks[feedbacks.length - 1]?.betterWay || "持續練習，保持對話流暢。",
      transcript,
      score: result.total,
      completed: true,
      minutes: 10,
    });
    storageService.set(KEYS.lastResult, {
      kind: "dialogue",
      title: "自由對話",
      total: result.total,
      breakdown: [
        { label: "單字量", value: result.vocab },
        { label: "文法", value: result.grammar },
        { label: "流暢度", value: result.fluency },
        { label: "任務完成", value: result.taskCompletion },
      ],
      newWords: result.newWords,
      reviewSentences: result.reviewSentences,
      conversationWords: result.conversationWords,
      suggestions: result.suggestions,
      nextHref: "/dialogue",
    });
    router.push("/results");
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppHeader
        title="自由對話"
        subtitle="隨意聊天練習"
        right={
          <button onClick={onExit} className="chip bg-white text-inkSoft shadow-softer flex items-center gap-1">
            <RotateCcw size={14} /> 回選單
          </button>
        }
      />
      <ConversationPractice
        scene={freeScene}
        showZh={showZh}
        pronunciationOn={pron}
        finishLabel="結束對話並看成果"
        onFinish={handleFinish}
      />
    </div>
  );
}

function buildFreeScene(): Scene {
  return {
    id: "free-chat",
    themeId: "free",
    name: "自由對話",
    enName: "Free Conversation",
    difficulty: "Intermediate",
    minutes: 10,
    intro: "沒有特定情境，隨意聊聊任何你想練習的主題。",
    goals: ["自由表達", "流暢對話", "日常聊天"],
    keyWords: ["chat", "talk", "share", "express", "practice"],
    keyPatterns: [
      { en: "What do you like to do?", zh: "你喜歡做什麼？" },
      { en: "Tell me more about that.", zh: "多告訴我一點關於那件事。" },
      { en: "That's interesting!", zh: "那很有趣！" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Hi! What would you like to talk about today?", zh: "嗨！今天想聊什麼呢？" },
      { speaker: "user", en: "I'd like to practice English.", zh: "我想練習英文。" },
      { speaker: "tutor", en: "Great. Tell me about something that happened today.", zh: "很好。跟我說說今天發生的一件事。" },
      { speaker: "user", en: "I worked and studied English for a while.", zh: "我工作了一下，也讀了一會兒英文。" },
      { speaker: "tutor", en: "Nice. How did you feel about that?", zh: "不錯。你對那件事感覺如何？" },
      { speaker: "user", en: "I felt a little tired, but I was happy to practice.", zh: "我有點累，但很開心有練習。" },
      { speaker: "tutor", en: "That sounds honest. What topic do you want next?", zh: "這聽起來很真實。你接下來想聊什麼主題？" },
      { speaker: "user", en: "I'd like to practice travel English next.", zh: "接下來我想練旅遊英文。" },
    ],
    quiz: [],
  };
}
