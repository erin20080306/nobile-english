"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Mic, MicOff, RotateCcw, Check, X, Keyboard } from "lucide-react";
import { speechService } from "@/services/speechService";
import { getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import { learningService } from "@/services/learningService";
import { storageService, KEYS } from "@/services/storageService";
import AppHeader from "@/components/AppHeader";

interface ShadowingSentence {
  en: string;
  zh: string;
}

export default function ShadowingPage() {
  const router = useRouter();
  const [sentences, setSentences] = useState<ShadowingSentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"loading" | "idle" | "playing" | "recording" | "evaluating" | "result" | "complete">("loading");
  const [userTranscript, setUserTranscript] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [useManualInput, setUseManualInput] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<any>("en");

  const stopListenRef = useRef<(() => void) | null>(null);
  const languageInfo = getLearningLanguage(targetLanguage);
  const speechSupported = speechService.isRecognitionSupported();

  useEffect(() => {
    // Load shadowing sentences from storage (from scene page) or default
    const loadSentences = () => {
      const patternData = storageService.get<any>(KEYS.shadowingPattern, null);
      
      if (patternData && patternData.allPatterns) {
        // Load from scene pattern data
        const allPatterns = patternData.allPatterns;
        const startIndex = patternData.currentIndex || 0;
        setTargetLanguage(patternData.targetLanguage || "en");
        setSentences(allPatterns);
        setCurrentIndex(startIndex);
        setPhase("idle");
        
        // Auto-start playback after a short delay
        setTimeout(() => {
          playSentence(true);
        }, 500);
      } else {
        // Default sentences for standalone access
        const lang = learningService.getCurrentLanguage();
        setTargetLanguage(lang);
        
        const defaultSentences: ShadowingSentence[] = [
          { en: "Hello, how are you today?", zh: "你好，今天好嗎？" },
          { en: "I'm doing well, thank you.", zh: "我很好，謝謝你。" },
          { en: "What would you like to talk about?", zh: "你想聊什麼呢？" },
          { en: "I'd like to practice English conversation.", zh: "我想練習英語對話。" },
          { en: "That's a great idea!", zh: "那是個好主意！" },
        ];
        setSentences(defaultSentences);
        setPhase("idle");
        
        // Auto-start playback after a short delay
        setTimeout(() => {
          playSentence(true);
        }, 500);
      }
    };

    loadSentences();
    
    // Warm up speech service
    speechService.warmUp();
  }, []);

  const currentSentence = sentences[currentIndex];
  const isRecording = phase === "recording";

  function calculateSimilarity(original: string, spoken: string): number {
    const normalize = (text: string) => 
      text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    
    const orig = normalize(original);
    const spok = normalize(spoken);
    
    if (!orig || !spok) return 0;
    
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
        
        if (origWord === spokWord) {
          bestMatch = true;
          usedIndices.add(i);
          break;
        }
        
        if (spokWord.includes(origWord) || origWord.includes(spokWord)) {
          const longer = Math.max(origWord.length, spokWord.length);
          const shorter = Math.min(origWord.length, spokWord.length);
          if (shorter / longer >= 0.5) {
            bestMatch = true;
            usedIndices.add(i);
            break;
          }
        }
        
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
    
    const wordCountRatio = Math.min(spokWords.length / origWords.length, origWords.length / spokWords.length);
    const similarity = (matches / origWords.length) * 100;
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
    const opts = voiceForLanguage(targetLanguage, 1);
    
    // Always use browser TTS for Chinese prompt to ensure it works
    const r1 = speechService.speak("請跟我讀", {
      lang: "zh-TW",
      voiceKeywords: ["google 繁體中文", "microsoft huihui", "microsoft yating", "mei-jia"],
      rate: 0.9,
      onEnd: () => {
        setTimeout(() => {
          // Use cloud TTS for target sentence if available, otherwise browser TTS
          const r2 = speechService.speak(currentSentence.en, {
            ...opts,
            onEnd: () => {
              if (autoRecordAfter && speechSupported && !useManualInput) {
                startRecording();
              } else {
                setPhase("idle");
              }
            },
          });
          if (!r2.ok) {
            alert(r2.message);
            setPhase("idle");
          }
        }, 300);
      },
    });
    if (!r1.ok) {
      alert(r1.message);
      setPhase("idle");
    }
  }

  function startRecording() {
    setPhase("recording");
    setUserTranscript("");
    
    const stop = speechService.listen({
      lang: "auto",
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
    stopListenRef.current = null;
  }

  function evaluatePronunciation() {
    setPhase("evaluating");
    const similarity = calculateSimilarity(currentSentence.en, userTranscript);
    setScore(similarity);
    setFeedback(getFeedbackText(similarity));
    setScores((prev) => [...prev, similarity]);
    setPhase("result");
  }

  function submitManualInput() {
    evaluatePronunciation();
  }

  function reset() {
    setPhase("idle");
    setUserTranscript("");
    setScore(null);
    setFeedback("");
  }

  function goToNext() {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setPhase("idle");
      setUserTranscript("");
      setScore(null);
      setFeedback("");
    } else {
      setPhase("complete");
    }
  }

  function toggleManualInput() {
    setUseManualInput((prev) => !prev);
  }

  if (phase === "loading") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <p className="text-inkSoft">載入中...</p>
      </div>
    );
  }

  if (phase === "complete") {
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    
    // Save scores back to storage for the scene page to pick up
    const patternData = storageService.get<any>(KEYS.shadowingPattern, null);
    if (patternData && patternData.onComplete) {
      // Save each individual score
      scores.forEach((score, index) => {
        patternData.onComplete(score);
      });
    }
    // Clear the pattern data
    storageService.remove(KEYS.shadowingPattern);
    
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <AppHeader title="跟讀練習完成" onBack={() => router.back()} />
        <div className="flex-1 px-5 py-8 flex flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-black text-ink mb-2">練習完成！</h2>
            <p className="text-inkSoft mb-6">平均相似度：{averageScore}%</p>
            <div className="space-y-2">
              {scores.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-white rounded-2xl px-4 py-2">
                  <span className="text-sm text-inkSoft">句子 {i + 1}</span>
                  <span className={`font-bold ${s >= 75 ? "text-mintDeep" : s >= 50 ? "text-lilacDeep" : "text-peachDeep"}`}>
                    {s}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
          <div className="mt-8 w-full space-y-2">
            <button onClick={() => router.back()} className="btn-primary w-full">
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppHeader
        title="跟讀練習"
        subtitle={`句子 ${currentIndex + 1} / ${sentences.length}`}
        onBack={() => router.back()}
      />
      
      <div className="flex-1 px-5 py-4">
        <div className="h-1.5 bg-sand rounded-full overflow-hidden mb-4">
          <motion.div
            className="h-full bg-lilacDeep rounded-full"
            animate={{ width: `${((currentIndex + 1) / sentences.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="rounded-3xl bg-white shadow-soft p-5 text-center mb-4">
          <p className="text-2xl font-black text-ink leading-snug">{currentSentence.en}</p>
          <p className="text-inkSoft mt-2">{currentSentence.zh}</p>
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
                <button
                  onClick={goToNext}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {currentIndex < sentences.length - 1 ? "下一句" : "完成"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
