"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Volume2, Star, Mic, MicOff, VolumeX } from "lucide-react";
import type { Scene, TutorFeedback, DialogueResult } from "@/types";
import { aiTutorService } from "@/services/aiTutorService";
import { dictionaryService } from "@/services/dictionaryService";
import { speechService } from "@/services/speechService";
import ClickableText from "@/components/ClickableText";
import WordSheet from "@/components/WordSheet";
import { getSelectedTutor } from "@/components/TutorSelector";

interface Msg {
  role: "tutor" | "user";
  en: string;
  zh: string;
  feedback?: TutorFeedback;
}

const MIN_PRACTICE_TURNS = 5;
const MAX_PRACTICE_TURNS = 7;

const SCENE_PERSONAS: Record<string, string[]> = {
  cafe:       ["Mia", "Leo", "Sophie"],
  airport:    ["Jake", "Emma", "Ryan"],
  hotel:      ["Olivia", "Liam", "Ava"],
  shopping:   ["Noah", "Chloe", "Ethan"],
  interview:  ["Dr. Carter", "Ms. Lee", "Mr. Brown"],
  hospital:   ["Dr. Kim", "Nurse Lily", "Dr. Sam"],
  restaurant: ["Lucas", "Isabella", "Mason"],
  free:       ["Alex", "Jordan", "Taylor"],
  default:    ["Alex", "Jordan", "Taylor", "Morgan"],
};

function pickPersona(scene: Scene): string {
  if (scene.name.includes("問路") || scene.enName.toLowerCase().includes("direction")) {
    return "Morgan, a helpful local guide";
  }
  const themeId = scene.themeId;
  const list = SCENE_PERSONAS[themeId ?? "default"] ?? SCENE_PERSONAS.default;
  return list[Math.floor(Math.random() * list.length)];
}

export default function ConversationPractice({
  scene,
  showZh,
  pronunciationOn = true,
  finishLabel = "結束對話並看成果",
  onFinish,
}: {
  scene: Scene;
  showZh: boolean;
  pronunciationOn?: boolean;
  finishLabel?: string;
  onFinish: (result: DialogueResult, userTurns: string[], feedbacks: TutorFeedback[]) => void;
}) {
  const firstTutor =
    scene.dialogue.find((d) => d.speaker === "tutor") || { en: "Hi! Let's practice together.", zh: "嗨！我們一起練習吧。" };

  const [msgs, setMsgs] = useState<Msg[]>([{ role: "tutor", en: firstTutor.en, zh: firstTutor.zh }]);
  const [input, setInput] = useState("");
  const [turn, setTurn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(pronunciationOn);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [persona] = useState(() => pickPersona(scene));
  const [selectedTutor] = useState(() => getSelectedTutor());
  const tutorName = selectedTutor.name;

  const endRef = useRef<HTMLDivElement>(null);
  const stopListenRef = useRef<(() => void) | null>(null);
  const historyRef = useRef<string[]>([]);
  const userTurnsRef = useRef<string[]>([]);
  const feedbacksRef = useRef<TutorFeedback[]>([]);
  const finishedRef = useRef(false);
  const speechOptions = {
    lang: selectedTutor.lang,
    voiceKeywords: selectedTutor.voiceKeywords,
    ttsVoice: selectedTutor.ttsVoice,
    ttsInstructions: selectedTutor.ttsInstructions,
    volumeGain: selectedTutor.ttsVolumeGain,
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // Speak the opening tutor line once.
  useEffect(() => {
    let openingTimer: number | undefined;
    if (autoSpeak) {
      speechService.warmUp(speechOptions);
      openingTimer = window.setTimeout(() => speechService.speak(firstTutor.en, speechOptions), 650);
    }
    return () => {
      if (openingTimer) window.clearTimeout(openingTimer);
      speechService.stop();
      stopListenRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flashToast(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 2500);
  }

  function speak(text: string) {
    const r = speechService.speak(text, speechOptions);
    if (!r.ok) flashToast(r.message || "無法播放發音");
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || finishedRef.current) return;
    setBusy(true);
    setInput("");

    setMsgs((m) => [...m, { role: "user", en: trimmed, zh: "" }]);
    if (autoSpeak) {
      window.setTimeout(() => {
        speechService.speak(trimmed, {
          ...speechOptions,
          ttsInstructions: "Repeat the learner's English sentence clearly and naturally for listening practice. Use strong clear volume.",
        });
      }, 80);
    }

    const history = [...historyRef.current];
    historyRef.current.push(trimmed);
    userTurnsRef.current = [...userTurnsRef.current, trimmed];

    const fb = await aiTutorService.feedback(scene, trimmed, turn + 1, history, persona);
    feedbacksRef.current = [...feedbacksRef.current, fb];
    const reachedMax = userTurnsRef.current.length >= MAX_PRACTICE_TURNS;

    setMsgs((m) => {
      const copy = [...m];
      const lastUser = [...copy].reverse().find((x) => x.role === "user" && !x.feedback);
      if (lastUser) lastUser.feedback = fb;
      if (!reachedMax) copy.push({ role: "tutor", en: fb.reply, zh: fb.replyZh });
      return [...copy];
    });
    setTurn((t) => t + 1);
    setBusy(false);
    if (reachedMax) {
      finishedRef.current = true;
      speechService.stop();
      stopListenRef.current?.();
      flashToast("已完成 7 句，正在產生成績");
      window.setTimeout(() => finishWith(userTurnsRef.current, feedbacksRef.current, true), 550);
      return;
    }
    if (autoSpeak) speak(fb.reply);
  }

  function toggleMic() {
    if (listening) {
      stopListenRef.current?.();
      setListening(false);
      return;
    }
    speechService.stop();
    const stop = speechService.listen({
      onResult: (text) => {
        setInput((prev) => (prev ? prev + " " : "") + text);
        // auto-send after a short delay so the user sees the transcript
        setTimeout(() => {
          setInput((cur) => {
            handleSend(cur);
            return cur;
          });
        }, 350);
      },
      onError: (msg) => {
        flashToast(msg);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    if (stop) {
      stopListenRef.current = stop;
      setListening(true);
    }
  }

  function finishWith(userTurns: string[], feedbacks: TutorFeedback[], force = false) {
    if (!force && userTurns.length < MIN_PRACTICE_TURNS) {
      flashToast(`請至少練習 ${MIN_PRACTICE_TURNS} 句對話再結束`);
      return;
    }
    const result = aiTutorService.summarize(scene, feedbacks, userTurns);
    speechService.stop();
    stopListenRef.current?.();
    onFinish(result, userTurns, feedbacks);
  }

  function finish() {
    const userTurns = userTurnsRef.current.length
      ? userTurnsRef.current
      : msgs.filter((m) => m.role === "user").map((m) => m.en);
    const feedbacks = feedbacksRef.current.length
      ? feedbacksRef.current
      : (msgs.filter((m) => m.feedback).map((m) => m.feedback!) as TutorFeedback[]);
    finishWith(userTurns, feedbacks);
  }

  const recSupported = speechService.isRecognitionSupported();
  const userTurnCount = msgs.filter((m) => m.role === "user").length;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-4 pb-3 shrink-0">
        <div className="relative h-52 overflow-hidden rounded-[30px] bg-ink shadow-soft">
          <img src={selectedTutor.photoUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg opacity-50" />
          <img src={selectedTutor.photoUrl} alt={selectedTutor.name} className="relative h-full w-full object-contain object-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-white/10" />
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-extrabold text-white backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-mintDeep shadow-[0_0_12px_rgba(86,211,145,0.9)]" />
            LIVE
          </div>
          <button
            onClick={() => speak(selectedTutor.sampleLine)}
            className="absolute right-4 top-4 h-10 w-10 rounded-2xl bg-white/90 text-lilacDeep flex items-center justify-center shadow-softer active:scale-90 transition"
            title="試聽導師聲音"
          >
            <Volume2 size={18} />
          </button>
          <div className="absolute left-4 right-4 bottom-4">
            <p className="text-xl font-black text-white leading-tight drop-shadow">{selectedTutor.name} {selectedTutor.flag}</p>
            <p className="text-sm font-semibold text-white/85 truncate">{selectedTutor.accentLabel} · {selectedTutor.description}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 px-4 pb-44 space-y-3 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i}>
            <div className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              {m.role === "tutor" && <span className="text-xs font-bold text-inkSoft ml-1 mb-0.5">{tutorName}</span>}
              <div className={`max-w-[85%] rounded-3xl p-3 ${m.role === "user" ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}>
                <ClickableText text={m.en} onWord={setActiveWord} className={m.role === "user" ? "text-white" : "text-ink"} />
                {showZh && m.zh && <p className={`text-sm mt-1 ${m.role === "user" ? "text-white/80" : "text-inkSoft"}`}>{m.zh}</p>}
                <div className="mt-1 flex gap-3">
                  <button onClick={() => speak(m.en)} className={m.role === "user" ? "text-white/90" : "text-lilacDeep"}><Volume2 size={15} /></button>
                  <button onClick={() => { dictionaryService.toggleSentence(m.en, m.zh, scene.name); flashToast("已收藏句子"); }} className={m.role === "user" ? "text-white/90" : "text-peachDeep"}><Star size={15} /></button>
                </div>
              </div>
            </div>

            {m.feedback && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 ml-auto max-w-[90%] rounded-3xl bg-mint/60 p-3 text-sm">
                <p className="font-bold text-mintDeep">即時回饋 · 自然度 {m.feedback.naturalness}</p>
                <p className="text-ink mt-1">📝 {m.feedback.grammarTip}</p>
                <p className="text-ink">✨ 更自然：{m.feedback.betterWay}</p>
                {showZh && <p className="text-inkSoft">{m.feedback.zhExplain}</p>}
                <p className="text-peachDeep font-semibold mt-1">{m.feedback.encouragement}</p>
              </motion.div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex justify-start flex-col gap-1">
            <span className="text-xs font-bold text-inkSoft ml-1">{tutorName}</span>
            <div className="rounded-3xl bg-white shadow-softer px-4 py-3 text-inkSoft text-sm flex items-center gap-2">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 rounded-full bg-lilacDeep/50 animate-bounce" style={{animationDelay:"0ms"}} />
                <span className="h-2 w-2 rounded-full bg-lilacDeep/50 animate-bounce" style={{animationDelay:"150ms"}} />
                <span className="h-2 w-2 rounded-full bg-lilacDeep/50 animate-bounce" style={{animationDelay:"300ms"}} />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-sm px-4 py-2 rounded-2xl shadow-soft max-w-[90%] text-center">
          {toast}
        </div>
      )}

      {/* Input bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-3 bg-cream/95 backdrop-blur space-y-2">
        <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
          <span className="text-xs font-bold text-inkSoft">
            已練習 {Math.min(userTurnCount, MAX_PRACTICE_TURNS)}/{MAX_PRACTICE_TURNS} 句
          </span>
          <button onClick={() => setAutoSpeak((v) => !v)} className="flex items-center gap-1 text-xs font-bold text-inkSoft">
            {autoSpeak ? <Volume2 size={14} className="text-lilacDeep" /> : <VolumeX size={14} />}
            自動朗讀：{autoSpeak ? "開" : "關"}
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 px-1">
          <button className="text-xs font-bold text-peachDeep" onClick={finish}>{finishLabel}</button>
        </div>

        {listening && (
          <div className="flex items-center justify-center gap-2 text-lilacDeep font-bold text-sm">
            <span className="h-2 w-2 rounded-full bg-peachDeep animate-ping" /> 聆聽中…請說英文
          </div>
        )}

        <div className="flex items-center gap-2 bg-white rounded-3xl px-3 py-2 shadow-softer">
          <button
            onClick={toggleMic}
            disabled={busy || finishedRef.current}
            title={recSupported ? "語音輸入" : "此瀏覽器不支援語音輸入"}
            className={`h-10 w-10 rounded-2xl flex items-center justify-center active:scale-90 transition shrink-0 ${
              listening ? "bg-peachDeep text-white animate-pulse" : recSupported ? "bg-mint text-mintDeep" : "bg-cream text-inkSoft"
            }`}
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
            placeholder="用語音或打字回覆…"
            disabled={finishedRef.current}
            className="flex-1 bg-transparent outline-none text-ink min-w-0"
          />
          <button onClick={() => handleSend(input)} disabled={busy || !input.trim() || finishedRef.current} className="h-10 w-10 rounded-2xl bg-lilacDeep text-white flex items-center justify-center active:scale-90 transition disabled:opacity-50 shrink-0">
            <Send size={18} />
          </button>
        </div>
      </div>

      <WordSheet word={activeWord} onClose={() => setActiveWord(null)} />
    </div>
  );
}
