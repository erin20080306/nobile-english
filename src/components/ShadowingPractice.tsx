"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Mic, MicOff, Check, X, RotateCcw, Keyboard } from "lucide-react";
import { speechService } from "@/services/speechService";
import { getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import { getSelectedTutor } from "@/components/TutorSelector";
import type { LearningLanguageCode } from "@/types";

const TUTOR_FALLBACK_PHOTO = "/assets/tutors/tutor-fallback.svg";

interface ShadowingPracticeProps {
  sentence: string;
  translation: string;
  targetLanguage: string;
  onComplete?: (score: number) => void;
  onClose?: () => void;
}

export default function ShadowingPractice({
  sentence,
  translation,
  targetLanguage,
  onComplete,
  onClose,
}: ShadowingPracticeProps) {
  const [phase, setPhase] = useState<"idle" | "playing" | "recording" | "evaluating" | "result">("idle");
  const [userTranscript, setUserTranscript] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [useManualInput, setUseManualInput] = useState(false);
  const [recognitionLang, setRecognitionLang] = useState<"target" | "zh" | "auto">("auto");

  const stopListenRef = useRef<(() => void) | null>(null);
  const languageInfo = getLearningLanguage(targetLanguage as any);
  const speechSupported = speechService.isRecognitionSupported();
  const [tutor] = useState(() => getSelectedTutor(targetLanguage as LearningLanguageCode));

  // Auto-play as soon as this component mounts. This component is only ever
  // opened from a direct user tap (e.g. the mic icon), which synchronously
  // calls speechService.unlockAudio() right before mounting us, so browsers
  // (including iOS Safari) will allow this TTS call even though it fires
  // from an effect rather than the click itself.
  useEffect(() => {
    playSentence(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function calculateSimilarity(original: string, spoken: string): number {
    const normalize = (text: string) => 
      text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    
    const orig = normalize(original);
    const spok = normalize(spoken);
    
    if (!orig || !spok) return 0;
    
    // More lenient word-based similarity with partial matching
    const origWords = orig.split(" ").filter(w => w.length > 0);
    const spokWords = spok.split(" ").filter(w => w.length > 0);
    
    if (origWords.length === 0) return 0;
    
    let matches = 0;
    const usedIndices = new Set<number>();
    
    for (const origWord of origWords) {
      let bestMatch = false;
      for (let i = 0; i < spokWords.length; i++) {
        if (usedIndices.has(i)) continue;
        
        const spokWord = spokWords[i];
        
        // Exact match
        if (origWord === spokWord) {
          bestMatch = true;
          usedIndices.add(i);
          break;
        }
        
        // Partial match (one word contains the other)
        if (spokWord.includes(origWord) || origWord.includes(spokWord)) {
          // Only count if the partial match is reasonable (at least 50% of the longer word)
          const longer = Math.max(origWord.length, spokWord.length);
          const shorter = Math.min(origWord.length, spokWord.length);
          if (shorter / longer >= 0.5) {
            bestMatch = true;
            usedIndices.add(i);
            break;
          }
        }
        
        // Levenshtein-like distance for very short words
        if (origWord.length <= 4 && spokWord.length <= 4) {
          let diff = 0;
          const maxLen = Math.max(origWord.length, spokWord.length);
          for (let i = 0; i < maxLen; i++) {
            if (origWord[i] !== spokWord[i]) diff++;
          }
          if (diff <= 1) {
            bestMatch = true;
            usedIndices.add(i);
            break;
          }
        }
      }
      if (bestMatch) matches++;
    }
    
    // Bonus for having most of the words even if not exact matches
    const wordCountRatio = Math.min(spokWords.length / origWords.length, origWords.length / spokWords.length);
    const similarity = (matches / origWords.length) * 100;
    
    // Boost score if word count is close (indicates user said roughly the right amount)
    const boosted = similarity * (0.7 + 0.3 * wordCountRatio);
    
    return Math.round(Math.min(boosted, 100));
  }

  function getFeedbackText(score: number): string {
    if (score >= 90) return "太棒了！發音非常標準！";
    if (score >= 75) return "不錯！再練習一下會更好。";
    if (score >= 50) return "繼續努力，多聽幾次再試。";
    return "再試一次，注意語音和語調。";
  }

  async function playSentence(autoRecordAfter = false) {
    setPhase("playing");
    const opts = voiceForLanguage(targetLanguage as any, 1);

    // Safety timeout to prevent getting stuck on "AI 示範中…" forever if
    // some TTS callback never fires (e.g. cloud TTS request hangs).
    const safetyTimeout = setTimeout(() => {
      console.warn("ShadowingPractice playSentence safety timeout triggered");
      setPhase("idle");
    }, 20000);

    const finishAndMaybeRecord = () => {
      clearTimeout(safetyTimeout);
      if (autoRecordAfter && speechSupported && !useManualInput) {
        setTimeout(() => startRecording(), 800);
      } else {
        setPhase("idle");
      }
    };
    
    // When cloud voice is available, have the tutor say "請跟我讀" in Chinese first,
    // then the target sentence in the target language
    if (opts.ttsVoice) {
      // Speak Chinese prompt first using browser TTS with voice keywords
      const r1 = speechService.speak("請跟我讀", {
        lang: "zh-TW",
        voiceKeywords: ["google 繁體中文", "microsoft huihui", "microsoft yating", "mei-jia"],
        rate: 0.9,
        onEnd: () => {
          // Small delay before target sentence
          setTimeout(() => {
            // Then speak the target sentence with cloud TTS
            const r2 = speechService.speak(sentence, {
              ...opts,
              onEnd: finishAndMaybeRecord,
              onError: (msg) => {
                console.error("Target sentence TTS error:", msg);
                clearTimeout(safetyTimeout);
                setPhase("idle");
              },
            });
            if (!r2.ok) {
              console.error("Target sentence TTS failed:", r2.message);
              clearTimeout(safetyTimeout);
              setPhase("idle");
            }
          }, 500);
        },
        onError: (msg) => {
          console.error("Chinese prompt TTS error:", msg);
          clearTimeout(safetyTimeout);
          setPhase("idle");
        },
      });
      if (!r1.ok) {
        console.error("Chinese prompt TTS failed:", r1.message);
        clearTimeout(safetyTimeout);
        setPhase("idle");
      }
    } else {
      // Fallback: just speak the sentence in target language
      const r = speechService.speak(sentence, {
        ...opts,
        onEnd: finishAndMaybeRecord,
        onError: (msg) => {
          console.error("Sentence TTS error:", msg);
          clearTimeout(safetyTimeout);
          setPhase("idle");
        },
      });
      if (!r.ok) {
        console.error("Sentence TTS failed:", r.message);
        clearTimeout(safetyTimeout);
        setPhase("idle");
      }
    }
  }

  function startRecording() {
    setPhase("recording");
    setUserTranscript("");
    
    const lang = recognitionLang === "target" ? languageInfo.speechLang : recognitionLang === "zh" ? "zh-TW" : "auto";
    const stop = speechService.listen({
      lang,
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

  const tutorSpeaking = phase === "playing";
  const isRecording = phase === "recording";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      {/* AI tutor video-call style header */}
      <div className={`relative h-[42vh] min-h-[280px] shrink-0 overflow-hidden transition-all duration-300 ${tutorSpeaking ? "ring-4 ring-mint/70" : ""}`}>
        <img
          src={tutor.photoUrl}
          alt=""
          onError={(e) => { e.currentTarget.src = TUTOR_FALLBACK_PHOTO; }}
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg opacity-50"
        />
        <motion.img
          src={tutor.photoUrl}
          alt={tutor.name}
          onError={(e) => { e.currentTarget.src = TUTOR_FALLBACK_PHOTO; }}
          animate={tutorSpeaking ? { scale: [1, 1.025, 1], y: [0, -3, 0] } : { scale: 1, y: 0 }}
          transition={tutorSpeaking ? { duration: 1.15, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25 }}
          className={`relative h-full w-full object-contain object-center transition-[filter] duration-300 ${tutorSpeaking ? "drop-shadow-[0_0_24px_rgba(167,139,250,0.55)]" : ""}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-black/30" />

        {onClose && (
          <button
            onClick={onClose}
            className="absolute left-4 top-4 h-10 w-10 rounded-2xl bg-white/15 text-white flex items-center justify-center backdrop-blur active:scale-90 transition"
          >
            <X size={20} />
          </button>
        )}

        <div className="absolute left-4 top-4 ml-14 flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-extrabold text-white backdrop-blur">
          <span className={`h-2 w-2 rounded-full bg-mintDeep shadow-[0_0_12px_rgba(86,211,145,0.9)] ${tutorSpeaking ? "animate-ping" : ""}`} />
          LIVE
        </div>

        {tutorSpeaking && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-4 top-4 flex h-10 items-center gap-1 rounded-2xl bg-white/90 px-3 shadow-softer"
          >
            <span className="h-3 w-1 rounded-full bg-lilacDeep animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-5 w-1 rounded-full bg-lilacDeep animate-bounce" style={{ animationDelay: "120ms" }} />
            <span className="h-4 w-1 rounded-full bg-lilacDeep animate-bounce" style={{ animationDelay: "240ms" }} />
            <span className="h-6 w-1 rounded-full bg-peachDeep animate-bounce" style={{ animationDelay: "360ms" }} />
          </motion.div>
        )}

        <div className="absolute left-4 right-4 bottom-4">
          <p className="text-lg font-black text-white leading-tight drop-shadow">{tutor.name} {tutor.flag}</p>
          <p className="text-sm font-semibold text-white/85">說出這個句子</p>
        </div>
      </div>

      {/* Content sheet */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-t-[32px] bg-cream px-5 pt-6 pb-8 -mt-5 relative">
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl bg-white shadow-soft p-5 text-center">
            <p className="text-2xl font-black text-ink leading-snug">{sentence}</p>
            <p className="text-inkSoft mt-2">{translation}</p>
          </div>

          {(phase === "idle" || phase === "playing" || phase === "recording") && speechSupported && !useManualInput && (
            <div className="flex flex-col items-center gap-3 py-6">
              <motion.button
                onClick={() => {
                  if (phase === "recording") stopRecording();
                  else if (phase === "idle") playSentence(true);
                }}
                disabled={phase === "playing"}
                animate={isRecording ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={isRecording ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : {}}
                className={`relative flex h-32 w-32 items-center justify-center rounded-full shadow-soft transition active:scale-95 disabled:opacity-70 ${
                  isRecording ? "bg-peachDeep text-white" : phase === "playing" ? "bg-lilac text-lilacDeep" : "bg-lilacDeep text-white"
                }`}
                title={isRecording ? "停止錄音" : "點擊說話"}
              >
                {isRecording && <span className="absolute inset-0 rounded-full bg-peachDeep/60 animate-ping" />}
                {phase === "playing" ? (
                  <Volume2 size={44} className="relative" />
                ) : isRecording ? (
                  <MicOff size={44} className="relative" />
                ) : (
                  <Mic size={44} className="relative" />
                )}
              </motion.button>
              <p className="text-sm font-bold text-inkSoft">
                {phase === "playing" ? "AI 示範中…" : isRecording ? "換你了！自動辨識中英文" : "點擊說話"}
              </p>
              {isRecording && (
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
                  className="w-full flex items-center justify-center gap-2 text-sm font-bold text-inkSoft"
                >
                  <Keyboard size={16} /> {useManualInput ? "改用語音輸入" : "現在不方便說話"}
                </button>
              )}
              {!speechSupported && (
                <p className="text-sm text-inkSoft text-center">您的瀏覽器不支援語音輸入，請使用文字輸入</p>
              )}
              {(useManualInput || !speechSupported) && (
                <div className="space-y-2 mt-2">
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

          <AnimatePresence>
            {phase === "result" && score !== null && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 mt-4"
              >
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

                <p className="text-xs text-center text-inkSoft">點擊下方按鈕繼續練習</p>

                <div className="flex gap-2">
                  <button
                    onClick={reset}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={16} /> 再試一次
                  </button>
                  {score >= 75 && onComplete ? (
                    <button
                      onClick={onClose}
                      className="flex-1 btn-primary flex items-center justify-center gap-2"
                    >
                      <Check size={16} /> 完成
                    </button>
                  ) : (
                    <button
                      onClick={() => playSentence(false)}
                      className="flex-1 btn-primary flex items-center justify-center gap-2"
                    >
                      <Volume2 size={16} /> 再聽一次
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
