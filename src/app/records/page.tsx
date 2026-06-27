"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Volume2, Star, X } from "lucide-react";
import type { SavedWord, SavedSentence, LearningRecord, ExamResult, ExamQuestion } from "@/types";
import { vocabularyService } from "@/services/vocabularyService";
import { dictionaryService } from "@/services/dictionaryService";
import { learningService } from "@/services/learningService";
import { examService } from "@/services/examService";
import { speechService } from "@/services/speechService";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

const recordVoice = {
  lang: "en-US",
  voiceKeywords: ["samantha", "ava", "en-us"],
  ttsVoice: "nova" as const,
  ttsInstructions: "Speak clearly and naturally for English learning. Use a warm, crisp, non-raspy voice with strong volume.",
  ttsVolumeGain: 1.55,
};

function speakRecordText(text: string) {
  const r = speechService.speak(text, recordVoice);
  if (!r.ok) alert(r.message || "無法播放語音");
}

function speakRecord(record: LearningRecord) {
  const lines = record.transcript?.length
    ? record.transcript.map((line) => line.en)
    : (record.userAnswer || record.enContent || "").split(" / ");
  const text = lines.map((line) => line.trim()).filter(Boolean).join(". ");
  if (text) speakRecordText(text);
}

const tabs = [
  { key: "words", label: "我的單字" },
  { key: "sentences", label: "我的句子" },
  { key: "dialogue", label: "對話紀錄" },
  { key: "scene", label: "場景紀錄" },
  { key: "exam", label: "測驗紀錄" },
  { key: "wrong", label: "錯題複習" },
  { key: "review", label: "複習清單" },
];

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

  function reload() {
    setWords(vocabularyService.getSaved());
    setSentences(dictionaryService.getSavedSentences());
    setRecords(learningService.getRecords());
    setExamResults(examService.getResults());
    setWrong(examService.getWrongQuestions());
  }

  useEffect(() => { reload(); }, []);

  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader title="學習紀錄" subtitle="單字、句子、對話、測驗一次掌握" back={false} />
      <div className="px-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`chip whitespace-nowrap ${tab === t.key ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-2 space-y-3">
        {tab === "words" && (words.length ? words.map((w) => (
          <div key={w.word} className="card !p-4">
            <div className="flex items-center gap-2">
              <p className="font-extrabold text-ink">{w.word}</p>
              <span className="chip bg-lilac text-lilacDeep text-xs">{w.pos}</span>
              {w.inReview && <span className="chip bg-mint text-mintDeep text-xs">複習中</span>}
              <button onClick={() => speakRecordText(w.word)} className="ml-auto text-lilacDeep"><Volume2 size={18} /></button>
            </div>
            <p className="text-sm text-inkSoft">{w.phonetic} · {w.zh}</p>
            <p className="text-sm text-ink mt-1">{w.example}</p>
            <button onClick={() => { vocabularyService.toggleSave(w); reload(); }} className="chip bg-peach text-peachDeep text-xs mt-2 flex items-center gap-1"><Star size={12} /> 取消收藏</button>
          </div>
        )) : <Empty text="尚未收藏單字，點擊句子中的單字即可收藏。" />)}

        {tab === "sentences" && (sentences.length ? sentences.map((s) => (
          <div key={s.id} className="card !p-4">
            <p className="text-ink font-semibold">{s.en}</p>
            <p className="text-sm text-inkSoft">{s.zh}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => speakRecordText(s.en)} className="chip bg-lilac text-lilacDeep text-xs flex items-center gap-1"><Volume2 size={12} /> 發音</button>
              <button onClick={() => { dictionaryService.toggleSentence(s.en, s.zh); reload(); }} className="chip bg-peach text-peachDeep text-xs">移除</button>
            </div>
          </div>
        )) : <Empty text="尚未收藏句子。" />)}

        {tab === "dialogue" && <RecordList items={records.filter((r) => r.type === "dialogue")} onOpen={setActiveRecord} />}
        {tab === "scene" && <RecordList items={records.filter((r) => r.type === "scene" || r.type === "custom")} onOpen={setActiveRecord} />}

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
                <button onClick={() => speakRecordText(w.word)} className="ml-auto text-lilacDeep"><Volume2 size={18} /></button>
              </div>
              <p className="text-sm text-inkSoft">{w.phonetic} · {w.zh}</p>
              <button onClick={() => { vocabularyService.toggleReview(w.word); reload(); }} className="chip bg-peach text-peachDeep text-xs mt-2">移出複習</button>
            </div>
          )) : <Empty text="複習清單是空的，加入單字開始複習吧。" />;
        })()}
      </div>
      {activeRecord && <RecordDetail record={activeRecord} onClose={() => setActiveRecord(null)} />}
      <BottomNav />
    </div>
  );
}

function RecordList({ items, onOpen }: { items: LearningRecord[]; onOpen: (record: LearningRecord) => void }) {
  if (!items.length) return <Empty text="尚無紀錄。" />;
  return (
    <>
      {items.map((r) => (
        <button key={r.id} onClick={() => onOpen(r)} className="card !p-4 w-full text-left active:scale-[0.99] transition">
          <div className="flex items-center justify-between">
            <p className="font-bold text-ink">{r.title}</p>
            <span className="chip bg-lilac text-lilacDeep text-xs">{r.score} 分</span>
          </div>
          <p className="text-xs text-inkSoft">{new Date(r.date).toLocaleString()} · {r.minutes} 分鐘</p>
          {r.userAnswer && <p className="text-sm text-ink mt-1">你的回答：{r.userAnswer}</p>}
          {r.suggestion && <p className="text-sm text-inkSoft mt-1">建議：{r.suggestion}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-lilacDeep">
              <MessageSquare size={13} /> 查看完整對話紀錄
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                speakRecord(r);
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-peachDeep"
            >
              <Volume2 size={13} /> 播放紀錄
            </button>
          </div>
        </button>
      ))}
    </>
  );
}

function RecordDetail({ record, onClose }: { record: LearningRecord; onClose: () => void }) {
  const fallbackLines = (record.userAnswer || "")
    .split(" / ")
    .map((en) => en.trim())
    .filter(Boolean)
    .map((en) => ({ role: "user" as const, en }));
  const lines: NonNullable<LearningRecord["transcript"]> = record.transcript?.length ? record.transcript : fallbackLines;

  return (
    <div className="fixed inset-0 z-50 bg-cream/95 backdrop-blur overflow-y-auto">
      <div className="min-h-full px-5 py-6 pb-24">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-inkSoft">完整對話紀錄</p>
            <h2 className="text-2xl font-black text-ink break-words">{record.title}</h2>
            <p className="text-sm text-inkSoft">{new Date(record.date).toLocaleString()} · {record.score} 分</p>
          </div>
          <button onClick={() => speakRecord(record)} className="h-11 w-11 rounded-2xl bg-lilac text-lilacDeep flex items-center justify-center">
            <Volume2 size={20} />
          </button>
          <button onClick={onClose} className="h-11 w-11 rounded-2xl bg-white shadow-softer text-inkSoft flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {lines.length ? lines.map((line, index) => {
            const isUser = line.role === "user";
            return (
              <div key={`${line.role}-${index}`} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-3xl p-3 ${isUser ? "bg-lilacDeep text-white" : "bg-white text-ink shadow-softer"}`}>
                  <p className="font-semibold leading-relaxed break-words">{line.en}</p>
                  {line.zh && <p className={`mt-1 text-sm ${isUser ? "text-white/80" : "text-inkSoft"}`}>{line.zh}</p>}
                  <button
                    onClick={() => speakRecordText(line.en)}
                    className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${isUser ? "text-white/90" : "text-lilacDeep"}`}
                  >
                    <Volume2 size={13} /> 播放
                  </button>
                  {isUser && (line.betterWay || line.grammarTip) && (
                    <div className="mt-3 rounded-2xl bg-white/95 p-3 text-sm text-ink">
                      {typeof line.naturalness === "number" && <p className="font-bold text-mintDeep">自然度 {line.naturalness}</p>}
                      {line.betterWay && <p className="mt-1">更道地：{line.betterWay}</p>}
                      {line.grammarTip && <p className="mt-1 text-inkSoft">修正：{line.grammarTip}</p>}
                      {line.zhExplain && <p className="mt-1 text-inkSoft">{line.zhExplain}</p>}
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

        {record.suggestion && (
          <div className="mt-5 card !p-4">
            <p className="text-xs font-bold text-inkSoft">最後建議</p>
            <p className="mt-1 text-ink font-semibold">{record.suggestion}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-inkSoft py-10">{text}</p>;
}
