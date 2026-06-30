"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";
import type { LearningLanguageCode } from "@/types";
import { getLearningLanguage } from "@/data/learningLanguages";
import { audioQueueService } from "@/services/audioQueueService";
import WordSheet from "@/components/WordSheet";

interface Sentence {
  id: string;
  sentence_order: number;
  sentence_text: string;
  sentence_zh_tw: string;
  audio_url: string | null;
}

interface LexemeLink {
  id: string;
  sentence_id: string;
  start_index: number;
  end_index: number;
  display_text: string;
  phrase_priority: number;
}

interface Question {
  id: string;
  question_order: number;
  question_type: string;
  question_text: string;
  options_json: unknown;
  correct_answer_json: unknown;
  explanation_zh_tw: string;
}

interface ReadingArticle {
  id: string;
  title: string;
  title_zh_tw: string;
  article_text: string;
  difficulty_level: string;
  sentences: Sentence[];
  lexemeLinks: LexemeLink[];
  questions: Question[];
  isRewardClaimed?: boolean;
}

function questionOptions(question: Question): string[] {
  if (Array.isArray(question.options_json)) return question.options_json.map(String);
  const object = question.options_json as { options?: unknown[] } | null;
  return Array.isArray(object?.options) ? object.options.map(String) : [];
}

function correctIndex(question: Question): number {
  if (typeof question.correct_answer_json === "number") return question.correct_answer_json;
  const value = question.correct_answer_json as { index?: unknown; answer?: unknown } | null;
  if (typeof value?.index === "number") return value.index;
  const options = questionOptions(question);
  return typeof value?.answer === "string" ? options.indexOf(value.answer) : -1;
}

export default function DailyReadingPage() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<LearningLanguageCode>("en");
  const [article, setArticle] = useState<ReadingArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [showChinese, setShowChinese] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [finishedPlayback, setFinishedPlayback] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selectedWord, setSelectedWord] = useState<{ word: string; sentence?: string } | null>(null);

  const languageInfo = getLearningLanguage(selectedLanguage);
  const linksBySentence = useMemo(() => {
    const map = new Map<string, LexemeLink[]>();
    for (const link of article?.lexemeLinks || []) {
      const current = map.get(link.sentence_id) || [];
      current.push(link);
      map.set(link.sentence_id, current);
    }
    for (const links of map.values()) {
      // Longest/highest-priority links win when future prewarm adds phrases.
      links.sort((a, b) => b.phrase_priority - a.phrase_priority || (b.end_index - b.start_index) - (a.end_index - a.start_index) || a.start_index - b.start_index);
    }
    return map;
  }, [article]);

  const questionScore = useMemo(() => {
    if (!article?.questions.length) return 0;
    const correct = article.questions.reduce((count, question) => count + (answers[question.id] === correctIndex(question) ? 1 : 0), 0);
    return Math.round((correct / article.questions.length) * 100);
  }, [answers, article]);

  const quizDone = Boolean(article?.questions.length) && Object.keys(answers).length === article?.questions.length;
  const canComplete = Boolean(article) && finishedPlayback && quizDone && questionScore >= 60 && !completed;

  useEffect(() => {
    void loadTodayArticle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage]);

  useEffect(() => {
    audioQueueService.setPlaybackRate(playbackSpeed);
  }, [playbackSpeed]);

  useEffect(() => {
    if (autoScroll && currentSentenceIndex >= 0) {
      document.getElementById(`sentence-${currentSentenceIndex}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [autoScroll, currentSentenceIndex]);

  useEffect(() => () => audioQueueService.clearQueue(), []);

  async function loadTodayArticle() {
    setLoading(true);
    setStatusMessage("");
    setPlaying(false);
    setFinishedPlayback(false);
    setCompleted(false);
    setAnswers({});
    audioQueueService.clearQueue();
    try {
      const response = await fetch(`/api/articles/today?language=${selectedLanguage}`);
      const payload = await response.json().catch(() => null) as (ReadingArticle & { state?: string; error?: string }) | null;
      if (response.ok && payload?.state === "published") {
        setArticle(payload);
        setCompleted(Boolean(payload.isRewardClaimed));
        setCurrentSentenceIndex(0);
      } else {
        setArticle(null);
        setStatusMessage(payload?.state === "preparing" ? "今日文章正在準備語音與單字卡，請稍後再試。" : payload?.error || "今日文章尚未準備好。");
      }
    } catch {
      setArticle(null);
      setStatusMessage("無法取得今日文章，請確認網路後再試。");
    } finally {
      setLoading(false);
    }
  }

  async function playFrom(index: number, singleSentence = false) {
    if (!article) return;
    const start = Math.max(0, Math.min(index, article.sentences.length - 1));
    const items = singleSentence ? [article.sentences[start]] : article.sentences.slice(start);
    const missingAudio = items.find((sentence) => !sentence.audio_url);
    if (missingAudio) {
      setStatusMessage("這篇文章的語音還在準備中，請稍後重新整理。" );
      return;
    }

    const unlocked = await audioQueueService.unlockAudio();
    if (!unlocked) {
      setStatusMessage("請先點一次播放按鈕來開啟裝置語音。" );
      return;
    }

    setStatusMessage("");
    setFinishedPlayback(false);
    audioQueueService.clearQueue();
    setCurrentSentenceIndex(start);
    setPlaying(true);

    items.forEach((sentence, relativeIndex) => {
      const actualIndex = start + relativeIndex;
      audioQueueService.enqueue({
        id: `reading-${article.id}-${sentence.id}-${Date.now()}-${relativeIndex}`,
        url: sentence.audio_url!,
        text: sentence.sentence_text,
        priority: 5,
        onStart: () => {
          setCurrentSentenceIndex(actualIndex);
          setPlaying(true);
        },
        onEnd: () => {
          const lastQueuedItem = relativeIndex === items.length - 1;
          if (lastQueuedItem) {
            setPlaying(false);
            if (!singleSentence && actualIndex === article.sentences.length - 1) setFinishedPlayback(true);
          }
        },
        onError: () => {
          setPlaying(false);
          setStatusMessage("語音播放失敗，請重新整理文章後再試。" );
        },
      });
    });
  }

  function stopPlayback() {
    audioQueueService.clearQueue();
    setPlaying(false);
  }

  async function completeReading() {
    if (!article || !canComplete) return;
    setStatusMessage("");
    try {
      const token = localStorage.getItem("supabase_token") || "";
      const response = await fetch("/api/articles/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ articleId: article.id, languageCode: selectedLanguage, quizScore: questionScore }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setStatusMessage(payload?.error === "Authorization header missing" || payload?.error === "Unauthorized"
          ? "正式帳號登入尚未完成，暫時無法發放閱讀獎勵。"
          : payload?.error || "完成閱讀失敗，請稍後再試。");
        return;
      }
      setCompleted(true);
      setStatusMessage("完成閱讀！農場獎勵已發放。" );
    } catch {
      setStatusMessage("完成閱讀失敗，請稍後再試。" );
    }
  }

  function renderSentence(sentence: Sentence) {
    const candidates = linksBySentence.get(sentence.id) || [];
    const links: LexemeLink[] = [];
    let occupiedUntil = -1;
    for (const link of candidates) {
      if (link.start_index < occupiedUntil) continue;
      links.push(link);
      occupiedUntil = link.end_index;
    }
    links.sort((a, b) => a.start_index - b.start_index);
    if (!links.length) return sentence.sentence_text;

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    links.forEach((link) => {
      if (link.start_index > cursor) nodes.push(sentence.sentence_text.slice(cursor, link.start_index));
      nodes.push(
        <button
          type="button"
          key={link.id}
          onClick={() => setSelectedWord({ word: link.display_text, sentence: sentence.sentence_text })}
          className="rounded px-0.5 text-lilacDeep font-semibold hover:bg-lilacLight/60"
        >
          {sentence.sentence_text.slice(link.start_index, link.end_index)}
        </button>
      );
      cursor = link.end_index;
    });
    if (cursor < sentence.sentence_text.length) nodes.push(sentence.sentence_text.slice(cursor));
    return nodes;
  }

  if (loading) {
    return <div className="min-h-screen bg-cream flex items-center justify-center"><p className="text-inkSoft">正在準備今日閱讀內容...</p></div>;
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-5 text-center">
        <button onClick={() => router.back()} className="absolute top-4 left-4 p-2 rounded-full bg-sand text-ink"><ArrowLeft size={24} /></button>
        <Volume2 size={48} className="text-lilacDeep mb-4" />
        <h1 className="text-xl font-extrabold text-ink mb-2">今日文章尚未準備好</h1>
        <p className="text-inkSoft max-w-xs">{statusMessage || "請稍後再試。"}</p>
        <button onClick={() => void loadTodayArticle()} className="mt-5 px-4 py-2 rounded-full bg-lilacDeep text-white font-bold">重新整理</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-40">
      <header className="sticky top-0 z-10 border-b border-sand bg-cream/95 backdrop-blur p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-full bg-sand text-ink"><ArrowLeft size={22} /></button>
            <div className="flex-1 min-w-0"><h1 className="font-extrabold text-lg text-ink truncate">{article.title}</h1><p className="text-xs text-inkSoft truncate">{article.title_zh_tw}</p></div>
            <button onClick={() => setBookmarked((value) => !value)} className={`p-2 rounded-full ${bookmarked ? "text-peachDeep" : "text-inkSoft"}`}><Bookmark size={22} fill={bookmarked ? "currentColor" : "none"} /></button>
          </div>
          <div className="mt-3 flex gap-2 text-xs font-bold"><span className="rounded-full bg-lilacLight px-2 py-1 text-lilacDeep">{languageInfo.nativeName}</span><span className="rounded-full bg-sand px-2 py-1 text-inkSoft">{article.difficulty_level}</span>{completed && <span className="rounded-full bg-greenLight px-2 py-1 text-greenDark flex gap-1"><CheckCircle size={14} />已完成</span>}</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-5">
        {statusMessage && <p className="rounded-2xl bg-peachLight px-4 py-3 text-sm text-peachDeep">{statusMessage}</p>}
        <section className="space-y-3">
          {article.sentences.map((sentence, index) => (
            <motion.article key={sentence.id} id={`sentence-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-4 ${index === currentSentenceIndex ? "bg-lilacLight/50 ring-2 ring-lilacDeep" : "bg-white shadow-softer"}`}>
              <div className="flex items-start gap-3"><button onClick={() => void playFrom(index, true)} disabled={!sentence.audio_url} className="mt-0.5 rounded-full bg-sand p-2 text-lilacDeep disabled:opacity-40"><Volume2 size={17} /></button><div className="flex-1"><p className="text-lg leading-relaxed text-ink">{renderSentence(sentence)}</p>{showChinese && <p className="mt-2 text-sm leading-relaxed text-inkSoft">{sentence.sentence_zh_tw}</p>}</div></div>
            </motion.article>
          ))}
        </section>

        {article.questions.length > 0 && (
          <section className="rounded-3xl bg-white p-5 shadow-softer">
            <h2 className="font-extrabold text-ink">閱讀小測驗</h2><p className="mt-1 text-xs text-inkSoft">完成全部題目且答對至少 60%，才能領取今日閱讀獎勵。</p>
            <div className="mt-4 space-y-5">{article.questions.map((question) => { const options = questionOptions(question); const correct = correctIndex(question); return <div key={question.id}><p className="font-bold text-ink text-sm">{question.question_order}. {question.question_text}</p><div className="mt-2 grid gap-2">{options.map((option, index) => <button key={`${question.id}-${index}`} onClick={() => setAnswers((current) => ({ ...current, [question.id]: index }))} className={`rounded-2xl px-3 py-2 text-left text-sm ${answers[question.id] === index ? "bg-lilacLight text-lilacDeep ring-1 ring-lilacDeep" : "bg-sand text-ink"}`}>{option}</button>)}</div>{answers[question.id] !== undefined && <p className={`mt-2 text-xs ${answers[question.id] === correct ? "text-greenDark" : "text-peachDeep"}`}>{answers[question.id] === correct ? "答對了！" : question.explanation_zh_tw}</p>}</div>; })}</div>
            {quizDone && <p className="mt-4 text-sm font-bold text-lilacDeep">目前正確率：{questionScore}%</p>}
          </section>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-sand bg-cream/95 backdrop-blur p-4">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="flex items-center justify-center gap-3"><button onClick={() => void playFrom(Math.max(0, currentSentenceIndex - 1), true)} disabled={currentSentenceIndex === 0} className="rounded-full bg-sand p-3 disabled:opacity-40"><SkipBack size={22} /></button>{playing ? <button onClick={stopPlayback} className="rounded-full bg-lilacDeep p-4 text-white"><Square size={26} fill="currentColor" /></button> : <button onClick={() => void playFrom(currentSentenceIndex, false)} className="rounded-full bg-lilacDeep p-4 text-white"><Play size={28} fill="currentColor" /></button>}<button onClick={() => void playFrom(Math.min(article.sentences.length - 1, currentSentenceIndex + 1), true)} disabled={currentSentenceIndex >= article.sentences.length - 1} className="rounded-full bg-sand p-3 disabled:opacity-40"><SkipForward size={22} /></button></div>
          <div className="flex items-center justify-between gap-2"><div className="flex gap-2"><button onClick={() => setShowChinese((value) => !value)} className={`rounded-full px-3 py-1 text-xs font-bold ${showChinese ? "bg-lilacLight text-lilacDeep" : "bg-sand text-inkSoft"}`}>繁中</button><button onClick={() => setAutoScroll((value) => !value)} className={`rounded-full px-3 py-1 text-xs font-bold ${autoScroll ? "bg-lilacLight text-lilacDeep" : "bg-sand text-inkSoft"}`}>自動捲動</button></div><select value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))} className="rounded-full bg-sand px-3 py-1 text-xs text-ink"><option value={0.75}>0.75x</option><option value={0.9}>0.9x</option><option value={1}>1.0x</option><option value={1.15}>1.15x</option><option value={1.25}>1.25x</option></select></div>
          <button onClick={() => void completeReading()} disabled={!canComplete} className="w-full rounded-full bg-peachLight py-2 text-sm font-extrabold text-peachDeep disabled:cursor-not-allowed disabled:opacity-45">{completed ? "今日閱讀已完成" : canComplete ? "完成閱讀並領取獎勵" : "讀完全文並完成測驗後領獎勵"}</button>
        </div>
      </footer>

      {selectedWord && <WordSheet word={selectedWord.word} sentence={selectedWord.sentence} language={selectedLanguage} onClose={() => setSelectedWord(null)} />}
    </div>
  );
}
