"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, MessageSquare, Volume2, Star, X } from "lucide-react";
import type { SavedWord, SavedSentence, LearningRecord, ExamResult, ExamQuestion, LearningLanguageCode, UserSettings } from "@/types";
import { vocabularyService } from "@/services/vocabularyService";
import { dictionaryService } from "@/services/dictionaryService";
import { learningService } from "@/services/learningService";
import { examService } from "@/services/examService";
import { speechService } from "@/services/speechService";
import { LEARNING_LANGUAGES, getLearningLanguage, voiceForLanguage } from "@/data/learningLanguages";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import HorizontalScrollChips from "@/components/HorizontalScrollChips";

type RecordLanguageFilter = LearningLanguageCode | "all";
type WordRecordDateFilter = "all" | "1d" | "3d" | "10d" | "30d" | "older30";

const tabs = [
  { key: "words", label: "我的單字" },
  { key: "word", label: "單字練習" },
  { key: "sentences", label: "我的句子" },
  { key: "dialogue", label: "對話紀錄" },
  { key: "scene", label: "場景紀錄" },
  { key: "exam", label: "測驗紀錄" },
  { key: "wrong", label: "錯題複習" },
  { key: "review", label: "複習清單" },
];

const wordRecordDateFilters: { key: WordRecordDateFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "1d", label: "1天內" },
  { key: "3d", label: "3天內" },
  { key: "10d", label: "10天內" },
  { key: "30d", label: "30天內" },
  { key: "older30", label: "30天前" },
];

const collapsedWordRecordCount = 6;

function filterByLanguage(items: LearningRecord[], language: RecordLanguageFilter) {
  if (language === "all") return items;
  return items.filter((record) => (record.targetLanguage || "en") === language);
}

function recordAgeDays(record: LearningRecord) {
  const time = new Date(record.date).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - time) / 86400000);
}

function matchesWordRecordDate(record: LearningRecord, filter: WordRecordDateFilter) {
  if (filter === "all") return true;
  const age = recordAgeDays(record);
  if (filter === "1d") return age <= 1;
  if (filter === "3d") return age > 1 && age <= 3;
  if (filter === "10d") return age > 3 && age <= 10;
  if (filter === "30d") return age > 10 && age <= 30;
  return age > 30;
}

function filterByWordRecordDate(items: LearningRecord[], filter: WordRecordDateFilter) {
  return items.filter((record) => matchesWordRecordDate(record, filter));
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-inkSoft">載入中…</div>}>
      <RecordsInner />
    </Suspense>
  );
}

function RecordsInner() {
  const search = useSearchParams();
  const [tab, setTab] = useState(search.get("tab") || "words");

  const [words, setWords] = useState<SavedWord[]>([]);
  const [sentences, setSentences] = useState<SavedSentence[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [wrong, setWrong] = useState<ExamQuestion[]>([]);
  const [activeRecord, setActiveRecord] = useState<LearningRecord | null>(null);
  const [languageFilter, setLanguageFilter] = useState<RecordLanguageFilter>("all");
  const [wordDateFilter, setWordDateFilter] = useState<WordRecordDateFilter>("all");
  const [wordRecordsExpanded, setWordRecordsExpanded] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(() => learningService.getSettings(""));
  const [playingId, setPlayingId] = useState<string | null>(null);

  function speakWithId(key: string, text: string, language: LearningLanguageCode = "en") {
    const r = speechService.speak(text, {
      ...voiceForLanguage(language, learningService.getSpeechRate(language)),
      onStart: () => setPlayingId(key),
      onEnd: () => setPlayingId(null),
      onError: (message) => { setPlayingId(null); alert(message); },
    });
    if (!r.ok) { setPlayingId(null); alert(r.message || "無法播放語音"); }
  }

  function speakRecordFull(key: string, record: LearningRecord) {
    const fallbackText = record.type === "word" ? record.enContent || record.userAnswer || "" : record.userAnswer || record.enContent || "";
    const lines = record.transcript?.length
      ? record.transcript.map((line) => line.en)
      : fallbackText.split(" / ");
    const text = lines.map((line) => line.trim()).filter(Boolean).join(". ");
    if (text) speakWithId(key, text, record.targetLanguage || "en");
  }

  function reload() {
    setSettings(learningService.getSettings(""));
    setWords(vocabularyService.getSaved());
    setSentences(dictionaryService.getSavedSentences());
    setRecords(learningService.getRecords());
    setExamResults(examService.getResults());
    setWrong(examService.getWrongQuestions());
  }

  useEffect(() => { reload(); }, []);

  const showChineseGlobal = settings.showChineseGlobal;
  const showWordZh = showChineseGlobal && settings.wordReviewChinese;
  const showSentenceZh = showChineseGlobal && settings.sentenceReviewChinese;
  const showDialogueZh = showChineseGlobal && settings.dialogueChinese;
  const showSceneZh = showChineseGlobal && settings.sceneChinese;
  const wordPracticeRecords = filterByLanguage(records.filter((r) => r.type === "word"), languageFilter);
  const filteredWordPracticeRecords = filterByWordRecordDate(wordPracticeRecords, wordDateFilter);

  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader title="學習紀錄" subtitle="單字、句子、對話、測驗一次掌握" back={false} />
      <div className="px-3">
        <HorizontalScrollChips>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`chip whitespace-nowrap ${tab === t.key ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}>
              {t.label}
            </button>
          ))}
        </HorizontalScrollChips>
      </div>

      <div className="px-5 mt-2 space-y-3">
        {(tab === "dialogue" || tab === "scene" || tab === "word") && (
          <LanguageFilter value={languageFilter} onChange={(value) => { setLanguageFilter(value); setWordRecordsExpanded(false); }} />
        )}
        {tab === "words" && (words.length ? words.map((w) => (
          <div key={w.word} className="card !p-4">
            <div className="flex items-center gap-2">
              <p className="font-extrabold text-ink">{w.word}</p>
              <span className="chip bg-lilac text-lilacDeep text-xs">{w.pos}</span>
              {w.inReview && <span className="chip bg-mint text-mintDeep text-xs">複習中</span>}
              <button onClick={() => speakWithId(`word-${w.word}`, w.word, w.language || "en")} className={`ml-auto h-8 w-8 rounded-xl flex items-center justify-center transition-all ${playingId === `word-${w.word}` ? "bg-lilacDeep text-white" : "text-lilacDeep"}`}>
                {playingId === `word-${w.word}` ? <SoundWave /> : <Volume2 size={18} />}
              </button>
            </div>
            <p className="text-sm text-inkSoft">{w.phonetic}{showWordZh ? ` · ${w.zh}` : ""}</p>
            <p className="text-sm text-ink mt-1">{w.example}</p>
            <button onClick={() => { vocabularyService.toggleSave(w); reload(); }} className="chip bg-peach text-peachDeep text-xs mt-2 flex items-center gap-1"><Star size={12} /> 取消收藏</button>
          </div>
        )) : <Empty text="尚未收藏單字，點擊句子中的單字即可收藏。" />)}

        {tab === "word" && (
          <>
            <div className="rounded-[30px] bg-gradient-to-br from-lilac via-white to-mint p-4 shadow-soft">
              <p className="text-xs font-bold text-inkSoft">資料庫單字複習</p>
              <p className="mt-1 text-lg font-extrabold text-ink">依程度抽字，穿插學過與答錯單字</p>
              <button onClick={() => { window.location.href = "/word-review"; }} className="btn-primary mt-3 w-full">
                開始單字練習
              </button>
            </div>
            <WordRecordDateFilterBar
              value={wordDateFilter}
              onChange={(value) => { setWordDateFilter(value); setWordRecordsExpanded(false); }}
              items={wordPracticeRecords}
            />
            <CollapsibleRecordList
              items={filteredWordPracticeRecords}
              onOpen={setActiveRecord}
              showChinese={showWordZh}
              playingId={playingId}
              onSpeak={speakRecordFull}
              expanded={wordRecordsExpanded}
              onToggle={() => setWordRecordsExpanded((value) => !value)}
            />
          </>
        )}

        {tab === "sentences" && (sentences.length ? sentences.map((s) => (
          <div key={s.id} className="card !p-4">
            <p className="text-ink font-semibold">{s.en}</p>
            {showSentenceZh && <p className="text-sm text-inkSoft">{s.zh}</p>}
            <div className="mt-2 flex gap-2">
              <button onClick={() => speakWithId(`sent-${s.id}`, s.en, "en")} className={`chip text-xs flex items-center gap-1 transition-all ${playingId === `sent-${s.id}` ? "bg-lilacDeep text-white" : "bg-lilac text-lilacDeep"}`}>{playingId === `sent-${s.id}` ? <SoundWave size={12} /> : <Volume2 size={12} />} {playingId === `sent-${s.id}` ? "播放中" : "發音"}</button>
              <button onClick={() => { dictionaryService.toggleSentence(s.en, s.zh); reload(); }} className="chip bg-peach text-peachDeep text-xs">移除</button>
            </div>
          </div>
        )) : <Empty text="尚未收藏句子。" />)}

        {tab === "dialogue" && <RecordList items={filterByLanguage(records.filter((r) => r.type === "dialogue"), languageFilter)} onOpen={setActiveRecord} showChinese={showDialogueZh} playingId={playingId} onSpeak={speakRecordFull} />}
        {tab === "scene" && <RecordList items={filterByLanguage(records.filter((r) => r.type === "scene" || r.type === "custom"), languageFilter)} onOpen={setActiveRecord} showChinese={showSceneZh} playingId={playingId} onSpeak={speakRecordFull} />}

        {tab === "exam" && (examResults.length ? examResults.map((r) => (
          <div key={r.id} className="card !p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-ink">{r.exam}</p>
              <p className="text-sm text-inkSoft">{new Date(r.completedAt).toLocaleDateString()} · {r.correct}/{r.total}</p>
            </div>
            <span className="chip bg-lilac text-lilacDeep">{r.percent}%</span>
          </div>
        )) : <Empty text="尚無測驗紀錄。" />)}

        {tab === "wrong" && (wrong.length ? wrong.map((w) => (
          <div key={w.id} className="card !p-4">
            <span className="chip bg-peach text-peachDeep text-xs">{w.exam}</span>
            <p className="font-semibold text-ink mt-1">{w.question}</p>
            <p className="text-sm text-mintDeep mt-1">正解：{w.options[w.answerIndex]}</p>
            <p className="text-sm text-inkSoft mt-1">💡 {w.explanationZh}</p>
            <button onClick={() => { examService.clearWrong(w.id); reload(); }} className="chip bg-mint text-mintDeep text-xs mt-2">標記已複習</button>
          </div>
        )) : <Empty text="目前沒有錯題，繼續保持！" />)}

        {tab === "review" && (() => {
          const rev = words.filter((w) => w.inReview);
          return rev.length ? rev.map((w) => (
            <div key={w.word} className="card !p-4">
              <div className="flex items-center gap-2">
                <p className="font-extrabold text-ink">{w.word}</p>
                <button onClick={() => speakWithId(`rev-${w.word}`, w.word, w.language || "en")} className={`ml-auto h-8 w-8 rounded-xl flex items-center justify-center transition-all ${playingId === `rev-${w.word}` ? "bg-lilacDeep text-white" : "text-lilacDeep"}`}>{playingId === `rev-${w.word}` ? <SoundWave /> : <Volume2 size={18} />}</button>
              </div>
              <p className="text-sm text-inkSoft">{w.phonetic}{showWordZh ? ` · ${w.zh}` : ""}</p>
              <button onClick={() => { vocabularyService.toggleReview(w.word); reload(); }} className="chip bg-peach text-peachDeep text-xs mt-2">移出複習</button>
            </div>
          )) : <Empty text="複習清單是空的，加入單字開始複習吧。" />;
        })()}
      </div>
      {activeRecord && (
        <RecordDetail
          record={activeRecord}
          showChinese={activeRecord.type === "word" ? showWordZh : (activeRecord.type === "scene" || activeRecord.type === "custom") ? showSceneZh : showDialogueZh}
          onClose={() => setActiveRecord(null)}
          playingId={playingId}
          onSpeak={speakWithId}
          onSpeakFull={speakRecordFull}
        />
      )}
      <BottomNav />
    </div>
  );
}

function RecordList({ items, onOpen, showChinese, playingId, onSpeak }: { items: LearningRecord[]; onOpen: (record: LearningRecord) => void; showChinese: boolean; playingId: string | null; onSpeak: (key: string, record: LearningRecord) => void }) {
  if (!items.length) return <Empty text="尚無紀錄。" />;
  return (
    <>
      {items.map((r) => {
        const playKey = `rec-${r.id}`;
        const isPlaying = playingId === playKey;
        const isShadowingRecord = r.type === "scene" && r.title.includes("跟讀");
        return (
          <button key={r.id} onClick={() => onOpen(r)} className="card !p-4 w-full text-left active:scale-[0.99] transition">
            <div className="flex items-center justify-between">
              <p className="font-bold text-ink">{r.title}</p>
              <div className="flex shrink-0 gap-1">
                <span className="chip bg-mint text-mintDeep text-xs">{getLearningLanguage(r.targetLanguage || "en").zhName}</span>
                <span className="chip bg-lilac text-lilacDeep text-xs">{r.score} 分</span>
              </div>
            </div>
            <p className="text-xs text-inkSoft">{new Date(r.date).toLocaleString()} · {r.minutes} 分鐘</p>
            {r.userAnswer && <p className="text-sm text-ink mt-1">{r.type === "word" ? r.userAnswer : `你的回答：${r.userAnswer}`}</p>}
            {showChinese && r.suggestion && <p className="text-sm text-inkSoft mt-1">建議：{r.suggestion}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-lilacDeep">
                <MessageSquare size={13} /> {r.type === "word" ? "查看單字結果" : isShadowingRecord ? "查看跟讀句子" : "查看完整對話紀錄"}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak(playKey, r);
                }}
                className={`inline-flex items-center gap-1 text-xs font-bold transition-all ${isPlaying ? "text-lilacDeep" : "text-peachDeep"}`}
              >
                {isPlaying ? <SoundWave size={13} /> : <Volume2 size={13} />} {isPlaying ? "播放中" : "播放紀錄"}
              </button>
            </div>
          </button>
        );
      })}
    </>
  );
}

function WordRecordDateFilterBar({ value, onChange, items }: { value: WordRecordDateFilter; onChange: (value: WordRecordDateFilter) => void; items: LearningRecord[] }) {
  return (
    <div className="rounded-[28px] bg-white/70 p-2 shadow-softer">
      <HorizontalScrollChips>
        {wordRecordDateFilters.map((filter) => {
          const count = filterByWordRecordDate(items, filter.key).length;
          return (
            <button
              key={filter.key}
              onClick={() => onChange(filter.key)}
              className={`chip whitespace-nowrap ${value === filter.key ? "bg-mintDeep text-white" : "bg-white text-ink shadow-softer"}`}
            >
              {filter.label}<span className="ml-1 text-[11px] opacity-80">{count}</span>
            </button>
          );
        })}
      </HorizontalScrollChips>
    </div>
  );
}

function CollapsibleRecordList({ items, onOpen, showChinese, playingId, onSpeak, expanded, onToggle }: { items: LearningRecord[]; onOpen: (record: LearningRecord) => void; showChinese: boolean; playingId: string | null; onSpeak: (key: string, record: LearningRecord) => void; expanded: boolean; onToggle: () => void }) {
  if (!items.length) return <Empty text="這個時間範圍尚無單字練習紀錄。" />;
  const shouldCollapse = items.length > collapsedWordRecordCount;
  const visibleItems = shouldCollapse && !expanded ? items.slice(0, collapsedWordRecordCount) : items;

  return (
    <>
      <RecordList items={visibleItems} onOpen={onOpen} showChinese={showChinese} playingId={playingId} onSpeak={onSpeak} />
      {shouldCollapse && (
        <button onClick={onToggle} className="w-full rounded-3xl bg-white py-3 text-sm font-bold text-lilacDeep shadow-softer flex items-center justify-center gap-2">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {expanded ? "收合紀錄" : `展開更多 ${items.length - collapsedWordRecordCount} 筆`}
        </button>
      )}
    </>
  );
}

function RecordDetail({ record, showChinese, onClose, playingId, onSpeak, onSpeakFull }: { record: LearningRecord; showChinese: boolean; onClose: () => void; playingId: string | null; onSpeak: (key: string, text: string, lang: LearningLanguageCode) => void; onSpeakFull: (key: string, record: LearningRecord) => void }) {
  const isShadowingRecord = record.type === "scene" && record.title.includes("跟讀");
  const fallbackSource = record.type === "word" ? record.enContent || record.userAnswer || "" : record.userAnswer || "";
  const fallbackLines = fallbackSource
    .split(" / ")
    .map((en) => en.trim())
    .filter(Boolean)
    .map((en) => ({ role: "user" as const, en }));
  const lines: NonNullable<LearningRecord["transcript"]> = record.transcript?.length ? record.transcript : fallbackLines;
  const language = record.targetLanguage || "en";
  const headerKey = `detail-header-${record.id}`;

  return (
    <div className="fixed inset-0 z-50 bg-cream/95 backdrop-blur overflow-y-auto">
      <div className="min-h-full px-5 py-6 pb-24">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-inkSoft">{record.type === "word" ? "單字練習結果" : isShadowingRecord ? "跟讀練習紀錄" : "完整對話紀錄"}</p>
            <h2 className="text-2xl font-black text-ink break-words">{record.title}</h2>
            <p className="text-sm text-inkSoft">{new Date(record.date).toLocaleString()} · {record.score} 分</p>
          </div>
          <button onClick={() => onSpeakFull(headerKey, record)} className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-all ${playingId === headerKey ? "bg-lilacDeep text-white" : "bg-lilac text-lilacDeep"}`}>
            {playingId === headerKey ? <SoundWave size={20} /> : <Volume2 size={20} />}
          </button>
          <button onClick={onClose} className="h-11 w-11 rounded-2xl bg-white shadow-softer text-inkSoft flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {lines.length ? lines.map((line, index) => {
            const isUser = line.role === "user";
            const lineKey = `detail-line-${record.id}-${index}`;
            const lineIsPlaying = playingId === lineKey;
            return (
              <div key={`${line.role}-${index}`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-3xl p-3 ${isUser ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}>
                  <p className="font-semibold leading-relaxed break-words">{line.en}</p>
                  {showChinese && line.zh && <p className={`mt-1 text-sm ${isUser ? "text-white/80" : "text-inkSoft"}`}>{line.zh}</p>}
                  <button
                    onClick={() => onSpeak(lineKey, line.en, language)}
                    className={`mt-2 inline-flex items-center gap-1 text-xs font-bold transition-all ${isUser ? "text-white/90" : (lineIsPlaying ? "text-lilacDeep" : "text-lilacDeep")}`}
                  >
                    {lineIsPlaying ? <SoundWave size={13} /> : <Volume2 size={13} />} {lineIsPlaying ? "播放中" : "播放"}
                  </button>
                  {isUser && (line.betterWay || (showChinese && (line.grammarTip || line.zhExplain))) && (
                    <div className="mt-3 rounded-2xl bg-white/95 p-3 text-sm text-ink">
                      {typeof line.naturalness === "number" && <p className="font-bold text-mintDeep">自然度 {line.naturalness}</p>}
                      {line.betterWay && <p className="mt-1">更道地：{line.betterWay}</p>}
                      {showChinese && line.grammarTip && <p className="mt-1 text-inkSoft">修正：{line.grammarTip}</p>}
                      {showChinese && line.zhExplain && <p className="mt-1 text-inkSoft">{line.zhExplain}</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          }) : (
            <div className="card !p-5 text-center text-inkSoft">
              這筆舊紀錄沒有完整逐句資料，只保留摘要。
            </div>
          )}
        </div>

        {showChinese && record.suggestion && (
          <div className="mt-5 card !p-4">
            <p className="text-xs font-bold text-inkSoft">最後建議</p>
            <p className="mt-1 text-ink font-semibold">{record.suggestion}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LanguageFilter({ value, onChange }: { value: RecordLanguageFilter; onChange: (value: RecordLanguageFilter) => void }) {
  return (
    <div className="rounded-[28px] bg-white/70 p-2 shadow-softer">
      <HorizontalScrollChips>
        <button onClick={() => onChange("all")} className={`chip whitespace-nowrap ${value === "all" ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}>
          全部語言
        </button>
        {LEARNING_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => onChange(lang.code)}
            className={`chip whitespace-nowrap ${value === lang.code ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}
          >
            {lang.flag} {lang.zhName}
          </button>
        ))}
      </HorizontalScrollChips>
    </div>
  );
}

function SoundWave({ size = 18 }: { size?: number }) {
  const h = Math.round(size * 0.55);
  const mh = size;
  return (
    <span className="flex items-end gap-[2px]" style={{ height: size, width: size }}>
      <span className="rounded-sm bg-current animate-bounce" style={{ width: 3, height: h, animationDuration: "0.5s", animationDelay: "0ms" }} />
      <span className="rounded-sm bg-current animate-bounce" style={{ width: 3, height: mh, animationDuration: "0.5s", animationDelay: "0.15s" }} />
      <span className="rounded-sm bg-current animate-bounce" style={{ width: 3, height: h, animationDuration: "0.5s", animationDelay: "0.3s" }} />
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-inkSoft py-10">{text}</p>;
}
