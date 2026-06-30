"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Volume2, Star, X, BookmarkPlus } from "lucide-react";
import type { LearningLanguageCode, Word } from "@/types";
import { getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import { dictionaryService } from "@/services/dictionaryService";
import { vocabularyService } from "@/services/vocabularyService";
import { speechService } from "@/services/speechService";
import { learningService } from "@/services/learningService";

export default function WordSheet({
  word,
  language = "en",
  showChinese = true,
  sentence,
  onClose,
}: {
  word: string | null;
  language?: LearningLanguageCode;
  showChinese?: boolean;
  sentence?: string;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState("");
  const [aiEntry, setAiEntry] = useState<Word | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const result = useMemo(
    () => word ? dictionaryService.lookup(word, language) : { entry: null, fromFallback: false },
    [word, language]
  );
  const entry = aiEntry || result.entry;
  const languageInfo = getLearningLanguage(language);

  useEffect(() => {
    if (entry) setSaved(vocabularyService.isSaved(entry.word));
  }, [entry]);

  useEffect(() => {
    let cancelled = false;
    setAiEntry(null);
    if (!word || !result.entry || !shouldAskAi(result.entry, result.fromFallback, sentence)) return;

    const cacheKey = `dictionary-ai:${language}:${word.trim().toLowerCase()}:${(sentence || "").slice(0, 80)}`;
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        setAiEntry(JSON.parse(cached) as Word);
        return;
      }
    } catch {
      // Ignore cache errors; the local dictionary still works.
    }

    setLoadingAi(true);
    fetch("/api/dictionary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word,
        language,
        sentence,
        localEntry: result.entry,
        fromFallback: result.fromFallback,
      }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data?.entry) return;
        setAiEntry(data.entry);
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(data.entry));
        } catch {
          // Cache is optional.
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingAi(false);
      });

    return () => {
      cancelled = true;
    };
  }, [word, language, sentence, result.entry, result.fromFallback]);

  function speak() {
    if (!entry) return;
    const r = speechService.speak(entry.word, {
      ...voiceForLanguage(language, learningService.getSpeechRate(language)),
      onStart: () => setIsPlaying(true),
      onEnd: () => setIsPlaying(false),
      onError: (message) => { setIsPlaying(false); setToast(message); },
    });
    if (!r.ok) { setIsPlaying(false); setToast(r.message || "無法播放發音"); }
  }

  function toggleSave() {
    if (!entry) return;
    const now = vocabularyService.toggleSave(entry, "字典");
    setSaved(now);
    setToast(now ? "已收藏單字" : "已取消收藏");
    setTimeout(() => setToast(""), 1500);
  }

  function addReview() {
    if (!entry) return;
    vocabularyService.addToReview(entry, "字典");
    setToast("已加入複習清單");
    setTimeout(() => setToast(""), 1500);
  }

  return (
    <AnimatePresence>
      {word && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-[480px] bg-white rounded-t-4xl p-5 pb-8 shadow-soft"
            initial={{ y: 320 }}
            animate={{ y: 0 }}
            exit={{ y: 320 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
          >
            <div className="flex justify-center mb-3">
              <div className="h-1.5 w-12 rounded-full bg-lilac" />
            </div>
            <button
              onClick={onClose}
              className="absolute right-4 top-4 h-9 w-9 rounded-2xl bg-cream flex items-center justify-center"
            >
              <X size={18} className="text-inkSoft" />
            </button>

            {!entry ? (
              <div className="py-8 text-center text-inkSoft">
                找不到「{word}」的解釋，試試其他單字吧。
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-extrabold text-ink">{entry.word}</h3>
                  <span className="chip bg-lilac text-lilacDeep">{entry.pos}</span>
                  <button
                    onClick={speak}
                    className={`ml-auto h-11 w-11 rounded-2xl text-white flex items-center justify-center active:scale-90 transition-all ${isPlaying ? "bg-peachDeep" : "bg-lilacDeep"}`}
                    aria-label="播放發音"
                  >
                    {isPlaying ? <SoundWaveIcon /> : <Volume2 size={20} />}
                  </button>
                </div>
                <p className="text-inkSoft mt-1">{entry.phonetic}</p>

                <div className="mt-4 space-y-3">
                  {loadingAi && (
                    <div className="rounded-3xl bg-lilac/50 px-3 py-2 text-sm font-bold text-lilacDeep">
                      正在補完整情境解釋…
                    </div>
                  )}
                  {language === "en" ? (
                    <>
                      <Block label="英文解釋" value={entry.enDef} />
                      {showChinese && <Block label="中文解釋" value={entry.zh} />}
                    </>
                  ) : (
                    <>
                      <Block
                        label={`${languageInfo.zhName}詞意`}
                        value={entry.enDef}
                      />
                      {showChinese && <Block label="中文解釋" value={entry.zh} />}
                    </>
                  )}
                  <Block label="例句" value={entry.example} sub={showChinese ? entry.exampleZh : undefined} />
                  {entry.synonyms?.length ? (
                    <Block label="同義詞" value={entry.synonyms.join(", ")} />
                  ) : null}
                  {entry.antonyms?.length ? (
                    <Block label="反義詞" value={entry.antonyms.join(", ")} />
                  ) : null}
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={toggleSave}
                    className={`flex-1 rounded-3xl py-3 font-bold flex items-center justify-center gap-2 active:scale-95 transition ${
                      saved ? "bg-peachDeep text-white" : "bg-peach text-ink"
                    }`}
                  >
                    <Star size={18} fill={saved ? "white" : "none"} />
                    {saved ? "已收藏" : "收藏單字"}
                  </button>
                  <button
                    onClick={addReview}
                    className="flex-1 rounded-3xl py-3 font-bold bg-mint text-ink flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <BookmarkPlus size={18} />
                    加入複習
                  </button>
                </div>
              </div>
            )}

            {toast && (
              <div className="absolute left-1/2 -translate-x-1/2 -top-12 bg-ink text-white text-sm px-4 py-2 rounded-2xl shadow-soft">
                {toast}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SoundWaveIcon() {
  return (
    <span className="flex items-end gap-[2px]" style={{ height: 20, width: 20 }}>
      <span className="rounded-sm bg-current animate-bounce" style={{ width: 3, height: 11, animationDuration: "0.5s", animationDelay: "0ms" }} />
      <span className="rounded-sm bg-current animate-bounce" style={{ width: 3, height: 20, animationDuration: "0.5s", animationDelay: "0.15s" }} />
      <span className="rounded-sm bg-current animate-bounce" style={{ width: 3, height: 11, animationDuration: "0.5s", animationDelay: "0.3s" }} />
    </span>
  );
}

function Block({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl bg-cream p-3">
      <p className="text-xs font-bold text-inkSoft">{label}</p>
      <p className="text-ink">{value}</p>
      {sub && <p className="text-sm text-inkSoft mt-0.5">{sub}</p>}
    </div>
  );
}

function shouldAskAi(entry: Word, fromFallback: boolean, sentence?: string) {
  const rough =
    fromFallback ||
    entry.phonetic === "/-/" ||
    entry.zh.includes("情境對話") ||
    entry.zh.includes("請搭配") ||
    entry.enDef.includes("common conversation word") ||
    entry.enDef.includes("common conversations");
  return rough || Boolean(sentence);
}
