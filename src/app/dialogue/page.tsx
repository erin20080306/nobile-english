"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, RotateCcw } from "lucide-react";
import type { Scene, TutorFeedback, DialogueResult } from "@/types";
import { sceneService } from "@/services/sceneService";
import { learningService } from "@/services/learningService";
import { authService } from "@/services/authService";
import { storageService, KEYS } from "@/services/storageService";
import AppHeader from "@/components/AppHeader";
import ConversationPractice from "@/components/ConversationPractice";
import { LevelBadge } from "@/components/ui";

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

  if (!scene) return <ScenerPicker onPick={setScene} preset={preset} onFreeMode={() => setIsFreeMode(true)} router={router} />;
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
      <AppHeader title="對話學習" subtitle="選一個情境開始與 AI 導師對話" back={false} />
      <div className="px-5">
        <div className="card bg-gradient-to-br from-lilac to-sky mb-4 flex items-center gap-3">
          <Sparkles className="text-lilacDeep" />
          <p className="text-sm text-ink">本地 AI 導師已啟用，無需 API Key 即可練習！</p>
        </div>
        <button onClick={onFreeMode} className="w-full card !p-4 text-left active:scale-95 transition mb-4 bg-gradient-to-r from-peach to-peachDeep text-white">
          <p className="font-bold">自由對話</p>
          <p className="text-xs opacity-90">無特定情境，支援語音或手動輸入練習</p>
        </button>
        {themes.map((t) => {
          const scenes = sceneService.getScenesByTheme(t.id).slice(0, 4);
          return (
            <div key={t.id} className="mb-4">
              <p className="font-bold text-ink mb-2">{t.emoji} {t.name}</p>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {scenes.map((s) => (
                  <button key={s.id} onClick={() => onPick(s)} className="min-w-[150px] card !p-4 text-left active:scale-95 transition">
                    <p className="font-bold text-ink">{s.name}</p>
                    <p className="text-xs text-inkSoft">{s.enName}</p>
                    <LevelBadge level={s.difficulty} />
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

function Chat({ scene, onExit }: { scene: Scene; onExit: () => void }) {
  const router = useRouter();
  const settings = useMemo(() => {
    const u = authService.getCurrentUser();
    return u ? learningService.getSettings(u.id) : null;
  }, []);
  const showZh = settings ? settings.dialogueChinese : true;
  const pron = settings ? settings.pronunciationOn : true;

  function handleFinish(result: DialogueResult, userTurns: string[], feedbacks: TutorFeedback[]) {
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
      score: result.total,
      completed: true,
      minutes: 8,
    });
    storageService.set(KEYS.lastResult, {
      kind: "dialogue",
      title: scene.name + "（對話）",
      total: result.total,
      breakdown: [
        { label: "單字", value: result.vocab },
        { label: "文法", value: result.grammar },
        { label: "流暢度", value: result.fluency },
        { label: "任務完成", value: result.taskCompletion },
      ],
      newWords: result.newWords,
      reviewSentences: result.reviewSentences,
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
            <RotateCcw size={14} /> 換情境
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

  // Generic free conversation scene
  const freeScene: Scene = {
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
      { speaker: "tutor", en: "Great! Let's start with something simple. How are you?", zh: "太好了！我們從簡單的開始。你好嗎？" },
      { speaker: "user", en: "I'm doing well, thank you.", zh: "我過得不錯，謝謝。" },
      { speaker: "tutor", en: "What did you do today?", zh: "你今天做了什麼？" },
      { speaker: "user", en: "I worked and studied English for a while.", zh: "我工作了一下，也讀了一會兒英文。" },
      { speaker: "tutor", en: "Nice. What do you like to do for fun?", zh: "不錯。你平常喜歡做什麼？" },
      { speaker: "user", en: "I like watching movies and listening to music.", zh: "我喜歡看電影和聽音樂。" },
      { speaker: "tutor", en: "That sounds fun. Tell me more about your favorite movie.", zh: "聽起來很有趣。多說說你最喜歡的電影。" },
      { speaker: "user", en: "My favorite movie is exciting and easy to understand.", zh: "我最喜歡的電影很刺激，也容易理解。" },
      { speaker: "tutor", en: "Great. What topic would you like to practice next?", zh: "很好。接下來想練什麼主題？" },
      { speaker: "user", en: "I'd like to practice travel English next.", zh: "接下來我想練旅遊英文。" },
    ],
    quiz: [],
  };

  function handleFinish(result: DialogueResult, userTurns: string[], feedbacks: TutorFeedback[]) {
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
      score: result.total,
      completed: true,
      minutes: 10,
    });
    storageService.set(KEYS.lastResult, {
      kind: "dialogue",
      title: "自由對話",
      total: result.total,
      breakdown: [
        { label: "單字", value: result.vocab },
        { label: "文法", value: result.grammar },
        { label: "流暢度", value: result.fluency },
        { label: "任務完成", value: result.taskCompletion },
      ],
      newWords: result.newWords,
      reviewSentences: result.reviewSentences,
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
