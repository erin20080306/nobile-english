"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Volume2, Star, Target, BookOpen, Mic } from "lucide-react";
import { sceneService } from "@/services/sceneService";
import { learningService } from "@/services/learningService";
import { dictionaryService } from "@/services/dictionaryService";
import { sceneReviewService } from "@/services/sceneReviewService";
import { gardenService } from "@/services/gardenService";
import { speechService } from "@/services/speechService";
import { storageService, KEYS } from "@/services/storageService";
import { authService } from "@/services/authService";
import { vocabularyService } from "@/services/vocabularyService";
import { trialAccessService, type AccessState } from "@/services/trialAccessService";
import { trialUsageService } from "@/services/trialUsageService";
import { getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import AppHeader from "@/components/AppHeader";
import ClickableText from "@/components/ClickableText";
import WordSheet from "@/components/WordSheet";
import ConversationPractice from "@/components/ConversationPractice";
import ShadowingPractice from "@/components/ShadowingPractice";
import SubscriptionLaunchPrompt from "@/components/SubscriptionLaunchPrompt";
import { LevelBadge } from "@/components/ui";
import type { DialogueResult, TutorFeedback, DialogueTranscriptLine } from "@/types";

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
  const customScene = useMemo(() => sceneService.getCustomScenes().find((c) => c.scene.id === sceneId), [sceneId]);
  const customStages = customScene?.stages;

  const [activeWord, setActiveWord] = useState<{ word: string; sentence?: string } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [savedSentences, setSavedSentences] = useState<string[]>([]);
  const [shadowingPatternIndex, setShadowingPatternIndex] = useState<number | null>(null);
  const [pronunciationScores, setPronunciationScores] = useState<Record<number, number>>({});
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [phase, setPhase] = useState<"preview" | "staged" | "conversation">("preview");
  const [access, setAccess] = useState<AccessState | null>(null);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);

  const settings = useMemo(() => {
    const u = authService.getCurrentUser();
    return u ? learningService.getSettings(u.id) : null;
  }, []);
  const showZh = settings ? settings.showChineseGlobal && settings.sceneChinese : true;
  const targetLanguage = scene?.targetLanguage || settings?.targetLanguage || learningService.getCurrentLanguage();
  const languageInfo = getLearningLanguage(targetLanguage);
  const activeScene = scene ? { ...scene, targetLanguage } : null;
  const theme = scene ? sceneService.getTheme(scene.themeId) : undefined;
  const indexInTheme = scene ? sceneService.getScenesByTheme(scene.themeId).findIndex((item) => item.id === scene.id) : -1;
  const trialLocked = Boolean(
    scene &&
      trialUsageService.isLimited(access) &&
      (scene.themeId === "custom" || !trialUsageService.canUseScene(scene, theme, indexInTheme))
  );

  useEffect(() => {
    trialAccessService.getAccessState(undefined, { fresh: true }).then(setAccess).catch(() => setAccess(null));
  }, []);

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
    const r = speechService.speak(text, {
      ...voiceForLanguage(targetLanguage, learningService.getSpeechRate(targetLanguage)),
      onError: (message) => alert(message),
    });
    if (!r.ok) alert(r.message);
  }

  function toggleSentence(en: string, zh: string) {
    const now = dictionaryService.toggleSentence(en, zh, scene!.name);
    setSavedSentences((arr) => (now ? [...arr, en] : arr.filter((x) => x !== en)));
  }

  function handleFinish(result: DialogueResult, userTurns: string[], feedbacks: TutorFeedback[]) {
    const quizQuestions = activeScene!.quiz;
    const correct = quizQuestions.reduce(
      (acc, q, i) => acc + (quizAnswers[i] === q.answerIndex ? 1 : 0),
      0
    );
    const quizScore = quizQuestions.length ? (correct / quizQuestions.length) * 30 : 25;
    const convScore = Math.round((result.total / 100) * 70);
    const score = Math.round(quizScore + convScore);

    sceneService.setProgress(activeScene!.id, score);
    learningService.addScene();
    learningService.touchActivity(activeScene!.minutes, 20 + correct * 5);
    learningService.addRecord({
      type: "scene",
      targetLanguage,
      title: activeScene!.name,
      sceneName: activeScene!.name,
      enContent: activeScene!.dialogue.map((d) => d.en).join(" / "),
      zhContent: activeScene!.dialogue.map((d) => d.zh).join(" / "),
      userAnswer: userTurns.join(" / "),
      suggestion: feedbacks.length > 0 ? feedbacks[feedbacks.length - 1].betterWay : "持續練習關鍵句型，注意禮貌用語。",
      transcript: buildTranscript(userTurns, feedbacks),
      score,
      completed: true,
      minutes: activeScene!.minutes,
    });

    // Add practiced scene vocabulary to the farm flip-card review pool.
    const practicedWords = Array.from(
      new Set([...(activeScene!.keyWords || []), ...(result.conversationWords || [])])
    )
      .map((word) => ({
        word,
        meaning: dictionaryService.lookup(word, targetLanguage).entry?.zh?.trim() || "",
      }))
      .filter((item) => item.meaning);
    gardenService.addSceneWords(targetLanguage, practicedWords);

    // Automatically save practiced words to user's vocabulary
    practicedWords.forEach((item) => {
      const { entry } = dictionaryService.lookup(item.word, targetLanguage);
      if (entry) {
        vocabularyService.addToReview(entry, `${activeScene!.name}場景練習`);
      }
    });

    const shouldShowSceneReview = sceneReviewService.isDue();
    storageService.set(KEYS.lastResult, {
      kind: "scene",
      title: `${activeScene!.name}（${languageInfo.zhName}場景對話）`,
      total: score,
      breakdown: [
        { label: "測驗", value: Math.round(quizScore / 30 * 100) },
        { label: "對話", value: convScore },
      ],
      newWords: activeScene!.keyWords,
      reviewSentences: activeScene!.keyPatterns.map((p) => p.en),
      conversationWords: result.conversationWords,
      suggestions: result.suggestions,
      dialogueReview: result.dialogueReview,
      sceneReview: shouldShowSceneReview
        ? sceneReviewService.build(activeScene!, targetLanguage, userTurns, feedbacks)
        : undefined,
      nextHref: "/scenes",
    });
    router.push("/results");
  }

  function startStagedPractice() {
    setCurrentStageIndex(0);
    setPhase("staged");
  }

  function handleStageComplete() {
    if (customStages && currentStageIndex < customStages.length - 1) {
      setCurrentStageIndex(currentStageIndex + 1);
    } else {
      setPhase("conversation");
    }
  }

  function startConversation() {
    if (trialLocked) {
      setShowSubscriptionPrompt(true);
      return;
    }
    setPhase("conversation");
  }

  // ---- Conversation phase ----
  if (phase === "conversation") {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <AppHeader
          title={activeScene!.name}
          subtitle="AI 語音對話練習"
          right={
            <button onClick={() => setPhase("preview")} className="chip bg-white text-inkSoft shadow-softer flex items-center gap-1">
              <BookOpen size={14} /> 看材料
            </button>
          }
        />
          <ConversationPractice
          scene={activeScene!}
          showZh={showZh}
          pronunciationOn={settings ? settings.pronunciationOn : true}
          finishLabel="結束對話並看成果"
          onFinish={handleFinish}
          customStages={customStages}
        />
      </div>
    );
  }

  // ---- Staged practice phase ----
  if (phase === "staged" && customStages && customStages.length > 0) {
    const currentStage = customStages[currentStageIndex];
    const isLastStage = currentStageIndex === customStages.length - 1;
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <AppHeader
          title={activeScene!.name}
          subtitle={`階段 ${currentStageIndex + 1} / ${customStages.length}`}
          right={
            <button onClick={() => setPhase("preview")} className="chip bg-white text-inkSoft shadow-softer flex items-center gap-1">
              <BookOpen size={14} /> 看材料
            </button>
          }
        />
        <div className="flex-1 px-5 py-4 space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card bg-gradient-to-br from-peach to-lilac"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-peachDeep px-3 py-1 text-sm font-extrabold text-white">STEP {currentStageIndex + 1}</span>
              <p className="font-extrabold text-ink">{currentStage.title}</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-lilacDeep">{currentStage.enTitle}</p>
            <p className="mt-2 text-ink">{currentStage.learnerGoal}</p>
          </motion.div>

          <div className="card">
            <p className="font-bold text-ink mb-2">參考回答</p>
            <div className="rounded-2xl bg-cream p-3">
              <p className="text-ink font-semibold">{currentStage.sampleUser}</p>
            </div>
          </div>

          <div className="card">
            <p className="font-bold text-ink mb-2">練習提示</p>
            <p className="text-sm text-inkSoft">AI 導師會說：「{currentStage.tutorPrompt}」</p>
            <p className="text-sm text-inkSoft mt-1">請練習如何回應這個問題。</p>
          </div>

          <button
            onClick={handleStageComplete}
            className="btn-primary w-full"
          >
            {isLastStage ? "完成階段練習，開始對話" : "完成此階段，進入下一階段"}
          </button>
        </div>
      </div>
    );
  }

  // ---- Preview phase ----
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-[100dvh] pb-28"
    >
      <AppHeader title={scene.name} subtitle={`${scene.enName} · ${languageInfo.flag} ${languageInfo.zhName}`} />

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

        {/* Custom Stages */}
        {customStages && customStages.length > 0 && (
          <div className="card">
            <p className="font-bold text-ink flex items-center gap-2"><BookOpen size={18} className="text-lilacDeep" /> 階段性練習</p>
            <p className="text-sm text-inkSoft mt-1">AI 導師會按照以下階段逐步引導對話</p>
            <div className="mt-3 space-y-2">
              {customStages.map((stage, index) => (
                <div key={index} className="rounded-2xl bg-cream p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-peachDeep px-2 py-0.5 text-[10px] font-extrabold text-white">STEP {index + 1}</span>
                    <p className="font-bold text-ink text-sm">{stage.title}</p>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-lilacDeep">{stage.enTitle}</p>
                  <p className="mt-1 text-xs text-inkSoft">{stage.learnerGoal}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key words */}
        <div className="card">
          <p className="font-bold text-ink flex items-center gap-2"><BookOpen size={18} className="text-lilacDeep" /> 關鍵單字</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {scene.keyWords.map((w) => (
              <button key={w} onClick={() => setActiveWord({ word: w })} className="chip bg-lilac text-lilacDeep">{w}</button>
            ))}
          </div>
        </div>

        {/* Patterns */}
        <div className="card">
          <p className="font-bold text-ink">重要句型</p>
          <div className="mt-2 space-y-2">
            {scene.keyPatterns.map((p, i) => (
              <div key={i}>
                {shadowingPatternIndex === i ? (
                  <ShadowingPractice
                    sentence={p.en}
                    translation={p.zh}
                    targetLanguage={targetLanguage}
                    onComplete={(score) => {
                      setPronunciationScores((prev) => ({ ...prev, [i]: score }));
                      setShadowingPatternIndex(null);
                    }}
                  />
                ) : (
                  <div className="rounded-3xl bg-cream p-3 flex items-start gap-2">
                    <button onClick={() => speak(p.en)} className="mt-0.5 text-lilacDeep"><Volume2 size={18} /></button>
                    <div className="flex-1">
                      <p className="text-ink font-semibold">
                        <ClickableText text={p.en} onWord={(word) => setActiveWord({ word, sentence: p.en })} language={targetLanguage} />
                      </p>
                      {showZh && <p className="text-sm text-inkSoft">{p.zh}</p>}
                    </div>
                    {pronunciationScores[i] !== undefined && (
                      <div className="flex items-center gap-1 text-xs font-bold">
                        <span className={pronunciationScores[i] >= 75 ? "text-mintDeep" : "text-peachDeep"}>
                          {pronunciationScores[i]}%
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => setShadowingPatternIndex(i)}
                      className="mt-0.5 text-lilacDeep hover:text-lilacDeep/80 transition"
                      title="跟讀練習"
                    >
                      <Mic size={18} />
                    </button>
                  </div>
                )}
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
                      <ClickableText
                        text={line.en}
                        onWord={(word) => setActiveWord({ word, sentence: line.en })}
                        language={targetLanguage}
                        className={isUser ? "text-white" : "text-ink"}
                      />
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
        {customStages && customStages.length > 0 ? (
          <div className="space-y-2">
            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={startStagedPractice}>
              <Target size={18} /> 開始階段性練習
            </button>
            <button className="btn-secondary w-full flex items-center justify-center gap-2" onClick={startConversation}>
              <Mic size={18} /> 直接開始對話
            </button>
          </div>
        ) : (
          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={startConversation}>
            <Mic size={18} /> 開始語音對話練習
          </button>
        )}
      </div>

      <WordSheet
        word={activeWord?.word || null}
        sentence={activeWord?.sentence}
        language={targetLanguage}
        showChinese={showZh}
        onClose={() => setActiveWord(null)}
      />
      {access && showSubscriptionPrompt && (
        <SubscriptionLaunchPrompt
          access={access}
          onSubscribe={() => router.push("/subscription")}
          onContinueTrial={access.reason === "trial" ? () => setShowSubscriptionPrompt(false) : undefined}
        />
      )}
    </motion.div>
  );
}
