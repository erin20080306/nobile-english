"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { ArrowLeft, Check, Puzzle, RotateCcw, Volume2, X } from "lucide-react";
import type { LearningLanguageCode, User } from "@/types";
import { authService } from "@/services/authService";
import { learningService } from "@/services/learningService";
import { speechService } from "@/services/speechService";
import { soundService } from "@/services/soundService";
import {
  grammarPracticeService,
  type GrammarExercise,
  type GrammarQuestionResult,
  type GrammarScore,
  type GrammarSession,
} from "@/services/grammarPracticeService";
import { getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import { rewardImageForScore } from "@/data/rewardImages";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import CheerImage from "@/components/CheerImage";
import ScoreRing from "@/components/ScoreRing";

const countOptions = [10, 20, 30];
const reviewOptions = [0, 25, 50, 75, 100];

interface BankTile {
  uid: string;
  text: string;
  status: "idle" | "correct" | "wrong";
}

function pointFromEvent(event: MouseEvent | TouchEvent | PointerEvent): { x: number; y: number } | null {
  if ("clientX" in event) return { x: event.clientX, y: event.clientY };
  const touch = (event as TouchEvent).changedTouches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  return null;
}

export default function GrammarPracticePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [language, setLanguage] = useState<LearningLanguageCode>("en");
  const [count, setCount] = useState(10);
  const [reviewWrongPercent, setReviewWrongPercent] = useState(50);
  const [starting, setStarting] = useState(false);
  const [poolStatus, setPoolStatus] = useState("");

  const [session, setSession] = useState<GrammarSession | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [bank, setBank] = useState<BankTile[]>([]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [mistakesThisQuestion, setMistakesThisQuestion] = useState(0);
  const [results, setResults] = useState<GrammarQuestionResult[]>([]);
  const [complete, setComplete] = useState(false);
  const [score, setScore] = useState<GrammarScore | null>(null);
  const [rewardImage, setRewardImage] = useState("");

  const answerZoneRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<GrammarQuestionResult[]>([]);
  const recordedQuestionKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    const settings = learningService.getSettings(currentUser?.id || "");
    const last = grammarPracticeService.getLastOptions();
    setUser(currentUser);
    setLanguage(last?.language || settings.targetLanguage || "en");
    setCount(last?.count || 10);
    setReviewWrongPercent(typeof last?.reviewWrongPercent === "number" ? last.reviewWrongPercent : 50);
  }, []);

  const level = user?.level || "Beginner";
  const languageInfo = getLearningLanguage(language);
  const question = session?.questions[questionIndex];
  const exercise = question?.exercise;
  const totalQuestions = session?.questions.length || 0;
  const progress = totalQuestions ? Math.round((questionIndex / totalQuestions) * 100) : 0;

  const targetSentence = useMemo(() => (exercise ? grammarPracticeService.sentenceText(exercise, language) : ""), [exercise, language]);
  const answerIsCorrect = useMemo(
    () => (exercise ? grammarPracticeService.isCorrectArrangement(placed, exercise, language) : false),
    [exercise, language, placed]
  );

  function startQuestion(nextIndex: number, activeSession: GrammarSession) {
    const nextQuestion = activeSession.questions[nextIndex];
    if (!nextQuestion) return;
    setBank(nextQuestion.bank.map((text, i) => ({ uid: `${nextIndex}-${i}-${text}`, text, status: "idle" as const })));
    setPlaced([]);
    setMistakesThisQuestion(0);
  }

  async function startPractice() {
    if (starting) return;
    speechService.unlockAudio();
    setStarting(true);
    setPoolStatus("正在準備句子...");
    try {
      const result = await grammarPracticeService.buildSession({ language, level, count, reviewWrongPercent });
      if (!result.session.questions.length) {
        setPoolStatus("目前找不到可用的句子，請稍後再試。");
        return;
      }
      setSession(result.session);
      setQuestionIndex(0);
      setResults([]);
      resultsRef.current = [];
      recordedQuestionKeysRef.current = new Set();
      setComplete(false);
      setScore(null);
      startQuestion(0, result.session);
      setPoolStatus(
        result.source === "database"
          ? "已從資料庫例句題庫出題"
          : result.source === "generated"
            ? "已產生新題目並加入題庫快取"
            : ""
      );
    } catch {
      setPoolStatus("讀取題庫失敗，請檢查網路後再試一次。");
    } finally {
      setStarting(false);
    }
  }

  function speakSentence() {
    if (!exercise) return;
    const text = targetSentence.trim();
    if (!text) return;
    speechService.speak(text, voiceForLanguage(language, learningService.getSpeechRate(language)));
  }

  function finishQuestion(mistakes: number, finalTokens: string[]) {
    if (!session || !exercise) return;
    if (!grammarPracticeService.isCorrectArrangement(finalTokens, exercise, language)) return;
    const recordKey = `${questionIndex}:${exercise.id}`;
    if (!recordedQuestionKeysRef.current.has(recordKey)) {
      recordedQuestionKeysRef.current.add(recordKey);
      grammarPracticeService.recordCompletion(language, exercise, mistakes);
      const nextResults = [...resultsRef.current, { exerciseId: exercise.id, mistakes }];
      resultsRef.current = nextResults;
      setResults(nextResults);
    }
    speakSentence();
  }

  function advanceQuestion() {
    if (!session || !exercise || !answerIsCorrect) return;
    const nextResults = resultsRef.current.length ? resultsRef.current : results;
    const nextIndex = questionIndex + 1;
    if (nextIndex >= totalQuestions) {
      const finalScore = grammarPracticeService.completeSession(session, nextResults);
      setScore(finalScore);
      setRewardImage(rewardImageForScore(finalScore.score));
      setComplete(true);
      window.setTimeout(() => soundService.playForScore(finalScore.score), 250);
      return;
    }
    setQuestionIndex(nextIndex);
    startQuestion(nextIndex, session);
  }

  function handleDrop(tile: BankTile, event: MouseEvent | TouchEvent | PointerEvent) {
    if (!exercise || tile.status !== "idle") return;
    const zone = answerZoneRef.current;
    const point = pointFromEvent(event);
    if (!zone || !point) return;
    const rect = zone.getBoundingClientRect();
    const padding = 12;
    const insideZone =
      point.x >= rect.left - padding &&
      point.x <= rect.right + padding &&
      point.y >= rect.top - padding &&
      point.y <= rect.bottom + padding;
    if (!insideZone) return;

    const expectedToken = exercise.tokens[placed.length];
    const isCorrect = tile.text === expectedToken;

    if (isCorrect) {
      setBank((prev) => prev.map((item) => (item.uid === tile.uid ? { ...item, status: "correct" } : item)));
      const nextPlaced = [...placed, tile.text];
      setPlaced(nextPlaced);
      window.setTimeout(() => {
        setBank((prev) => prev.filter((item) => item.uid !== tile.uid));
      }, 320);
      if (grammarPracticeService.isCorrectArrangement(nextPlaced, exercise, language)) {
        finishQuestion(mistakesThisQuestion, nextPlaced);
      }
    } else {
      grammarPracticeService.recordMistake(language, exercise);
      setMistakesThisQuestion((value) => value + 1);
      setBank((prev) => prev.map((item) => (item.uid === tile.uid ? { ...item, status: "wrong" } : item)));
      window.setTimeout(() => {
        setBank((prev) => prev.map((item) => (item.uid === tile.uid ? { ...item, status: "idle" } : item)));
      }, 550);
    }
  }

  function exitSession() {
    setSession(null);
    setComplete(false);
    setScore(null);
  }

  if (complete && score) {
    return (
      <div className="min-h-[100dvh] pb-4">
        <AppHeader title="文法練習完成" subtitle="這次結果已寫入學習紀錄" back={false} />
        <div className="px-5 space-y-4">
          <div className="rounded-[32px] bg-gradient-to-br from-mint via-white to-lilac p-5 shadow-soft">
            <div className="flex justify-center mb-2">
              <CheerImage size={140} src={rewardImage} alt="評分結果" />
            </div>
            <div className="flex justify-center">
              <ScoreRing value={score.score} label="準確率" />
            </div>
            <p className="mt-3 text-center font-bold text-ink">完美排出 {score.correct} / {score.total} 句</p>
            <p className="text-center text-sm text-inkSoft">共 {score.totalMistakes} 次拖曳錯誤</p>
          </div>
          <button onClick={() => { void startPractice(); }} disabled={starting} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
            <RotateCcw size={18} /> 再練習一輪
          </button>
          <button onClick={() => router.push("/dashboard")} className="w-full rounded-3xl bg-white py-3 font-bold text-ink shadow-softer">
            回首頁
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (session && exercise) {
    return (
      <div className="min-h-[100dvh] pb-4">
        <div className="px-5 pt-8 flex items-center gap-3">
          <button onClick={exitSession} className="h-11 w-11 rounded-2xl bg-white shadow-softer text-inkSoft flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-inkSoft">文法練習</p>
            <h1 className="text-2xl font-black text-ink">{languageInfo.flag} {languageInfo.zhName}</h1>
          </div>
          <span className="chip bg-lilac text-lilacDeep">{questionIndex + 1}/{totalQuestions}</span>
        </div>
        <div className="px-5 mt-4">
          <div className="h-2 rounded-full bg-white shadow-inner overflow-hidden">
            <div className="h-full bg-lilacDeep transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="px-5 mt-5 space-y-4">
          <div className="rounded-[34px] bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="chip bg-peach text-peachDeep text-xs">拖曳排出正確句子</span>
                <p className="mt-3 text-xs font-bold text-inkSoft">中文意思</p>
                <p className="mt-1 text-xl font-black text-ink break-words">{exercise.textZh}</p>
              </div>
              {answerIsCorrect && (
                <button onClick={speakSentence} className="h-12 w-12 shrink-0 rounded-2xl bg-lilacDeep text-white flex items-center justify-center shadow-softer" aria-label="播放正確句子">
                  <Volume2 size={22} />
                </button>
              )}
            </div>
            {answerIsCorrect && (
              <div className="mt-4 rounded-3xl bg-mint/40 px-4 py-3">
                <p className="text-xs font-bold text-mintDeep">正確句子</p>
                <p className="mt-1 text-base font-black text-ink break-words">{targetSentence}</p>
              </div>
            )}

            <div
              ref={answerZoneRef}
              className={`mt-4 min-h-[72px] rounded-3xl border-2 border-dashed p-3 flex flex-wrap items-center gap-2 transition-colors ${
                answerIsCorrect ? "border-mintDeep bg-mint/40" : "border-lilac bg-cream/60"
              }`}
            >
              {placed.map((text, i) => (
                <motion.span
                  key={`${text}-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="chip bg-mint text-mintDeep font-bold"
                >
                  {text}
                </motion.span>
              ))}
              {!placed.length && <span className="text-sm font-semibold text-inkSoft">拖曳下方單字到這裡排出句子…</span>}
              {answerIsCorrect && (
                <span className="chip bg-mintDeep text-white flex items-center gap-1 text-xs">
                  <Check size={14} /> 正確！聽完後可前往下一題
                </span>
              )}
            </div>
            {answerIsCorrect && (
              <button onClick={advanceQuestion} className="mt-4 btn-primary w-full">
                {questionIndex + 1 >= totalQuestions ? "完成練習" : "下一題"}
              </button>
            )}
          </div>

          <div className="rounded-[30px] bg-white/80 p-4 shadow-softer">
            <p className="text-xs font-bold text-inkSoft mb-3">單字庫（含混淆詞）</p>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {bank.map((tile) => (
                  <motion.div
                    key={tile.uid}
                    drag={tile.status === "idle" && !answerIsCorrect}
                    dragSnapToOrigin
                    dragElastic={0.15}
                    dragMomentum={false}
                    onDragEnd={(event, _info: PanInfo) => handleDrop(tile, event as MouseEvent | TouchEvent | PointerEvent)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    whileDrag={{ scale: 1.08, zIndex: 20, boxShadow: "0 12px 24px rgba(0,0,0,0.18)" }}
                    className={`relative select-none touch-none rounded-2xl px-4 py-2 font-bold shadow-softer cursor-grab active:cursor-grabbing ${
                      tile.status === "correct"
                        ? "bg-mintDeep text-white"
                        : tile.status === "wrong"
                          ? "bg-peach text-peachDeep"
                          : "bg-white text-ink"
                    }`}
                  >
                    {tile.text}
                    {tile.status === "wrong" && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-peachDeep text-white">
                        <X size={12} />
                      </span>
                    )}
                    {tile.status === "correct" && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-mint text-mintDeep">
                        <Check size={12} />
                      </span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader title="文法練習" subtitle="拖曳單字排出正確句子，答錯會標記提醒" back={false} />
      <div className="px-5 space-y-4">
        <div className="rounded-[32px] bg-gradient-to-br from-lilac via-white to-mint p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-2xl bg-white text-lilacDeep shadow-softer flex items-center justify-center">
              <Puzzle size={24} />
            </span>
            <div>
              <p className="text-xs font-bold text-inkSoft">目前程度</p>
              <p className="text-xl font-black text-ink">{level}</p>
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold text-inkSoft">
            句子來自資料庫例句與情境對話，並加入額外混淆詞。拖曳單字排出正確句子，完成後自動播放語音並進入下一題。
          </p>
        </div>

        <div className="card !p-4">
          <p className="text-xs font-bold text-inkSoft">練習語言</p>
          <select value={language} onChange={(event) => setLanguage(event.target.value as LearningLanguageCode)} className="mt-2 w-full rounded-3xl bg-cream px-4 py-3 font-bold text-ink outline-none">
            {(["en", "ja", "ko", "it", "es"] as LearningLanguageCode[]).map((code) => {
              const info = getLearningLanguage(code);
              return <option key={code} value={code}>{info.flag} {info.zhName}</option>;
            })}
          </select>
        </div>

        <div className="card !p-4">
          <p className="text-xs font-bold text-inkSoft">題目數量</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {countOptions.map((value) => (
              <button key={value} onClick={() => setCount(value)} className={`rounded-3xl py-3 font-black ${count === value ? "bg-lilacDeep text-white" : "bg-cream text-ink"}`}>
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="card !p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-inkSoft">複習答錯句子比例</p>
              <p className="text-2xl font-black text-ink">{reviewWrongPercent}%</p>
            </div>
            <span className="chip bg-mint text-mintDeep">自動穿插錯題</span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {reviewOptions.map((value) => (
              <button key={value} onClick={() => setReviewWrongPercent(value)} className={`rounded-2xl py-2 text-sm font-black ${reviewWrongPercent === value ? "bg-mintDeep text-white" : "bg-cream text-ink"}`}>
                {value}%
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => { void startPractice(); }} disabled={starting} className="btn-primary w-full disabled:opacity-60">
          {starting ? "準備題目中..." : "開始文法練習"}
        </button>
        {poolStatus && <p className="text-center text-xs font-bold text-inkSoft">{poolStatus}</p>}
      </div>
      <BottomNav />
    </div>
  );
}
