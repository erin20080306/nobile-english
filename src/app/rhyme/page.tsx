"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Volume2, Star, BookmarkPlus } from "lucide-react";
import type { LearningLanguageCode, Word } from "@/types";
import { vocabularyService } from "@/services/vocabularyService";
import { speechService } from "@/services/speechService";
import { learningService } from "@/services/learningService";
import { LEARNING_LANGUAGES, getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import HorizontalScrollChips from "@/components/HorizontalScrollChips";

const lengths = [2, 3, 4, 5];
const defaultInput: Record<LearningLanguageCode, string> = {
  en: "light",
  ja: "ください",
  ko: "주세요",
  it: "parlare",
  es: "hablar",
};

export default function RhymePage() {
  const [language, setLanguage] = useState<LearningLanguageCode>("en");
  const [input, setInput] = useState(defaultInput.en);
  const [len, setLen] = useState(3);
  const [results, setResults] = useState<Word[]>([]);
  const [searched, setSearched] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const languageInfo = getLearningLanguage(language);

  useEffect(() => {
    setInput(defaultInput[language]);
    setResults([]);
    setSearched(false);
  }, [language]);

  useEffect(() => {
    setLanguage(learningService.getCurrentLanguage());
  }, []);

  function changeLanguage(code: LearningLanguageCode) {
    learningService.setCurrentLanguage(code);
    setLanguage(code);
  }

  function search(word = input, length = len) {
    const r = vocabularyService.sameEnding(word, length, language);
    setResults(r);
    setSearched(true);
  }

  const suffix = Array.from(input.trim().toLowerCase().normalize("NFC")).slice(-len).join("");
  const sourceLabel = `同尾字（${languageInfo.zhName}）`;

  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader title="同尾字單字" subtitle={`${languageInfo.zhName}本地字庫 ${vocabularyService.count(language)} 字`} back={false} />
      <div className="px-5 space-y-4">
        <HorizontalScrollChips>
          {LEARNING_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`chip whitespace-nowrap ${language === lang.code ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}
            >
              {lang.flag} {lang.zhName}
            </button>
          ))}
        </HorizontalScrollChips>

        <div className="card">
          <div className="flex items-center gap-2 bg-cream rounded-3xl px-3 py-2">
            <Search size={18} className="text-inkSoft" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder={`輸入${languageInfo.zhName}單字，如 ${defaultInput[language]}`}
              className="flex-1 bg-transparent outline-none text-ink"
            />
          </div>
          <p className="text-sm font-bold text-inkSoft mt-3 mb-2">尾字長度</p>
          <div className="flex gap-2">
            {lengths.map((l) => (
              <button
                key={l}
                onClick={() => { setLen(l); search(input, l); }}
                className={`chip flex-1 ${len === l ? "bg-lilacDeep text-white" : "bg-cream text-ink"}`}
              >
                最後 {l} 字
              </button>
            ))}
          </div>
          <button className="btn-primary w-full mt-3" onClick={() => search()}>搜尋同尾字</button>
        </div>

        {searched && (
          <div className="card bg-mint/50">
            <p className="text-ink font-bold">相同尾音練習 🔊</p>
            <p className="text-sm text-inkSoft">以「<b>-{suffix}</b>」結尾的{languageInfo.zhName}單字，唸唸看相同的尾音，幫助記憶與發音！</p>
          </div>
        )}

        {searched && results.length === 0 && (
          <p className="text-center text-inkSoft py-6">找不到以「-{suffix}」結尾的單字，換個字試試看。</p>
        )}

        <div className="space-y-3">
          {results.map((w, i) => (
            <motion.div
              key={w.word}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              className="card !p-4"
            >
              <div className="flex items-center gap-2">
                <p className="text-lg font-extrabold text-ink">
                  {w.word.slice(0, -suffix.length)}
                  <span className="text-lilacDeep">{w.word.slice(-suffix.length)}</span>
                </p>
                <span className="chip bg-lilac text-lilacDeep text-xs">{w.pos}</span>
                <button onClick={() => speechService.speak(w.word, voiceForLanguage(language, learningService.getSpeechRate(language)))} className="ml-auto h-9 w-9 rounded-2xl bg-lilacDeep text-white flex items-center justify-center"><Volume2 size={16} /></button>
              </div>
              <p className="text-sm text-inkSoft">{w.phonetic}</p>
              <p className="text-ink text-sm mt-1">{w.enDef}</p>
              <p className="text-inkSoft text-sm">{w.zh}</p>
              <p className="text-inkSoft text-xs mt-1 italic">{w.example}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => { vocabularyService.toggleSave(w, sourceLabel); setSavedTick((t) => t + 1); }} className="chip bg-peach text-peachDeep flex items-center gap-1"><Star size={14} /> 收藏</button>
                <button onClick={() => { vocabularyService.addToReview(w, sourceLabel); setSavedTick((t) => t + 1); }} className="chip bg-mint text-mintDeep flex items-center gap-1"><BookmarkPlus size={14} /> 複習</button>
              </div>
            </motion.div>
          ))}
        </div>
        <span className="hidden">{savedTick}</span>
      </div>
      <BottomNav />
    </div>
  );
}
