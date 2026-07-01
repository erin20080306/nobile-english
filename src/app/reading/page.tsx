"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Play, Pause, SkipBack, SkipForward, Volume2, Bookmark, CheckCircle, ArrowLeft } from "lucide-react";
import type { LearningLanguageCode } from "@/types";
import { LEARNING_LANGUAGES, getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import { audioQueueService } from "@/services/audioQueueService";
import { learningService } from "@/services/learningService";
import { speechService } from "@/services/speechService";
import { trialAccessService, type AccessState } from "@/services/trialAccessService";
import { trialUsageService, TRIAL_READING_ARTICLE_LIMIT } from "@/services/trialUsageService";
import { useUser } from "@/hooks/useUser";
import WordSheet from "@/components/WordSheet";
import ClickableText from "@/components/ClickableText";
import SubscriptionLaunchPrompt from "@/components/SubscriptionLaunchPrompt";

interface ReadingQuestion {
  id: string;
  question_type: string;
  question_text: string;
  options_json: { options: string[] };
  correct_answer_json: { answer: string };
  explanation_zh_tw: string;
}

interface ReadingSentence {
  id: string;
  sentence_order: number;
  sentence_text: string;
  sentence_zh_tw: string;
  audio_url?: string | null;
}

interface ReadingArticle {
  id: string;
  title: string;
  title_zh_tw: string;
  article_text: string;
  difficulty_level: string;
  sentences: ReadingSentence[];
  questions?: ReadingQuestion[];
}

const LANG_VOICE: Record<string, string> = {
  en: "nova", ja: "nova", ko: "nova", it: "nova", es: "nova",
};

function isPlayableAudioUrl(url?: string | null) {
  return Boolean(url && !url.startsWith("stub://"));
}

function audioBase64ToObjectUrl(audioBase64: string, audioFormat = "mp3") {
  const binary = window.atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: `audio/${audioFormat || "mp3"}` }));
}

export default function DailyReadingPage() {
  const router = useRouter();
  const { user, ready } = useUser({ requireOnboarded: true });

  const [selectedLanguage, setSelectedLanguage] = useState<LearningLanguageCode>("en");
  const [article, setArticle] = useState<ReadingArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [showChinese, setShowChinese] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [selectedWord, setSelectedWord] = useState<{ word: string; sentence?: string } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [audioError, setAudioError] = useState("");

  const blobUrlsRef = useRef<string[]>([]);
  const speechFallbackSessionRef = useRef(0);

  const languageInfo = getLearningLanguage(selectedLanguage);

  useEffect(() => {
    if (!user) return;
    const settings = learningService.getSettings(user.id);
    setSelectedLanguage((settings.targetLanguage as LearningLanguageCode) || "en");
  }, [user]);

  useEffect(() => {
    if (ready && user) loadTodayArticle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage, ready]);

  useEffect(() => {
    if (autoScroll) {
      document.getElementById(`sentence-${currentSentenceIndex}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentSentenceIndex, autoScroll]);

  useEffect(() => {
    audioQueueService.setPlaybackRate(playbackSpeed);
  }, [playbackSpeed]);

  useEffect(() => {
    return () => {
      stopSpeechFallback();
      audioQueueService.clearQueue();
      blobUrlsRef.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch {} });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTodayArticle() {
    setLoading(true);
    setPlaying(false);
    stopSpeechFallback();
    audioQueueService.clearQueue();
    try {
      const nextAccess = await trialAccessService.getAccessState(user, { fresh: true }).catch(() => null);
      setAccess(nextAccess);
      if (
        trialUsageService.isLimited(nextAccess) &&
        !trialUsageService.canUseLifetime("readingArticle", TRIAL_READING_ARTICLE_LIMIT)
      ) {
        setArticle(null);
        setShowSubscriptionPrompt(true);
        return;
      }
      const res = await fetch(`/api/articles/today?language=${selectedLanguage}`);
      const nextArticle = res.ok ? await res.json() : null;
      setArticle(nextArticle);
      if (nextArticle && trialUsageService.isLimited(nextAccess)) {
        trialUsageService.useLifetime("readingArticle", TRIAL_READING_ARTICLE_LIMIT);
      }
    } catch {
      setArticle(null);
    } finally {
      setLoading(false);
      setCurrentSentenceIndex(0);
      setCompleted(false);
      setQuizAnswers({});
      setQuizSubmitted(false);
    }
  }

  async function requestSentenceTtsAsset(sentence: ReadingSentence, cacheOnly: boolean): Promise<string | null> {
    try {
      const cached = await fetch("/api/tts/get-or-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sentence.sentence_text,
          languageCode: selectedLanguage,
          assetType: "reading_sentence",
          voiceGender: "female",
          audioFormat: "mp3",
          cacheOnly,
        }),
      });
      if (cached.ok) {
        const data = await cached.json();
        if (typeof data.audioBase64 === "string" && data.audioBase64) {
          const url = audioBase64ToObjectUrl(data.audioBase64, data.audioFormat || "mp3");
          blobUrlsRef.current.push(url);
          return url;
        }
        if (isPlayableAudioUrl(data.signedUrl)) return data.signedUrl;
      }
    } catch {}
    return null;
  }

  async function getSentenceAudioUrl(sentence: ReadingSentence): Promise<string | null> {
    const accessState = await trialAccessService.getAccessState(user).catch(() => null);
    const cacheOnly = Boolean(accessState && !accessState.isSubscribed);

    const cachedOrFresh = await requestSentenceTtsAsset(sentence, cacheOnly);
    if (cachedOrFresh) return cachedOrFresh;

    if (cacheOnly) {
      const generated = await requestSentenceTtsAsset(sentence, false);
      if (generated) return generated;
    }

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: sentence.sentence_text,
          voice: LANG_VOICE[selectedLanguage] ?? "nova",
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        blobUrlsRef.current.push(url);
        return url;
      }
    } catch {}
    return null;
  }

  function stopSpeechFallback() {
    speechFallbackSessionRef.current += 1;
    speechService.stop();
  }

  function playArticleWithSpeechFallback(startIndex: number, continueToEnd: boolean) {
    if (!article) return false;
    const sessionId = speechFallbackSessionRef.current + 1;
    speechFallbackSessionRef.current = sessionId;
    const baseVoice = voiceForLanguage(selectedLanguage, playbackSpeed);

    const playAt = (index: number) => {
      if (speechFallbackSessionRef.current !== sessionId || !article) return;
      const sentence = article.sentences[index];
      if (!sentence) {
        setPlaying(false);
        setCompleted(true);
        return;
      }
      setCurrentSentenceIndex(index);
      const result = speechService.speak(sentence.sentence_text, {
        ...baseVoice,
        rate: playbackSpeed,
        ttsVoice: undefined,
        ttsInstructions: undefined,
        onStart: () => {
          if (speechFallbackSessionRef.current === sessionId) setPlaying(true);
        },
        onEnd: () => {
          if (speechFallbackSessionRef.current !== sessionId) return;
          if (continueToEnd && index < article.sentences.length - 1) {
            playAt(index + 1);
            return;
          }
          setPlaying(false);
          if (index >= article.sentences.length - 1) setCompleted(true);
        },
        onError: (message) => {
          if (speechFallbackSessionRef.current !== sessionId) return;
          setPlaying(false);
          setAudioError(message || "文章音檔暫時無法播放，請稍後再試。");
        },
      });
      if (!result.ok) {
        setPlaying(false);
        setAudioError(result.message || "文章音檔暫時無法播放，請稍後再試。");
      }
    };

    playAt(startIndex);
    return true;
  }

  async function enqueueFrom(startIndex: number) {
    if (!article) return 0;
    const sentences = article.sentences.slice(startIndex);
    if (sentences.length === 0) return 0;

    const urls = await Promise.all(sentences.map((s) => getSentenceAudioUrl(s)));
    let queued = 0;

    for (let i = 0; i < sentences.length; i++) {
      const url = urls[i];
      if (!url) continue;
      const s = sentences[i];
      const idx = s.sentence_order - 1;
      audioQueueService.enqueue({
        id: `sentence-${s.id}-${Date.now()}-${i}`,
        url,
        text: s.sentence_text,
        priority: 5,
        onStart: () => { setCurrentSentenceIndex(idx); setPlaying(true); },
        onEnd: () => {
          if (idx === article.sentences.length - 1) {
            setPlaying(false);
            setCompleted(true);
          }
        },
        onError: () => setPlaying(false),
      });
      queued += 1;
    }
    return queued;
  }

  async function playFullArticle() {
    if (!article) return;
    setAudioLoading(true);
    setAudioError("");
    stopSpeechFallback();
    await audioQueueService.unlockAudio();
    audioQueueService.clearQueue();
    const queued = await enqueueFrom(0);
    setAudioLoading(false);
    setPlaying(queued > 0);
    if (queued === 0 && !playArticleWithSpeechFallback(0, true)) {
      setAudioError("目前沒有可播放的文章音檔，請確認 TTS_PROVIDER 與 Google/Polly key 已設定。");
    }
  }

  function pausePlayback() {
    stopSpeechFallback();
    audioQueueService.stopCurrent();
    audioQueueService.clearQueue();
    setPlaying(false);
  }

  async function resumePlayback() {
    if (!article) return;
    setAudioLoading(true);
    setAudioError("");
    stopSpeechFallback();
    await audioQueueService.unlockAudio();
    audioQueueService.clearQueue();
    const queued = await enqueueFrom(currentSentenceIndex);
    setAudioLoading(false);
    setPlaying(queued > 0);
    if (queued === 0 && !playArticleWithSpeechFallback(currentSentenceIndex, true)) {
      setAudioError("目前沒有可播放的文章音檔，請確認 TTS_PROVIDER 與 Google/Polly key 已設定。");
    }
  }

  function stopPlayback() {
    stopSpeechFallback();
    audioQueueService.stopCurrent();
    audioQueueService.clearQueue();
    setPlaying(false);
    setCurrentSentenceIndex(0);
  }

  async function playSpecificSentence(index: number) {
    if (!article) return;
    stopSpeechFallback();
    audioQueueService.stopCurrent();
    audioQueueService.clearQueue();
    setCurrentSentenceIndex(index);
    setAudioLoading(true);
    setAudioError("");
    await audioQueueService.unlockAudio();
    const queued = await enqueueFrom(index);
    setAudioLoading(false);
    setPlaying(queued > 0);
    if (queued === 0 && !playArticleWithSpeechFallback(index, false)) {
      setAudioError("目前沒有可播放的文章音檔，請確認 TTS_PROVIDER 與 Google/Polly key 已設定。");
    }
  }

  function playPreviousSentence() {
    if (currentSentenceIndex > 0) void playSpecificSentence(currentSentenceIndex - 1);
  }

  function playNextSentence() {
    if (article && currentSentenceIndex < article.sentences.length - 1)
      void playSpecificSentence(currentSentenceIndex + 1);
  }

  function toggleBookmark() {
    setBookmarked((b) => !b);
  }

  async function markAsCompleted() {
    if (!article || completed) return;
    setCompleted(true);
    try {
      await fetch("/api/articles/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id, languageCode: selectedLanguage }),
      });
    } catch {}
  }

  function handleWordClick(_e: React.MouseEvent, sentence: string) {
    const text = window.getSelection()?.toString().trim();
    if (text) setSelectedWord({ word: text, sentence });
  }

  function getQuizScore() {
    if (!article?.questions?.length) return 0;
    const correct = article.questions.filter(
      (q) => quizAnswers[q.id] === q.correct_answer_json.answer
    ).length;
    return Math.round((correct / article.questions.length) * 100);
  }

  if (!ready || !user) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lilacDeep" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lilacDeep mx-auto mb-4" />
          <p className="text-inkSoft">正在準備今日閱讀內容...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-4">
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 p-2 rounded-full bg-sand text-ink hover:bg-sand/80 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
          <BookOpen size={48} className="text-lilacDeep mx-auto mb-4" />
          <h2 className="text-xl font-bold text-ink mb-2">今日文章尚未準備好</h2>
          <p className="text-inkSoft mb-4">請稍後再試或切換其他語言</p>
          <div className="flex gap-2 justify-center flex-wrap mb-4">
            {LEARNING_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLanguage(lang.code as LearningLanguageCode)}
                className={`rounded-full px-3 py-1 text-sm font-bold transition ${
                  selectedLanguage === lang.code
                    ? "bg-lilacDeep text-white"
                    : "bg-sand text-inkSoft"
                }`}
              >
                {lang.flag} {lang.zhName}
              </button>
            ))}
          </div>
          <button onClick={() => router.back()} className="px-4 py-2 bg-lilacDeep text-white rounded-full">
            返回
          </button>
        </div>
        {access && showSubscriptionPrompt && (
          <SubscriptionLaunchPrompt
            access={access}
            onSubscribe={() => router.push("/subscription")}
            onContinueTrial={access.reason === "trial" ? () => setShowSubscriptionPrompt(false) : undefined}
          />
        )}
      </div>
    );
  }

  const isLastSentence = currentSentenceIndex >= article.sentences.length - 1;
  const progress = ((currentSentenceIndex + 1) / article.sentences.length) * 100;

  return (
    <div className="min-h-screen bg-cream pb-48">
      {/* Header */}
      <div className="sticky top-0 bg-cream/95 backdrop-blur border-b border-sand p-4 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full bg-sand text-ink hover:bg-sand/80 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-lg font-bold text-ink flex-1 truncate">{article.title}</h1>
            <button
              onClick={toggleBookmark}
              className={`p-2 rounded-full ${bookmarked ? "text-peachDeep" : "text-inkSoft"}`}
            >
              <Bookmark size={22} fill={bookmarked ? "currentColor" : "none"} />
            </button>
          </div>

          {/* Language selector */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {LEARNING_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLanguage(lang.code as LearningLanguageCode)}
                className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition ${
                  selectedLanguage === lang.code
                    ? "bg-lilacDeep text-white"
                    : "bg-sand text-inkSoft"
                }`}
              >
                {lang.flag} {lang.zhName}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
            <span className="px-2 py-0.5 bg-lilacLight text-lilacDeep rounded-full">{languageInfo.nativeName}</span>
            <span className="px-2 py-0.5 bg-sand text-inkSoft rounded-full">{article.difficulty_level}</span>
            {completed && (
              <span className="px-2 py-0.5 bg-mintLight text-mintDeep rounded-full flex items-center gap-1">
                <CheckCircle size={12} />已完成
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {article.sentences.map((sentence, index) => (
          <motion.div
            key={sentence.id}
            id={`sentence-${index}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.04, 0.4) }}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("button")) return;
              void playSpecificSentence(index);
            }}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              currentSentenceIndex === index
                ? "border-lilacDeep bg-lilacLight/40 shadow-soft"
                : "border-transparent bg-white"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className={`text-xs font-bold mt-1 w-5 shrink-0 ${currentSentenceIndex === index ? "text-lilacDeep" : "text-inkSoft/40"}`}>
                {sentence.sentence_order}
              </span>
              <div className="flex-1">
                <div className="text-base text-ink leading-relaxed" onMouseUp={(e) => handleWordClick(e, sentence.sentence_text)}>
                  <ClickableText
                    text={sentence.sentence_text}
                    language={selectedLanguage}
                    onWord={(word) => setSelectedWord({ word, sentence: sentence.sentence_text })}
                  />
                </div>
                {showChinese && (
                  <p className="text-sm text-inkSoft mt-1">{sentence.sentence_zh_tw}</p>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {/* Quiz section — shown after completing */}
        {completed && article.questions && article.questions.length > 0 && (
          <div id="sentence-quiz" className="mt-4 pt-4 border-t border-sand">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-ink">📝 閱讀測驗</h3>
              {quizSubmitted && (
                <span className="text-sm font-bold text-lilacDeep">{getQuizScore()} 分</span>
              )}
            </div>
            <div className="space-y-4">
              {article.questions.map((q, qi) => (
                <div key={q.id} className="bg-white rounded-xl p-4 shadow-softer">
                  <p className="font-semibold text-ink mb-3">{qi + 1}. {q.question_text}</p>
                  <div className="space-y-2">
                    {q.options_json.options.map((opt) => {
                      const isSelected = quizAnswers[q.id] === opt;
                      const isCorrect = opt === q.correct_answer_json.answer;
                      let cls = "w-full text-left px-3 py-2 rounded-lg text-sm border transition ";
                      if (!quizSubmitted) {
                        cls += isSelected
                          ? "border-lilacDeep bg-lilacLight text-lilacDeep"
                          : "border-sand bg-cream text-ink hover:bg-sand/50";
                      } else {
                        if (isCorrect) cls += "border-mintDeep bg-mintLight text-mintDeep font-bold";
                        else if (isSelected) cls += "border-peachDeep bg-peachLight text-peachDeep";
                        else cls += "border-sand bg-cream text-inkSoft";
                      }
                      return (
                        <button
                          key={opt}
                          className={cls}
                          disabled={quizSubmitted}
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {quizSubmitted && (
                    <p className="text-xs text-inkSoft mt-2 leading-relaxed">💡 {q.explanation_zh_tw}</p>
                  )}
                </div>
              ))}
            </div>
            {!quizSubmitted && (
              <button
                onClick={() => setQuizSubmitted(true)}
                disabled={Object.keys(quizAnswers).length < (article.questions?.length ?? 0)}
                className="w-full mt-4 py-3 rounded-xl bg-lilacDeep text-white font-bold disabled:opacity-50 transition active:scale-[0.98]"
              >
                提交答案
              </button>
            )}
          </div>
        )}
      </div>

      {/* Playback Controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-cream/95 backdrop-blur border-t border-sand p-4 z-10">
        <div className="max-w-2xl mx-auto">
          {/* Progress Bar */}
          {audioError && (
            <div className="mb-3 rounded-2xl bg-peachLight px-3 py-2 text-xs font-bold text-peachDeep">
              {audioError}
            </div>
          )}
          <div className="mb-3">
            <div className="h-1.5 bg-sand rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-lilacDeep rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between text-xs text-inkSoft mt-1">
              <span>{currentSentenceIndex + 1} / {article.sentences.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <button
              onClick={playPreviousSentence}
              disabled={currentSentenceIndex === 0 || audioLoading}
              className="p-2.5 rounded-full bg-sand text-ink disabled:opacity-40 hover:bg-sand/80 transition-colors"
            >
              <SkipBack size={22} />
            </button>

            {audioLoading ? (
              <div className="p-4 rounded-full bg-lilacDeep/50 text-white">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            ) : !playing ? (
              <button
                onClick={currentSentenceIndex > 0 ? resumePlayback : playFullArticle}
                className="p-4 rounded-full bg-lilacDeep text-white hover:bg-lilacDark transition-colors shadow-soft active:scale-95"
              >
                <Play size={28} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={pausePlayback}
                className="p-4 rounded-full bg-lilacDeep text-white hover:bg-lilacDark transition-colors shadow-soft active:scale-95"
              >
                <Pause size={28} />
              </button>
            )}

            <button
              onClick={playNextSentence}
              disabled={isLastSentence || audioLoading}
              className="p-2.5 rounded-full bg-sand text-ink disabled:opacity-40 hover:bg-sand/80 transition-colors"
            >
              <SkipForward size={22} />
            </button>

            <button
              onClick={stopPlayback}
              title="停止並回到開頭"
              className="p-2.5 rounded-full bg-sand text-ink hover:bg-sand/80 transition-colors"
            >
              <Volume2 size={22} />
            </button>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowChinese((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                  showChinese ? "bg-lilacLight text-lilacDeep" : "bg-sand text-inkSoft"
                }`}
              >
                繁中
              </button>
              <button
                onClick={() => setAutoScroll((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                  autoScroll ? "bg-lilacLight text-lilacDeep" : "bg-sand text-inkSoft"
                }`}
              >
                自動捲動
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="px-2 py-1 rounded-full text-xs bg-sand text-ink"
              >
                <option value={0.75}>0.75x</option>
                <option value={0.9}>0.9x</option>
                <option value={1.0}>1.0x</option>
                <option value={1.15}>1.15x</option>
                <option value={1.25}>1.25x</option>
              </select>

              {!completed ? (
                <button
                  onClick={markAsCompleted}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-peachLight text-peachDeep hover:bg-peachLight/80 transition-colors"
                >
                  完成閱讀
                </button>
              ) : article.questions?.length && !quizSubmitted ? (
                <button
                  onClick={() => document.getElementById("sentence-quiz")?.scrollIntoView({ behavior: "smooth" })}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-lilacLight text-lilacDeep transition-colors"
                >
                  📝 做測驗
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Word Sheet */}
      {selectedWord && (
        <WordSheet
          word={selectedWord.word}
          sentence={selectedWord.sentence}
          language={selectedLanguage}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}
