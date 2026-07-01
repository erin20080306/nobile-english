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
import { trialAccessService, type AccessState } from "@/services/trialAccessService";
import { trialUsageService, TRIAL_WORD_REVIEW_DAILY_LIMIT } from "@/services/trialUsageService";
import { getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import SubscriptionLaunchPrompt from "@/components/SubscriptionLaunchPrompt";

const countOptions = [5, 10, 15, 20, 25, 30];
const learnedOptions = [0, 25, 50, 75, 100];

type AnswerSoundKey = "correct" | "wrong";
type AnswerTone = { frequency: number; duration: number; decayRate?: number; accent?: number };

let answerAudioContext: AudioContext | null = null;
const answerSoundUrls: Partial<Record<AnswerSoundKey, string>> = {};
const answerAudioElements: Partial<Record<AnswerSoundKey, HTMLAudioElement>> = {};

function answerSoundKey(correct: boolean): AnswerSoundKey {
  return correct ? "correct" : "wrong";
}

function getAnswerAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!answerAudioContext || answerAudioContext.state === "closed") {
    answerAudioContext = new AudioContextClass();
  }
  return answerAudioContext;
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function answerTonePlan(correct: boolean): AnswerTone[] {
  return correct
    ? [
        // "登登登登" idol-entrance fanfare: four punchy same-pitch stabs
        // (fast attack, fast decay) building anticipation, then a quick
        // ascending flourish into a bright sustained victory ring.
        { frequency: 587.33, duration: 0.1, decayRate: 15 }, // D5 登
        { frequency: 587.33, duration: 0.1, decayRate: 15 }, // D5 登
        { frequency: 587.33, duration: 0.1, decayRate: 15 }, // D5 登
        { frequency: 587.33, duration: 0.16, decayRate: 11, accent: 1.1 }, // D5 登 (anchor)
        { frequency: 1046.5, duration: 0.08, decayRate: 9 }, // C6 climb
        { frequency: 1318.5, duration: 0.08, decayRate: 9 }, // E6
        { frequency: 1568.0, duration: 0.08, decayRate: 9 }, // G6
        { frequency: 2093.0, duration: 0.46, decayRate: 3.2, accent: 1.15 }, // C7 big reveal ring
      ]
    : [
        { frequency: 349.23, duration: 0.16 },
        { frequency: 261.63, duration: 0.16 },
        { frequency: 196, duration: 0.3 },
      ];
}

function toneStateAt(tones: AnswerTone[], time: number) {
  let elapsed = 0;
  for (const tone of tones) {
    const noteStart = elapsed;
    elapsed += tone.duration;
    if (time <= elapsed) {
      return {
        frequency: tone.frequency,
        noteElapsed: time - noteStart,
        noteDuration: tone.duration,
        decayRate: tone.decayRate,
        accent: tone.accent ?? 1,
      };
    }
  }
  const last = tones[tones.length - 1];
  return {
    frequency: last?.frequency || 440,
    noteElapsed: last?.duration || 0,
    noteDuration: last?.duration || 1,
    decayRate: last?.decayRate,
    accent: last?.accent ?? 1,
  };
}

function makeAnswerSoundUrl(correct: boolean) {
  if (typeof window === "undefined") return "";
  const key = answerSoundKey(correct);
  if (answerSoundUrls[key]) return answerSoundUrls[key] || "";

  const tones = answerTonePlan(correct);
  const sampleRate = 16000;
  const duration = tones.reduce((sum, tone) => sum + tone.duration, 0);
  const sampleCount = Math.floor(sampleRate * duration);
  const dataBytes = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const { frequency, noteElapsed, noteDuration, decayRate, accent } = toneStateAt(tones, time);
    // Fast attack + exponential decay per note gives each ding its own bell/coin
    // percussive shape, instead of one glissando envelope across the whole clip.
    const attack = Math.min(1, noteElapsed / 0.006);
    const decay = Math.exp(-noteElapsed * (decayRate ?? (correct ? 6 : 5.5)));
    // Ease the very end of the last note so it doesn't cut off abruptly.
    const tailFade = Math.min(1, (noteDuration - noteElapsed) / 0.03 + 0.4);
    const envelope = attack * decay * Math.min(1, tailFade);
    const harmonic = correct ? 0.3 : 0.18;
    const shimmer = correct ? 1 + 0.12 * Math.sin(2 * Math.PI * 18 * time) : 1;
    const wave = Math.sin(2 * Math.PI * frequency * time) + harmonic * Math.sin(2 * Math.PI * frequency * 2 * time);
    const sample = wave * (correct ? 0.32 : 0.24) * envelope * shimmer * accent;
    view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  const url = `data:audio/wav;base64,${window.btoa(binary)}`;
  answerSoundUrls[key] = url;
  return url;
}

function getAnswerAudioElement(correct: boolean) {
  if (typeof window === "undefined") return null;
  try {
    const key = answerSoundKey(correct);
    if (answerAudioElements[key]) return answerAudioElements[key] || null;

    const audio = new Audio(makeAnswerSoundUrl(correct));
    audio.preload = "auto";
    audio.volume = 1;
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    answerAudioElements[key] = audio;
    return audio;
  } catch {
    return null;
  }
}

async function unlockAnswerAudio() {
  let unlocked = false;

  try {
    const correctAudio = getAnswerAudioElement(true);
    const wrongAudio = getAnswerAudioElement(false);
    correctAudio?.load();
    wrongAudio?.load();
    unlocked = Boolean(correctAudio || wrongAudio);
  } catch {
    // Media preload is a best-effort mobile unlock path.
  }

  try {
    const context = getAnswerAudioContext();
    if (!context) return unlocked;
    if (context.state === "suspended") await context.resume();

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = context.createBuffer(1, 1, context.sampleRate);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
    source.stop(context.currentTime + 0.01);
    return true;
  } catch {
    return unlocked;
  }
}

async function playMediaAnswerSound(correct: boolean) {
  const audio = getAnswerAudioElement(correct);
  if (!audio) return false;

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

async function playWebAudioAnswerSound(correct: boolean) {
  try {
    const context = getAnswerAudioContext();
    if (!context) return false;
    if (context.state === "suspended") await context.resume();

    const tones = answerTonePlan(correct);
    const start = context.currentTime + 0.015;
    const basePeak = correct ? 0.3 : 0.26;

    let offset = 0;
    for (const tone of tones) {
      const noteStart = start + offset;
      const peak = basePeak * (tone.accent ?? 1);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(peak, noteStart + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + tone.duration);
      gain.connect(context.destination);

      const oscillator = context.createOscillator();
      oscillator.type = correct ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(tone.frequency, noteStart);
      oscillator.connect(gain);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(noteStart);
      oscillator.stop(noteStart + tone.duration + 0.02);
      offset += tone.duration;
    }
    return true;
  } catch {
    return false;
  }
}

async function playAnswerSound(correct: boolean) {
  const mediaPlayed = await playMediaAnswerSound(correct);
  if (mediaPlayed) return;
  await playWebAudioAnswerSound(correct);
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
  const [typedAnswer, setTypedAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [readyToFinish, setReadyToFinish] = useState(false);
  const [score, setScore] = useState<WordReviewScore | null>(null);
  const [starting, setStarting] = useState(false);
  const [poolStatus, setPoolStatus] = useState("");
  const [access, setAccess] = useState<AccessState | null>(null);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    const settings = learningService.getSettings(currentUser?.id || "");
    const last = wordReviewService.getLastOptions();
    setUser(currentUser);
    setLanguage(last?.language || settings.targetLanguage || "en");
    setCount(last?.count || 10);
    setLearnedPercent(typeof last?.learnedPercent === "number" ? last.learnedPercent : 50);
    trialAccessService.getAccessState(currentUser, { fresh: true }).then(setAccess).catch(() => setAccess(null));
  }, []);

  const level = user?.level || "Beginner";
  const languageInfo = getLearningLanguage(language);
  const current = session?.words[index];
  const currentAnswer = session && current ? session.answers.find((answer) => answer.word === current.word.word) : undefined;
  const questionKind = current?.questionKind || "meaningChoice";
  const isWordChoice = questionKind === "wordChoice";
  const isFillQuestion = questionKind === "wordFill";
  const questionPrompt = current ? wordReviewService.questionPromptFor(current.word, questionKind) : "";
  const questionHint = current ? wordReviewService.questionHintFor(current.word, questionKind) : "";
  const choicePool = useMemo(() => session?.words.map((item) => item.word) || [], [session]);
  const choices = useMemo(
    () => current ? wordReviewService.choicesFor(current.word, session?.language || language, current.questionKind, choicePool) : [],
    [choicePool, current, language, session?.language]
  );
  const progress = session ? Math.round(((index + (revealed ? 1 : 0)) / Math.max(session.words.length, 1)) * 100) : 0;

  async function startReview() {
    if (starting) return;
    if (trialUsageService.isLimited(access) && !trialUsageService.useDaily("wordReview", TRIAL_WORD_REVIEW_DAILY_LIMIT)) {
      setShowSubscriptionPrompt(true);
      return;
    }
    void unlockAnswerAudio();
    setStarting(true);
    setPoolStatus("正在讀取單字資料庫...");
    try {
      const result = await wordReviewService.buildDatabaseSession({ language, level, count, learnedPercent });
      setSession(result.session);
      setIndex(0);
      setSelected("");
      setTypedAnswer("");
      setRevealed(false);
      setReadyToFinish(false);
      setScore(null);
      setPoolStatus(
        result.source === "database"
          ? `已讀取資料庫單字 ${result.poolSize} 筆${result.targetCount ? ` / 目標 ${result.targetCount.toLocaleString()} 筆` : ""}`
          : `使用本機備援單字${result.reason ? `：${result.reason}` : ""}`
      );
    } finally {
      setStarting(false);
    }
  }

  function answer(rawAnswer: string) {
    if (!session || !current || revealed) return;
    const option = rawAnswer.trim();
    if (!option) return;
    const kind = current.questionKind;
    const correctText = wordReviewService.correctChoiceFor(current.word, kind);
    const correct = wordReviewService.isCorrectAnswer(option, current.word, kind);
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
    setTypedAnswer("");
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
          <button onClick={() => { void startReview(); }} disabled={starting} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
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
                    {isFillQuestion ? "看意思填單字" : isWordChoice ? "看意思選單字" : "看單字選意思"}
                  </span>
                </div>
                {isWordChoice || isFillQuestion ? (
                  <>
                    <h2 className={`${isFillQuestion ? "text-3xl" : "text-4xl"} mt-4 font-black text-ink break-words`}>{questionPrompt}</h2>
                    <p className="mt-1 text-inkSoft">{questionHint}</p>
                  </>
                ) : (
                  <>
                    <h2 className="mt-4 text-4xl font-black text-ink break-words">{current.word.word}</h2>
                    <p className="mt-1 text-inkSoft">{current.word.phonetic} · {current.word.pos}</p>
                  </>
                )}
              </div>
              <div className="h-12 w-12 shrink-0">
                {(!(isWordChoice || isFillQuestion) || revealed) && (
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
                    <p>{isFillQuestion ? "你填" : "你選"}：{currentAnswer.selectedText}</p>
                    <p>正確答案：{currentAnswer.correctText}</p>
                  </div>
                )}
              </div>
            )}
            {revealed && (
              <div className="mt-4 rounded-3xl bg-cream p-3">
                {(isWordChoice || isFillQuestion) && (
                  <div className="mb-3">
                    <p className="text-xs font-bold text-inkSoft">答案</p>
                    <p className="text-2xl font-black text-ink">{current.word.word}</p>
                    <p className="text-sm text-inkSoft">{current.word.phonetic} · {current.word.pos}</p>
                  </div>
                )}
                <p className="text-xs font-bold text-inkSoft">例句</p>
                <p className="font-semibold text-ink">
                  {(isWordChoice || isFillQuestion) ? wordReviewService.questionPromptFor(current.word, "wordFill") : current.word.example}
                </p>
                {current.word.exampleZh && <p className="text-sm text-inkSoft">{current.word.exampleZh}</p>}
              </div>
            )}
          </motion.div>

          {isFillQuestion ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                answer(typedAnswer);
              }}
            >
              <input
                value={typedAnswer}
                disabled={revealed}
                onChange={(event) => setTypedAnswer(event.target.value)}
                placeholder={`輸入${languageInfo.zhName}單字`}
                autoCapitalize="none"
                autoCorrect="off"
                className={`rounded-3xl bg-white p-4 text-lg font-bold text-ink shadow-softer outline-none ${revealed ? "opacity-70" : ""}`}
              />
              {!revealed && (
                <button onPointerDown={() => { void unlockAnswerAudio(); }} disabled={!typedAnswer.trim()} className="btn-primary w-full disabled:opacity-50">
                  送出答案
                </button>
              )}
            </form>
          ) : (
            <div className="grid gap-3">
              {choices.map((choice, choiceIndex) => {
                const active = selected === choice;
                const correct = wordReviewService.isCorrectAnswer(choice, current.word, questionKind);
                return (
                  <button
                    key={`${choice}-${choiceIndex}`}
                    disabled={revealed}
                    onPointerDown={() => { void unlockAnswerAudio(); }}
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
          )}

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

        <button onPointerDown={() => { void unlockAnswerAudio(); }} onClick={() => { void startReview(); }} disabled={starting} className="btn-primary w-full disabled:opacity-60">
          {starting ? "讀取資料庫中..." : "開始單字複習"}
        </button>
        {poolStatus && <p className="text-center text-xs font-bold text-inkSoft">{poolStatus}</p>}
      </div>
      <BottomNav />
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
