"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Volume2, Mic, MicOff, Check, X, RotateCcw, Keyboard } from "lucide-react";
import { speechService } from "@/services/speechService";
import { getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";

interface ShadowingPracticeProps {
  sentence: string;
  translation: string;
  targetLanguage: string;
  onComplete?: (score: number) => void;
}

export default function ShadowingPractice({
  sentence,
  translation,
  targetLanguage,
  onComplete,
}: ShadowingPracticeProps) {
  const [phase, setPhase] = useState<"idle" | "playing" | "recording" | "evaluating" | "result">("idle");
  const [userTranscript, setUserTranscript] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [useManualInput, setUseManualInput] = useState(false);
  
  const stopListenRef = useRef<(() => void) | null>(null);
  const languageInfo = getLearningLanguage(targetLanguage as any);
  const speechSupported = speechService.isRecognitionSupported();

  function calculateSimilarity(original: string, spoken: string): number {
    const normalize = (text: string) => 
      text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    
    const orig = normalize(original);
    const spok = normalize(spoken);
    
    if (!orig || !spok) return 0;
    
    // Simple word-based similarity
    const origWords = orig.split(" ");
    const spokWords = spok.split(" ");
    
    let matches = 0;
    const usedIndices = new Set<number>();
    
    for (const origWord of origWords) {
      for (let i = 0; i < spokWords.length; i++) {
        if (usedIndices.has(i)) continue;
        if (origWord === spokWords[i] || spokWords[i].includes(origWord) || origWord.includes(spokWords[i])) {
          matches++;
          usedIndices.add(i);
          break;
        }
      }
    }
    
    const similarity = (matches / origWords.length) * 100;
    return Math.round(similarity);
  }

  function getFeedbackText(score: number): string {
    if (score >= 90) return "太棒了！發音非常標準！";
    if (score >= 75) return "不錯！再練習一下會更好。";
    if (score >= 50) return "繼續努力，多聽幾次再試。";
    return "再試一次，注意語音和語調。";
  }

  async function playSentence(autoRecordAfter = false) {
    setPhase("playing");
    const r = speechService.speak(sentence, {
      ...voiceForLanguage(targetLanguage as any, 1),
      onEnd: () => {
        if (autoRecordAfter && speechSupported && !useManualInput) {
          startRecording();
        } else {
          setPhase("idle");
        }
      },
    });
    if (!r.ok) {
      alert(r.message);
      setPhase("idle");
    }
  }

  function startRecording() {
    setPhase("recording");
    setUserTranscript("");
    
    const stop = speechService.listen({
      lang: languageInfo.speechLang,
      onResult: (text) => {
        const transcript = text.trim();
        if (!transcript) return;
        setUserTranscript(transcript);
      },
      onError: (msg) => {
        setPhase("idle");
        alert(msg);
      },
      onEnd: () => {
        stopListenRef.current = null;
        evaluatePronunciation();
      },
    });
    
    if (stop) {
      stopListenRef.current = stop;
    }
  }

  function stopRecording() {
    stopListenRef.current?.();
    evaluatePronunciation();
  }

  function evaluatePronunciation() {
    setPhase("evaluating");
    const similarity = calculateSimilarity(sentence, userTranscript);
    setScore(similarity);
    setFeedback(getFeedbackText(similarity));
    setPhase("result");
    onComplete?.(similarity);
  }

  function submitManualInput() {
    if (!userTranscript.trim()) {
      alert("請輸入你的回答");
      return;
    }
    evaluatePronunciation();
  }

  function reset() {
    setPhase("idle");
    setUserTranscript("");
    setScore(null);
    setFeedback("");
  }

  function toggleManualInput() {
    setUseManualInput((prev) => !prev);
    setUserTranscript("");
  }

  return (
    <div className="bg-cream rounded-3xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-ink font-semibold">{sentence}</p>
          <p className="text-sm text-inkSoft mt-1">{translation}</p>
        </div>
        {phase === "idle" && (
          <button
            onClick={() => playSentence(false)}
            className="h-10 w-10 rounded-2xl bg-lilacDeep text-white flex items-center justify-center shrink-0 active:scale-95 transition"
            title="只播放，不錄音"
          >
            <Volume2 size={18} />
          </button>
        )}
      </div>

      {(phase === "idle" || phase === "playing" || phase === "recording") && speechSupported && !useManualInput && (
        <div className="flex flex-col items-center gap-2 py-2">
          <motion.button
            onClick={() => {
              if (phase === "recording") stopRecording();
              else if (phase === "idle") playSentence(true);
            }}
            disabled={phase === "playing"}
            animate={phase === "recording" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={phase === "recording" ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : {}}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-soft transition active:scale-95 disabled:opacity-70 ${
              phase === "recording" ? "bg-peachDeep text-white" : phase === "playing" ? "bg-lilac text-lilacDeep" : "bg-lilacDeep text-white"
            }`}
            title={phase === "recording" ? "停止錄音" : "播放並跟讀"}
          >
            {phase === "recording" && <span className="absolute inset-0 rounded-full bg-peachDeep/60 animate-ping" />}
            {phase === "playing" ? (
              <Volume2 size={30} className="relative" />
            ) : phase === "recording" ? (
              <MicOff size={30} className="relative" />
            ) : (
              <Mic size={30} className="relative" />
            )}
          </motion.button>
          <p className="text-sm font-bold text-inkSoft">
            {phase === "playing" ? "AI 示範中…" : phase === "recording" ? "換你了！請跟著念" : "點一下：先聽 AI 示範，再跟著念"}
          </p>
          {phase === "recording" && (
            <button onClick={stopRecording} className="btn-secondary px-4 py-2 text-sm flex items-center gap-2">
              <MicOff size={14} /> 停止錄音
            </button>
          )}
        </div>
      )}

      {phase === "idle" && (
        <div className="space-y-2">
          {speechSupported && (
            <button
              onClick={toggleManualInput}
              className="w-full btn-secondary flex items-center justify-center gap-2"
            >
              <Keyboard size={18} /> {useManualInput ? "改用語音輸入" : "改用文字輸入"}
            </button>
          )}
          {!speechSupported && (
            <p className="text-sm text-inkSoft text-center">您的瀏覽器不支援語音輸入，請使用文字輸入</p>
          )}
          {(useManualInput || !speechSupported) && (
            <div className="space-y-2">
              <textarea
                value={userTranscript}
                onChange={(e) => setUserTranscript(e.target.value)}
                placeholder="輸入你聽到的句子..."
                className="w-full rounded-2xl px-3 py-2 text-ink bg-white border-2 border-lilac/20 focus:border-lilac outline-none resize-none"
                rows={2}
              />
              <button
                onClick={submitManualInput}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <Check size={18} /> 提交答案
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "result" && score !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-inkSoft">你的發音：</span>
            <span className={`text-sm font-bold ${score >= 75 ? "text-mintDeep" : "text-peachDeep"}`}>
              {userTranscript || "(未辨識到語音)"}
            </span>
          </div>
          
          <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3">
            <span className="text-sm font-bold text-inkSoft">相似度：</span>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black ${score >= 75 ? "text-mintDeep" : score >= 50 ? "text-lilacDeep" : "text-peachDeep"}`}>
                {score}%
              </span>
              {score >= 75 ? <Check size={20} className="text-mintDeep" /> : <X size={20} className="text-peachDeep" />}
            </div>
          </div>

          <p className="text-sm text-center font-semibold text-ink">{feedback}</p>

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} /> 再試一次
            </button>
            <button
              onClick={() => playSentence(false)}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              <Volume2 size={16} /> 再聽一次
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
