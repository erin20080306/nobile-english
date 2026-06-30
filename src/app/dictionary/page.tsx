"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Volume2, Star, BookmarkPlus } from "lucide-react";
import type { LearningLanguageCode, Word } from "@/types";
import { dictionaryService } from "@/services/dictionaryService";
import { vocabularyService } from "@/services/vocabularyService";
import { speechService } from "@/services/speechService";
import { voiceForLanguage } from "@/data/learningLanguages";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

const LANGS: { code: LearningLanguageCode; label: string; flag: string; placeholder: string }[] = [
  { code: "en", label: "英文", flag: "🇺🇸", placeholder: "輸入英文單字" },
  { code: "ja", label: "日文", flag: "🇯🇵", placeholder: "日本語を入力" },
  { code: "ko", label: "韓文", flag: "🇰🇷", placeholder: "한국어 입력" },
  { code: "it", label: "義大利文", flag: "🇮🇹", placeholder: "Inserisci parola italiana" },
  { code: "es", label: "西班牙文", flag: "🇪🇸", placeholder: "Escribe una palabra española" },
];

export default function DictionaryPage() {
  const [lang, setLang] = useState<LearningLanguageCode>("en");
  const [query, setQuery] = useState("");
  const [entry, setEntry] = useState<Word | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const currentLang = LANGS.find((l) => l.code === lang)!;

  function lookup(word = query) {
    if (!word.trim()) return;
    const res = dictionaryService.lookup(word.trim(), lang);
    if (res.entry) {
      setEntry(res.entry);
      setNotFound(false);
      setSaved(vocabularyService.isSaved(res.entry.word));
    } else {
      setEntry(null);
      setNotFound(true);
    }
    setSuggestions([]);
  }

  function onInput(v: string) {
    setQuery(v);
    setSuggestions(dictionaryService.suggest(v, lang));
  }

  function switchLang(code: LearningLanguageCode) {
    setLang(code);
    setQuery("");
    setEntry(null);
    setNotFound(false);
    setSuggestions([]);
  }

  function speakEntry(word: string) {
    if (lang === "en") {
      speechService.speak(word);
    } else {
      speechService.speak(word, voiceForLanguage(lang, 1));
    }
  }

  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader title="多語字典" subtitle="英文 · 日文 · 韓文 · 義大利文 · 西班牙文" back={false} />
      <div className="px-5 space-y-4">

        {/* Language tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => switchLang(l.code)}
              className={`flex-shrink-0 chip transition ${lang === l.code ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="card">
          <div className="flex items-center gap-2 bg-cream rounded-3xl px-3 py-2">
            <Search size={18} className="text-inkSoft" />
            <input
              value={query}
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder={currentLang.placeholder}
              className="flex-1 bg-transparent outline-none text-ink"
              lang={lang}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => { setQuery(s); lookup(s); }} className="chip bg-lilac text-lilacDeep text-xs">{s}</button>
              ))}
            </div>
          )}
          <button className="btn-primary w-full mt-3" onClick={() => lookup()}>查詢</button>
        </div>

        {notFound && (
          <div className="card text-center text-inkSoft">
            找不到「{query}」，請確認拼寫或嘗試其他詞彙。
          </div>
        )}

        {entry && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-extrabold text-ink">{entry.word}</h2>
              <span className="chip bg-lilac text-lilacDeep">{entry.pos}</span>
              <button onClick={() => speakEntry(entry.word)} className="ml-auto h-11 w-11 rounded-2xl bg-lilacDeep text-white flex items-center justify-center flex-shrink-0">
                <Volume2 size={20} />
              </button>
            </div>
            {entry.phonetic && entry.phonetic !== "/-/" && (
              <p className="text-inkSoft text-sm mt-1">{entry.phonetic}</p>
            )}

            {lang === "en" ? (
              <>
                <Block label="Definition 英英定義" value={entry.enDef} />
                <Block label="中文翻譯" value={entry.zh} />
                <Block label="Example 例句" value={entry.example} sub={entry.exampleZh} />
                {entry.synonyms?.length ? <Block label="Synonyms 同義詞" value={entry.synonyms.join(", ")} /> : null}
                {entry.antonyms?.length ? <Block label="Antonyms 反義詞" value={entry.antonyms.join(", ")} /> : null}
                {entry.related?.length ? <Block label="Related 相關單字" value={entry.related.join(", ")} /> : null}
              </>
            ) : (
              <>
                <Block label="中文翻譯" value={entry.zh} />
                <Block label="英文解釋" value={entry.enDef} />
                {entry.example && <Block label="例句" value={entry.example} sub={entry.exampleZh} />}
                {entry.related?.length ? <Block label="相關詞彙" value={entry.related.join("、")} /> : null}
              </>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setSaved(vocabularyService.toggleSave(entry, "字典"))}
                className={`flex-1 rounded-3xl py-3 font-bold flex items-center justify-center gap-2 ${saved ? "bg-peachDeep text-white" : "bg-peach text-ink"}`}
              >
                <Star size={18} fill={saved ? "white" : "none"} /> {saved ? "已收藏" : "收藏"}
              </button>
              <button
                onClick={() => vocabularyService.addToReview(entry, "字典")}
                className="flex-1 rounded-3xl py-3 font-bold bg-mint text-ink flex items-center justify-center gap-2"
              >
                <BookmarkPlus size={18} /> 加入複習
              </button>
            </div>
          </motion.div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function Block({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl bg-cream p-3 mt-3">
      <p className="text-xs font-bold text-inkSoft">{label}</p>
      <p className="text-ink">{value}</p>
      {sub && <p className="text-sm text-inkSoft mt-0.5">{sub}</p>}
    </div>
  );
}
