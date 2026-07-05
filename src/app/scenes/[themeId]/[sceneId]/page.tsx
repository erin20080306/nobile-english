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
import { subscriptionReminderService } from "@/services/subscriptionReminderService";
import { dailyGoalService } from "@/services/dailyGoalService";
import { getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import AppHeader from "@/components/AppHeader";
import ClickableText from "@/components/ClickableText";
import WordSheet from "@/components/WordSheet";
import ConversationPractice from "@/components/ConversationPractice";
import ShadowingPractice from "@/components/ShadowingPractice";
import SubscriptionLaunchPrompt from "@/components/SubscriptionLaunchPrompt";
import { LevelBadge } from "@/components/ui";
import { pickShadowingPatternSet } from "@/services/shadowingPatternSet";
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
  const scene = useMemo(() => {
    const custom = sceneService.getCustomScenes().find((c) => c.scene.id === sceneId);
    if (custom) return custom.scene;
    return sceneService.getScene(sceneId);
  }, [sceneId]);
  const customScene = useMemo(() => sceneService.getCustomScenes().find((c) => c.scene.id === sceneId), [sceneId]);
  const customStages = customScene?.stages;

  const [activeWord, setActiveWord] = useState<{ word: string; sentence?: string } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [savedSentences, setSavedSentences] = useState<string[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [phase, setPhase] = useState<"preview" | "staged" | "conversation">("preview");
  const [stepIndex, setStepIndex] = useState(0);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [aiPatterns, setAiPatterns] = useState<{ en: string; zh: string }[] | null>(null);

  type PreviewStep =
    | { type: "overview" }
    | { type: "pattern"; index: number }
    | { type: "dialogue" }
    | { type: "quiz" };

  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  const settings = useMemo(() => (currentUser ? learningService.getSettings(currentUser.id) : null), [currentUser]);
  const showZh = settings ? settings.showChineseGlobal && settings.sceneChinese : true;
  const targetLanguage = scene?.targetLanguage || settings?.targetLanguage || learningService.getCurrentLanguage();
  const languageInfo = getLearningLanguage(targetLanguage);
  const theme = scene ? sceneService.getTheme(scene.themeId) : undefined;
  const indexInTheme = scene ? sceneService.getScenesByTheme(scene.themeId).findIndex((item) => item.id === scene.id) : -1;
  const trialLocked = Boolean(
    scene &&
      trialUsageService.isLimited(access) &&
      (scene.themeId === "custom" || !trialUsageService.canUseScene(scene, theme, indexInTheme))
  );

  // Built-in (non-custom) scenes ship with a static local pattern set, but on
  // first load we try to fetch (and cache server-side) AI-generated shadowing
  // sentences for this exact scene, so repeat learners get richer, less
  // repetitive content while still only paying the Gemini cost once per
  // scene/language (see /api/scenes/patterns). Custom scenes already get
  // AI-generated patterns at creation time, so they're skipped here.
  useEffect(() => {
    if (!scene || scene.themeId === "custom") return;
    let cancelled = false;
    fetch("/api/scenes/patterns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneId: scene.id,
        themeName: theme?.name || scene.themeId,
        sceneName: scene.name,
        enName: scene.enName,
        difficulty: scene.difficulty,
        learnerLevel: currentUser?.level || scene.difficulty,
        keyWords: scene.keyWords,
        targetLanguage,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.patterns) && data.patterns.length) {
          setAiPatterns(data.patterns);
        }
      })
      .catch(() => {
        /* keep using the scene's static local patterns */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id]);

  const patternSessionSeed = useMemo(() => `${sceneId}:${Date.now()}`, [sceneId]);
  // Prefer the AI-generated set once it arrives; otherwise fall back to the
  // scene's static local patterns immediately (no loading wait). Custom scenes
  // may store a larger pattern bank, so each visit picks a short rotating set.
  const effectivePatternBank = aiPatterns && aiPatterns.length ? aiPatterns : scene?.keyPatterns || [];
  const effectiveKeyPatterns =
    scene?.themeId === "custom"
      ? pickShadowingPatternSet(effectivePatternBank, patternSessionSeed)
      : effectivePatternBank;
  const activeScene = scene ? { ...scene, targetLanguage, keyPatterns: effectiveKeyPatterns } : null;

  // Fill-in-the-blank patterns (e.g. "I'd like a ___, please.") aren't
  // suitable for shadowing since there's no single correct sentence to
  // read aloud, so they're skipped when building shadowing steps.
  const shadowablePatterns = useMemo(
    () => effectiveKeyPatterns.filter((p) => !/_{2,}/.test(p.en)),
    [effectiveKeyPatterns]
  );

  const steps = useMemo<PreviewStep[]>(() => {
    if (!scene) return [{ type: "overview" }];
    const list: PreviewStep[] = [{ type: "overview" }];
    shadowablePatterns.forEach((_, index) => list.push({ type: "pattern", index }));
    list.push({ type: "dialogue" });
    if (scene.quiz.length > 0) list.push({ type: "quiz" });
    return list;
  }, [scene, shadowablePatterns]);

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
    if (currentUser) dailyGoalService.incrementProgress(currentUser.id, "scene");
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
    void learningService.syncRecords(currentUser?.id || storageService.get<string>(KEYS.session, ""));

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

    // Automatically save practiced words to user's vocabulary. Uses
    // lookupForSave (Gemini/OpenAI-backed) so unknown words get a real
    // Chinese meaning instead of a generic "情境對話常見..." placeholder
    // that would be unusable later in word review questions.
    practicedWords.forEach((item) => {
      void dictionaryService.lookupForSave(item.word, targetLanguage).then((entry) => {
        if (entry) vocabularyService.addToReview(entry, `${activeScene!.name}場景練習`);
      });
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

  function showLimitPrompt() {
    const featureKey: "customScene" | "dialoguePractice" = activeScene?.themeId === "custom" ? "customScene" : "dialoguePractice";
    if (subscriptionReminderService.shouldShowLimitReminder(currentUser?.id, featureKey, access, "session")) {
      subscriptionReminderService.markLimitReminderShown(currentUser?.id, featureKey, "session");
      setShowSubscriptionPrompt(true);
    }
  }

  function startConversation() {
    if (trialLocked) {
      showLimitPrompt();
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

  // ---- Preview phase: step-by-step, one screen per stage ----
  function goToNextStep() {
    // Unlock speech synthesis / audio playback synchronously within this
    // user gesture, so that if the next step auto-plays TTS (e.g. the
    // shadowing page), mobile browsers (iOS Safari) will allow it.
    speechService.unlockAudio();
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function goToPrevStep() {
    if (stepIndex === 0) {
      router.back();
      return;
    }
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  // Shadowing pattern steps link to standalone shadowing page
  if (currentStep.type === "pattern") {
    const p = shadowablePatterns[currentStep.index];
    // Store pattern info for the shadowing page
    storageService.set(KEYS.shadowingPattern, { 
      sentence: p.en, 
      translation: p.zh, 
      targetLanguage,
      sceneId: activeScene!.id,
      sceneName: activeScene!.name,
      sceneEnName: activeScene!.enName,
      themeId: activeScene!.themeId,
      allPatterns: shadowablePatterns,
      currentIndex: currentStep.index,
    });
    router.push("/shadowing");
    return null;
  }

  return (
    <motion.div
      key={stepIndex}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-[100dvh] pb-28"
    >
      <AppHeader
        title={scene.name}
        subtitle={`步驟 ${stepIndex + 1} / ${steps.length}`}
        onBack={goToPrevStep}
      />
      <div className="px-5 pt-1">
        <div className="h-1.5 bg-sand rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-lilacDeep rounded-full"
            animate={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        {currentStep.type === "overview" && (
          <>
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

            <div className="card">
              <p className="font-bold text-ink flex items-center gap-2"><BookOpen size={18} className="text-lilacDeep" /> 關鍵單字</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {scene.keyWords.map((w) => (
                  <button key={w} onClick={() => setActiveWord({ word: w })} className="chip bg-lilac text-lilacDeep">{w}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {currentStep.type === "dialogue" && (
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
        )}

        {currentStep.type === "quiz" && (
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
        )}
      </div>

      {/* Bottom bar: "下一步" until the last step, then start the conversation */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-cream/90 backdrop-blur">
        {isLastStep ? (
          customStages && customStages.length > 0 ? (
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
          )
        ) : (
          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={goToNextStep}>
            下一步
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
          promptReason="limit"
          featureName={activeScene?.themeId === "custom" ? "自訂場景" : "場景練習"}
          onSubscribe={() => router.push("/subscription")}
          onDismiss={() => setShowSubscriptionPrompt(false)}
        />
      )}
    </motion.div>
  );
}
