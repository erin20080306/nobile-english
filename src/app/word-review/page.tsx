"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, Database, RotateCcw, Volume2 } from "lucide-react";
import type { LearningLanguageCode, User } from "@/types";
import { authService } from "@/services/authService";
import { learningService } from "@/services/learningService";
import { speechService } from "@/services/speechService";
import { wordReviewService, type WordReviewScore, type WordReviewSession } from "@/services/wordReviewService";
import { getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

const countOptions = [5, 10, 15, 20, 25, 30];
const learnedOptions = [0, 25, 50, 75, 100];

async function playAnswerSound(correct: boolean) {
  if (typeof window === "undefined") return;
  try {
    const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    if (context.state === "suspended") await context.resume();

    const start = context.currentTime + 0.01;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(correct ? 0.18 : 0.16, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (correct ? 0.34 : 0.26));
    gain.connect(context.destination);

    const playTone = (frequency: number, offset: number, duration: number) => {
      const oscillator = context.createOscillator();
      oscillator.type = correct ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      oscillator.connect(gain);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + duration);
    };

    if (correct) {
      playTone(660, 0, 0.11);
      playTone(880, 0.11, 0.16);
    } else {
      playTone(260, 0, 0.1);
      playTone(170, 0.1, 0.14);
    }

    window.setTimeout(() => { void context.close(); }, correct ? 480 : 380);
  } catch {
    // Sound is optional; answering should never fail because audio is blocked.
  }
}

export default function WordReviewPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [language, setLanguage] = useState<LearningLanguageCode>("en");
  const [count, setCount] = useState(10);
  const [learnedPercent, setLearnedPercent] = useState(50);
  const [session, setSession] = useState<WordReviewSession | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [readyToFinish, setReadyToFinish] = useState(false);
  const [score, setScore] = useState<WordReviewScore | null>(null);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    const settings = learningService.getSettings(currentUser?.id || "");
    const last = wordReviewService.getLastOptions();
    setUser(currentUser);
    setLanguage(last?.language || settings.targetLanguage || "en");
    setCount(last?.count || 10);
    setLearnedPercent(typeof last?.learnedPercent === "number" ? last.learnedPercent : 50);
  }, []);

  const level = user?.level || "Beginner";
  const languageInfo = getLearningLanguage(language);
  const current = session?.words[index];
  const currentAnswer = session && current ? session.answers.find((answer) => answer.word === current.word.word) : undefined;
  const questionKind = current?.questionKind || "meaningChoice";
  const isWordChoice = questionKind === "wordChoice";
  const choices = useMemo(
    () => current ? wordReviewService.choicesFor(current.word, session?.language || language, current.questionKind) : [],
    [current, language, session?.language]
  );
  const progress = session ? Math.round(((index + (revealed ? 1 : 0)) / Math.max(session.words.length, 1)) * 100) : 0;

  function startReview() {
    const next = wordReviewService.buildSession({ language, level, count, learnedPercent });
    setSession(next);
    setIndex(0);
    setSelected("");
    setRevealed(false);
    setReadyToFinish(false);
    setScore(null);
  }

  function answer(option: string) {
    if (!session || !current || revealed) return;
    const kind = current.questionKind;
    const correctText = wordReviewService.correctChoiceFor(current.word, kind);
    const correct = option === correctText;
    void playAnswerSound(correct);
    const answer = {
      word: current.word.word,
      correct,
      selectedText: option,
      correctText,
      questionKind: kind,
      selectedZh: kind === "meaningChoice" ? option : current.word.zh,
      correctZh: current.word.zh,
      answeredAt: new Date().toISOString(),
    };
    setSelected(option);
    setRevealed(true);
    setSession({ ...session, answers: [...session.answers, answer] });
  }

  function nextCard() {
    if (!session) return;
    if (index >= session.words.length - 1) {
      setReadyToFinish(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected("");
    setRevealed(false);
  }

  function finishReview() {
    if (!session) return;
    const result = wordReviewService.completeSession(session);
    setScore(result);
    setReadyToFinish(false);
  }

  function speakCurrent() {
    if (!current) return;
    speechService.speak(current.word.word, voiceForLanguage(session?.language || language, learningService.getSpeechRate(session?.language || language)));
  }

  if (score) {
    return (
      <div className="min-h-[100dvh] pb-4">
        <AppHeader title="單字練習完成" subtitle="這次結果已寫入學習紀錄" back={false} />
        <div className="px-5 space-y-4">
          <div className="rounded-[32px] bg-gradient-to-br from-mint via-white to-lilac p-5 shadow-soft">
            <p className="text-sm font-bold text-inkSoft">本次評分</p>
            <p className="mt-1 text-5xl font-black text-ink">{score.score}</p>
            <p className="mt-2 font-bold text-ink">答對 {score.correct} / {score.total} 題</p>
            <p className="text-sm text-inkSoft">下次會自動穿插到期與答錯單字。</p>
          </div>
          <div className="card !p-4">
            <p className="text-xs font-bold text-inkSoft">複習單字</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {score.wordsReviewed.map((word) => (
                <span key={word} className="chip bg-lilac text-lilacDeep text-xs">{word}</span>
              ))}
            </div>
          </div>
          <button onClick={startReview} className="btn-primary w-full flex items-center justify-center gap-2">
            <RotateCcw size={18} /> 再複習一輪
          </button>
          <button onClick={() => router.push("/records?tab=word")} className="w-full rounded-3xl bg-white py-3 font-bold text-ink shadow-softer">
            查看單字練習紀錄
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (session && current) {
    return (
      <div className="min-h-[100dvh] pb-4">
        <div className="px-5 pt-8 flex items-center gap-3">
          <button onClick={() => setSession(null)} className="h-11 w-11 rounded-2xl bg-white shadow-softer text-inkSoft flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-inkSoft">資料庫單字複習</p>
            <h1 className="text-2xl font-black text-ink">{languageInfo.flag} {languageInfo.zhName}</h1>
          </div>
          <span className="chip bg-lilac text-lilacDeep">{index + 1}/{session.words.length}</span>
        </div>
        <div className="px-5 mt-4">
          <div className="h-2 rounded-full bg-white shadow-inner overflow-hidden">
            <div className="h-full bg-lilacDeep transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="px-5 mt-5 space-y-4">
          <motion.div key={`${current.word.word}-${questionKind}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[34px] bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className={`chip text-xs ${current.source === "learned" ? "bg-mint text-mintDeep" : "bg-sky text-skyDeep"}`}>
                    {current.source === "learned" ? "學過穿插" : "程度新字"}
                  </span>
                  <span className="chip bg-peach text-peachDeep text-xs">
                    {isWordChoice ? "看意思選單字" : "看單字選意思"}
                  </span>
                </div>
                {isWordChoice ? (
                  <>
                    <h2 className="mt-4 text-3xl font-black text-ink break-words">{current.word.zh}</h2>
                    <p className="mt-1 text-inkSoft">選出 {languageInfo.zhName} 單字</p>
                  </>
                ) : (
                  <>
                    <h2 className="mt-4 text-4xl font-black text-ink break-words">{current.word.word}</h2>
                    <p className="mt-1 text-inkSoft">{current.word.phonetic} · {current.word.pos}</p>
                  </>
                )}
              </div>
              <div className="h-12 w-12 shrink-0">
                {(!isWordChoice || revealed) && (
                  <button onClick={speakCurrent} className="h-12 w-12 rounded-2xl bg-lilacDeep text-white flex items-center justify-center shadow-softer">
                    <Volume2 size={22} />
                  </button>
                )}
              </div>
            </div>
            {revealed && currentAnswer && (
              <div className={`mt-4 rounded-3xl p-4 shadow-softer ${currentAnswer.correct ? "bg-mint text-mintDeep" : "bg-peach text-peachDeep"}`}>
                <p className="text-lg font-black">{currentAnswer.correct ? "正確" : "答錯了"}</p>
                {!currentAnswer.correct && (
                  <div className="mt-2 space-y-1 text-sm font-bold">
                    <p>你選：{currentAnswer.selectedText}</p>
                    <p>正確答案：{currentAnswer.correctText}</p>
                  </div>
                )}
              </div>
            )}
            {revealed && (
              <div className="mt-4 rounded-3xl bg-cream p-3">
                {isWordChoice && (
                  <div className="mb-3">
                    <p className="text-xs font-bold text-inkSoft">答案</p>
                    <p className="text-2xl font-black text-ink">{current.word.word}</p>
                    <p className="text-sm text-inkSoft">{current.word.phonetic} · {current.word.pos}</p>
                  </div>
                )}
                <p className="text-xs font-bold text-inkSoft">例句</p>
                <p className="font-semibold text-ink">{current.word.example}</p>
                {current.word.exampleZh && <p className="text-sm text-inkSoft">{current.word.exampleZh}</p>}
              </div>
            )}
          </motion.div>

          <div className="grid gap-3">
            {choices.map((choice, choiceIndex) => {
              const active = selected === choice;
              const correct = wordReviewService.isCorrectChoice(choice, current.word, questionKind);
              return (
                <button
                  key={`${choice}-${choiceIndex}`}
                  disabled={revealed}
                  onClick={() => answer(choice)}
                  className={`rounded-3xl p-4 text-left font-bold shadow-softer transition active:scale-[0.98] ${
                    revealed && correct
                      ? "bg-mint text-mintDeep"
                      : revealed && active
                        ? "bg-peach text-peachDeep"
                        : "bg-white text-ink"
                  }`}
                >
                  <span>{choice}</span>
                  {revealed && correct && <span className="ml-2 text-xs font-black">正確</span>}
                  {revealed && active && !correct && <span className="ml-2 text-xs font-black">答錯了</span>}
                </button>
              );
            })}
          </div>

          {revealed && !readyToFinish && (
            <button onClick={nextCard} className="btn-primary w-full">
              {index >= session.words.length - 1 ? "看完成按鈕" : "下一題"}
            </button>
          )}
          {readyToFinish && (
            <button onClick={finishReview} className="btn-primary w-full flex items-center justify-center gap-2">
              <CheckCircle size={18} /> 複習完成
            </button>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader title="資料庫單字複習" subtitle="依程度抽字，穿插學過與答錯單字" back={false} />
      <div className="px-5 space-y-4">
        <div className="rounded-[32px] bg-gradient-to-br from-lilac via-white to-mint p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-2xl bg-white text-lilacDeep shadow-softer flex items-center justify-center">
              <Database size={24} />
            </span>
            <div>
              <p className="text-xs font-bold text-inkSoft">目前程度</p>
              <p className="text-xl font-black text-ink">{level}</p>
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold text-inkSoft">
            會從 {languageInfo.zhName} 單字資料庫依你的程度抽題，並把學過、答錯、到期單字記住，下次自動穿插。
          </p>
        </div>

        <div className="card !p-4">
          <p className="text-xs font-bold text-inkSoft">複習語言</p>
          <select value={language} onChange={(event) => setLanguage(event.target.value as LearningLanguageCode)} className="mt-2 w-full rounded-3xl bg-cream px-4 py-3 font-bold text-ink outline-none">
            {(["en", "ja", "ko", "it", "es"] as LearningLanguageCode[]).map((code) => {
              const info = getLearningLanguage(code);
              return <option key={code} value={code}>{info.flag} {info.zhName}</option>;
            })}
          </select>
        </div>

        <div className="card !p-4">
          <p className="text-xs font-bold text-inkSoft">單字數量（最多 30）</p>
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
              <p className="text-xs font-bold text-inkSoft">學過單字比例</p>
              <p className="text-2xl font-black text-ink">{learnedPercent}%</p>
            </div>
            <span className="chip bg-mint text-mintDeep">下次會記住</span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {learnedOptions.map((value) => (
              <button key={value} onClick={() => setLearnedPercent(value)} className={`rounded-2xl py-2 text-sm font-black ${learnedPercent === value ? "bg-mintDeep text-white" : "bg-cream text-ink"}`}>
                {value}%
              </button>
            ))}
          </div>
        </div>

        <button onClick={startReview} className="btn-primary w-full">
          開始單字複習
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
