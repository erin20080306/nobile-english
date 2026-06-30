"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, Play, RotateCcw, Wand2 } from "lucide-react";
import type { CustomScene, EnglishLevel, Scene, TutorFeedback, DialogueResult, DialogueTranscriptLine, LearningLanguageCode } from "@/types";
import { sceneService } from "@/services/sceneService";
import { learningService } from "@/services/learningService";
import { authService } from "@/services/authService";
import { sceneReviewService } from "@/services/sceneReviewService";
import { storageService, KEYS } from "@/services/storageService";
import { audioQueueService } from "@/services/audioQueueService";
import { dictionaryService } from "@/services/dictionaryService";
import { vocabularyService } from "@/services/vocabularyService";
import { sceneCardStyle } from "@/data/sceneVisuals";
import { LEARNING_LANGUAGES, getLearningLanguage } from "@/data/learningLanguages";
import AppHeader from "@/components/AppHeader";
import ConversationPractice from "@/components/ConversationPractice";
import TutorSelector, { getSelectedTutor, TutorAvatar } from "@/components/TutorSelector";
import HorizontalScrollChips from "@/components/HorizontalScrollChips";
import { levelLabel } from "@/components/ui";
import type { TutorProfile } from "@/data/tutors";

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
  const [language, setLanguage] = useState<LearningLanguageCode>("en");

  useEffect(() => {
    setLanguage(learningService.getCurrentLanguage());
  }, []);

  function changeLanguage(code: LearningLanguageCode) {
    const user = authService.getCurrentUser();
    learningService.setCurrentLanguage(code, user?.id || undefined);
    setLanguage(code);
    setScene(null);
    setIsFreeMode(false);
  }

  async function prepareTutorAudio() {
    try {
      await audioQueueService.unlockAudio();
    } catch (error) {
      console.log("[AI_TTS] playback failed", {
        source: "dialogue_prepare_audio",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function pickScene(nextScene: Scene) {
    await prepareTutorAudio();
    setIsFreeMode(false);
    setScene({ ...nextScene, targetLanguage: nextScene.targetLanguage || language });
  }

  async function startFreeMode() {
    await prepareTutorAudio();
    setIsFreeMode(true);
    setScene(buildFreeScene(language));
  }

  if (!scene) {
    return (
      <ScenerPicker
        onPick={pickScene}
        preset={preset}
        onFreeMode={startFreeMode}
        router={router}
        language={language}
        onLanguageChange={changeLanguage}
      />
    );
  }
  if (isFreeMode) return <FreeChat targetLanguage={language} onExit={() => { setScene(null); setIsFreeMode(false); }} />;
  return <Chat scene={scene} onExit={() => setScene(null)} />;
}

function ScenerPicker({
  onPick,
  preset,
  onFreeMode,
  router,
  language,
  onLanguageChange,
}: {
  onPick: (s: Scene) => void;
  preset: string | null;
  onFreeMode: () => void;
  router: ReturnType<typeof useRouter>;
  language: LearningLanguageCode;
  onLanguageChange: (code: LearningLanguageCode) => void;
}) {
  const [showTutorModal, setShowTutorModal] = useState(false);
  const [currentTutor, setCurrentTutor] = useState<TutorProfile>(() => getSelectedTutor(language));

  useEffect(() => {
    setCurrentTutor(getSelectedTutor(language));
  }, [language]);

  useEffect(() => {
    if (preset) {
      const s = sceneService.getScene(preset);
      if (s) void onPick(s);
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
        <HorizontalScrollChips className="mb-4">
          {LEARNING_LANGUAGES.map((item) => (
            <button
              key={item.code}
              onClick={() => onLanguageChange(item.code)}
              className={`chip whitespace-nowrap ${language === item.code ? "bg-lilacDeep text-white shadow-soft" : "bg-white text-ink shadow-softer"}`}
            >
              {item.flag} {item.zhName}
            </button>
          ))}
        </HorizontalScrollChips>

        {/* Tutor selector banner */}
        <button
          onClick={() => setShowTutorModal(true)}
          className="w-full flex items-center gap-4 bg-white rounded-[30px] px-4 py-4 shadow-softer mb-4 transition-colors"
        >
          <TutorAvatar tutor={currentTutor} size={64} />
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs text-inkSoft">目前導師</p>
            <p className="text-lg font-extrabold text-ink leading-tight">{currentTutor.name} {currentTutor.flag}</p>
            <p className="text-sm font-bold text-lilacDeep">{currentTutor.accentLabel}</p>
            <p className="text-xs text-inkSoft truncate">{currentTutor.description}</p>
          </div>
          <span className="chip bg-lilac text-lilacDeep text-xs shrink-0">更換</span>
        </button>

        {showTutorModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
            <div className="w-full max-w-[480px] mx-auto bg-cream rounded-t-3xl p-5 max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <p className="font-extrabold text-ink text-lg">選擇 AI 導師</p>
                <button onClick={() => setShowTutorModal(false)} className="chip bg-white text-inkSoft">完成</button>
              </div>
              <TutorSelector targetLanguage={language} onSelect={(t) => { setCurrentTutor(t); }} />
              <button onClick={() => setShowTutorModal(false)} className="btn-primary w-full mt-4">確認選擇</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 mb-4">
          <button onClick={() => void onFreeMode()} className="w-full card !p-4 text-left transition-colors bg-gradient-to-r from-peach to-peachDeep text-white">
            <p className="font-bold">自由對話</p>
            <p className="text-xs opacity-90">可自由聊天，也可直接請 AI 建立練習主題</p>
          </button>
          <button onClick={() => router.push("/custom-scene")} className="w-full card !p-4 text-left transition-colors bg-white">
            <div className="flex items-center gap-2">
              <Wand2 size={18} className="text-lilacDeep" />
              <p className="font-bold text-ink">自訂場景練習</p>
            </div>
            <p className="text-xs text-inkSoft mt-1">輸入主題，自動產生階段式真人情境對話</p>
          </button>
        </div>
        {themes.map((t) => {
          const scenes = sceneService.getScenesByTheme(t.id).slice(0, 4);
          return (
            <div key={t.id} className="mb-4">
              <p className="font-bold text-ink mb-2">{t.emoji} {t.name}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {scenes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => void onPick(s)}
                    className="relative h-36 rounded-3xl p-4 text-left transition-colors overflow-hidden shadow-soft flex flex-col justify-between"
                    style={sceneCardStyle(t.color, 0.16, t.id)}
                  >
                    <div className="relative z-10 min-w-0">
                      <p className="text-lg leading-tight font-extrabold text-ink break-words">{s.name}</p>
                      <p className="mt-1 text-xs font-semibold text-inkSoft truncate">{s.enName}</p>
                    </div>
                    <span className="relative z-10 self-start rounded-full bg-white/85 px-3 py-1.5 text-xs font-extrabold text-lilacDeep shadow-softer">
                      {levelLabel(s.difficulty)}
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

function savePracticeWords(words: string[], language: LearningLanguageCode, source: string) {
  Array.from(new Set(words.map((word) => word.trim()).filter(Boolean))).forEach((word) => {
    const entry = dictionaryService.lookup(word, language).entry;
    if (entry) vocabularyService.saveWord(entry, source);
  });
}

function Chat({ scene, onExit }: { scene: Scene; onExit: () => void }) {
  const router = useRouter();
  const targetLanguage = scene.targetLanguage || learningService.getCurrentLanguage();
  const settings = useMemo(() => {
    const u = authService.getCurrentUser();
    return u ? learningService.getSettings(u.id) : null;
  }, []);
  const showZh = settings ? settings.showChineseGlobal && settings.dialogueChinese : true;

  function handleFinish(result: DialogueResult, userTurns: string[], feedbacks: TutorFeedback[]) {
    const transcript = buildTranscript(userTurns, feedbacks);
    learningService.addDialogue();
    learningService.touchActivity(8, 30);
    learningService.addRecord({
      type: "dialogue",
      targetLanguage,
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
    savePracticeWords(
      [...(scene.keyWords || []), ...(result.newWords || []), ...(result.conversationWords || [])],
      targetLanguage,
      scene.name
    );
    const shouldShowSceneReview = sceneReviewService.isDue();
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
      dialogueReview: result.dialogueReview,
      sceneReview: shouldShowSceneReview
        ? sceneReviewService.build(scene, targetLanguage, userTurns, feedbacks)
        : undefined,
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
        pronunciationOn={true}
        finishLabel="結束對話並看成果"
        onFinish={handleFinish}
      />
    </div>
  );
}

function FreeChat({ targetLanguage, onExit }: { targetLanguage: LearningLanguageCode; onExit: () => void }) {
  const router = useRouter();
  const settings = useMemo(() => {
    const u = authService.getCurrentUser();
    return u ? learningService.getSettings(u.id) : null;
  }, []);
  const showZh = settings ? settings.showChineseGlobal && settings.dialogueChinese : true;
  const [createdScene, setCreatedScene] = useState<CustomScene | null>(null);

  const languageInfo = getLearningLanguage(targetLanguage);
  const freeScene = buildFreeScene(targetLanguage);

  async function openCreatedScene(sceneId: string) {
    try {
      await audioQueueService.unlockAudio();
    } catch (error) {
      console.log("[AI_TTS] playback failed", {
        source: "dialogue_created_scene_prepare_audio",
        error: error instanceof Error ? error.message : String(error),
      });
    }
    router.push(`/dialogue?scene=${sceneId}`);
  }

  function createScenarioFromText(latest: string) {
    const explicitCreate = /建立|產生|自訂|新增|做一個|create|make|generate/i.test(latest) &&
      /主題|場景|情境|練習|scenario|scene|topic|practice/i.test(latest);
    const practiceRequest = /我想(練習|練)|幫我(練習|練)/.test(latest) &&
      /餐廳|點餐|面試|機場|飯店|購物|問路|電話|restaurant|order|interview|airport|hotel|shopping|direction/i.test(latest);
    if (!explicitCreate && !practiceRequest) return false;
    const topic = latest
      .replace(/可以|幫我|請|建立|產生|一個|的|場景|情境|主題|練習|嗎|？|\?|create|make|scenario|scene|topic/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const situation = topic || latest;
    const level: EnglishLevel = "Elementary";
    const custom = sceneService.createCustomScene({
      situation,
      role: "customer",
      place: /餐廳|點餐|restaurant|order/i.test(latest) ? "restaurant" : "real-life setting",
      difficulty: level,
      topic: situation,
      pattern: "",
      showChinese: showZh,
      rounds: 6,
      targetLanguage,
    });
    setCreatedScene(custom);
    return true;
  }

  function handleFinish(result: DialogueResult, userTurns: string[], feedbacks: TutorFeedback[]) {
    const transcript = buildTranscript(userTurns, feedbacks);
    learningService.addDialogue();
    learningService.touchActivity(10, 30);
    learningService.addRecord({
      type: "dialogue",
      targetLanguage,
      title: `自由對話（${languageInfo.zhName}）`,
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
    savePracticeWords(
      [...(freeScene.keyWords || []), ...(result.newWords || []), ...(result.conversationWords || [])],
      targetLanguage,
      freeScene.name
    );
    storageService.set(KEYS.lastResult, {
      kind: "dialogue",
      title: `自由對話（${languageInfo.zhName}）`,
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
      dialogueReview: result.dialogueReview,
      nextHref: "/dialogue",
    });
    router.push("/results");
  }

  if (createdScene) {
    const scene = createdScene.scene;
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <AppHeader
          title="自訂場景練習"
          subtitle="已從自由對話建立階段式主題"
          right={
            <button onClick={onExit} className="chip bg-white text-inkSoft shadow-softer flex items-center gap-1">
              <RotateCcw size={14} /> 回選單
            </button>
          }
        />
        <div className="px-5 pb-8 space-y-4">
          <div className="card bg-gradient-to-br from-peach to-lilac">
            <div className="flex items-center gap-2">
              <Wand2 className="text-peachDeep" />
              <p className="text-xl font-extrabold text-ink">{scene.name}</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink">{scene.intro}</p>
          </div>

          {createdScene.stages && createdScene.stages.length > 0 && (
            <div className="card">
              <p className="font-extrabold text-ink mb-3">自動階段</p>
              <div className="space-y-2">
                {createdScene.stages.map((stage, index) => (
                  <div key={stage.title} className="rounded-3xl bg-cream p-3">
                    <p className="text-sm font-extrabold text-peachDeep">STEP {index + 1}</p>
                    <p className="font-bold text-ink">{stage.title}</p>
                    <p className="text-sm text-inkSoft">{stage.learnerGoal}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <p className="font-extrabold text-ink mb-2">會用到的句型</p>
            <div className="space-y-2">
              {scene.keyPatterns.map((p) => (
                <div key={p.en} className="rounded-2xl bg-white/70 px-3 py-2">
                  <p className="font-semibold text-ink">{p.en}</p>
                  <p className="text-sm text-inkSoft">{p.zh}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn-primary w-full flex items-center justify-center gap-2"
            onClick={() => void openCreatedScene(scene.id)}
          >
            <Play size={18} /> 開始自訂場景練習
          </button>
          <button className="btn-secondary w-full" onClick={() => setCreatedScene(null)}>繼續自由對話</button>
        </div>
      </div>
    );
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
        pronunciationOn={true}
        finishLabel="結束對話並看成果"
        onUserTurn={createScenarioFromText}
        onFinish={handleFinish}
      />
    </div>
  );
}

function buildFreeScene(targetLanguage: LearningLanguageCode = "en"): Scene {
  const language = getLearningLanguage(targetLanguage);
  if (targetLanguage !== "en") {
    const patterns: Record<LearningLanguageCode, { en: string; zh: string }[]> = {
      en: [],
      ja: [
        { en: "今日は何をしたいですか？", zh: "今天想做什麼？" },
        { en: "もう少し詳しく教えてください。", zh: "請再詳細告訴我一點。" },
        { en: "それは面白いですね。", zh: "那很有趣呢。" },
      ],
      ko: [
        { en: "오늘 무엇을 하고 싶어요?", zh: "今天想做什麼？" },
        { en: "조금 더 자세히 말해 주세요.", zh: "請再詳細說一點。" },
        { en: "정말 재미있네요.", zh: "真的很有趣。" },
      ],
      it: [
        { en: "Che cosa vuoi fare oggi?", zh: "今天想做什麼？" },
        { en: "Dimmi qualcosa in più.", zh: "再多告訴我一點。" },
        { en: "È molto interessante.", zh: "這很有趣。" },
      ],
      es: [
        { en: "¿Qué quieres hacer hoy?", zh: "今天想做什麼？" },
        { en: "Cuéntame un poco más.", zh: "再多告訴我一點。" },
        { en: "Eso es muy interesante.", zh: "這很有趣。" },
      ],
    };
    const dialogue: Record<LearningLanguageCode, Scene["dialogue"]> = {
      en: [],
      ja: [
        { speaker: "tutor", en: language.freeOpening.target, zh: language.freeOpening.zh },
        { speaker: "user", en: "日本語を練習したいです。", zh: "我想練習日文。" },
        { speaker: "tutor", en: "いいですね。今日はどんなテーマがいいですか？", zh: "很好。今天想練什麼主題呢？" },
      ],
      ko: [
        { speaker: "tutor", en: language.freeOpening.target, zh: language.freeOpening.zh },
        { speaker: "user", en: "한국어를 연습하고 싶어요.", zh: "我想練習韓文。" },
        { speaker: "tutor", en: "좋아요. 오늘 어떤 주제가 좋을까요?", zh: "很好。今天想練什麼主題呢？" },
      ],
      it: [
        { speaker: "tutor", en: language.freeOpening.target, zh: language.freeOpening.zh },
        { speaker: "user", en: "Vorrei praticare l'italiano.", zh: "我想練習義大利文。" },
        { speaker: "tutor", en: "Perfetto. Quale argomento vuoi provare oggi?", zh: "很好。今天想練什麼主題呢？" },
      ],
      es: [
        { speaker: "tutor", en: language.freeOpening.target, zh: language.freeOpening.zh },
        { speaker: "user", en: "Quiero practicar español.", zh: "我想練習西班牙文。" },
        { speaker: "tutor", en: "Perfecto. ¿Qué tema quieres practicar hoy?", zh: "很好。今天想練什麼主題呢？" },
      ],
    };
    const keyWordsByLanguage: Record<LearningLanguageCode, string[]> = {
      en: ["chat", "talk", "share", "express", "practice"],
      ja: ["今日", "練習", "話す", "テーマ", "詳しく"],
      ko: ["오늘", "연습", "말하다", "주제", "자세히"],
      it: ["oggi", "praticare", "parlare", "argomento", "dettaglio"],
      es: ["hoy", "practicar", "hablar", "tema", "detalle"],
    };
    return {
      id: "free-chat",
      themeId: "free",
      targetLanguage,
      name: `自由對話（${language.zhName}）`,
      enName: `${language.label} Free Conversation`,
      difficulty: "Intermediate",
      minutes: 10,
      intro: `沒有特定情境，使用${language.zhName}隨意聊聊任何你想練習的主題。`,
      goals: ["自由表達", "流暢對話", "日常聊天"],
      keyWords: keyWordsByLanguage[targetLanguage],
      keyPatterns: patterns[targetLanguage],
      dialogue: dialogue[targetLanguage],
      quiz: [],
    };
  }
  return {
    id: "free-chat",
    themeId: "free",
    targetLanguage,
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
