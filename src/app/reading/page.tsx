"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Play, Pause, SkipBack, SkipForward, Volume2, Settings, Bookmark, CheckCircle } from "lucide-react";
import type { LearningLanguageCode } from "@/types";
import { getLearningLanguage } from "@/data/learningLanguages";
import { audioQueueService } from "@/services/audioQueueService";
import WordSheet from "@/components/WordSheet";

interface ReadingArticle {
  id: string;
  title: string;
  title_zh_tw: string;
  article_text: string;
  difficulty_level: string;
  sentences: {
    id: string;
    sentence_order: number;
    sentence_text: string;
    sentence_zh_tw: string;
    audio_url?: string;
  }[];
}

export default function DailyReadingPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<LearningLanguageCode>("en");
  const [article, setArticle] = useState<ReadingArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [showChinese, setShowChinese] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [selectedWord, setSelectedWord] = useState<{ word: string; sentence?: string } | null>(null);

  const languageInfo = getLearningLanguage(selectedLanguage);

  useEffect(() => {
    loadTodayArticle();
  }, [selectedLanguage]);

  useEffect(() => {
    if (autoScroll && currentSentenceIndex > 0) {
      const element = document.getElementById(`sentence-${currentSentenceIndex}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentSentenceIndex, autoScroll]);

  useEffect(() => {
    audioQueueService.setPlaybackRate(playbackSpeed);
  }, [playbackSpeed]);

  async function loadTodayArticle() {
    setLoading(true);
    try {
      const response = await fetch(`/api/articles/today?language=${selectedLanguage}`);
      if (response.ok) {
        const data = await response.json();
        setArticle(data);
      }
    } catch (error) {
      console.error("Failed to load article:", error);
    } finally {
      setLoading(false);
    }
  }

  async function playFullArticle() {
    if (!article) return;

    // 解鎖音訊
    await audioQueueService.unlockAudio();

    // 清空現有佇列
    audioQueueService.clearQueue();

    // 將所有句子加入佇列
    for (const sentence of article.sentences) {
      audioQueueService.enqueue({
        id: `sentence-${sentence.id}`,
        url: sentence.audio_url || "", // TODO: 從 API 取得音檔 URL
        text: sentence.sentence_text,
        priority: 5,
        onStart: () => {
          setCurrentSentenceIndex(sentence.sentence_order);
          setPlaying(true);
        },
        onEnd: () => {
          if (sentence.sentence_order === article.sentences.length) {
            setPlaying(false);
            setCompleted(true);
          }
        },
        onError: (error) => {
          console.error("Playback error:", error);
          setPlaying(false);
        },
      });
    }

    setPlaying(true);
  }

  function pausePlayback() {
    audioQueueService.stopCurrent();
    setPlaying(false);
  }

  function resumePlayback() {
    // TODO: 實作從當前句子恢復播放
    setPlaying(true);
  }

  function stopPlayback() {
    audioQueueService.stopCurrent();
    audioQueueService.clearQueue();
    setPlaying(false);
    setCurrentSentenceIndex(0);
  }

  function playPreviousSentence() {
    if (currentSentenceIndex > 0) {
      const newIndex = currentSentenceIndex - 1;
      // TODO: 跳到指定句子播放
      setCurrentSentenceIndex(newIndex);
    }
  }

  function playNextSentence() {
    if (article && currentSentenceIndex < article.sentences.length - 1) {
      const newIndex = currentSentenceIndex + 1;
      // TODO: 跳到指定句子播放
      setCurrentSentenceIndex(newIndex);
    }
  }

  function toggleBookmark() {
    setBookmarked(!bookmarked);
    // TODO: 呼叫 API 保存收藏狀態
  }

  async function markAsCompleted() {
    if (!article) return;

    try {
      const response = await fetch('/api/articles/complete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase_token') || ''}`,
        },
        body: JSON.stringify({
          articleId: article.id,
          languageCode: selectedLanguage,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCompleted(true);
        console.log('Article completed with rewards:', data.rewards);
      } else {
        const error = await response.text();
        console.error('Failed to complete article:', error);
      }
    } catch (error) {
      console.error('Failed to complete article:', error);
    }
  }

  function handleWordClick(e: React.MouseEvent, sentence: string) {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText) {
      setSelectedWord({ word: selectedText, sentence });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lilacDeep mx-auto mb-4"></div>
          <p className="text-inkSoft">正在準備今日閱讀內容...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="text-center">
          <BookOpen size={48} className="text-lilacDeep mx-auto mb-4" />
          <h2 className="text-xl font-bold text-ink mb-2">今日文章尚未準備好</h2>
          <p className="text-inkSoft mb-4">請稍後再試或切換其他語言</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-32">
      {/* Header */}
      <div className="sticky top-0 bg-cream/95 backdrop-blur border-b border-sand p-4 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-ink">{article.title}</h1>
            <button
              onClick={toggleBookmark}
              className={`p-2 rounded-full ${bookmarked ? "text-peachDeep" : "text-inkSoft"}`}
            >
              <Bookmark size={24} fill={bookmarked ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="px-2 py-1 bg-lilacLight text-lilacDeep rounded-full">
              {languageInfo.nativeName}
            </span>
            <span className="px-2 py-1 bg-sand text-inkSoft rounded-full">
              {article.difficulty_level}
            </span>
            {completed && (
              <span className="px-2 py-1 bg-greenLight text-greenDark rounded-full flex items-center gap-1">
                <CheckCircle size={16} />
                已完成
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="max-w-2xl mx-auto p-4">
        <div className="space-y-4">
          {article.sentences.map((sentence, index) => (
            <motion.div
              key={sentence.id}
              id={`sentence-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-4 rounded-lg border-2 transition-all ${
                currentSentenceIndex === index
                  ? "border-lilacDeep bg-lilacLight/30"
                  : "border-transparent bg-white"
              }`}
            >
              <p 
                className="text-lg text-ink mb-2 cursor-pointer"
                onClick={(e) => handleWordClick(e, sentence.sentence_text)}
              >
                {sentence.sentence_text}
              </p>
              {showChinese && (
                <p className="text-sm text-inkSoft">{sentence.sentence_zh_tw}</p>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Playback Controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-cream/95 backdrop-blur border-t border-sand p-4">
        <div className="max-w-2xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="h-2 bg-sand rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-lilacDeep"
                initial={{ width: 0 }}
                animate={{
                  width: `${((currentSentenceIndex + 1) / (article?.sentences.length || 1)) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-inkSoft mt-1">
              <span>{currentSentenceIndex + 1} / {article?.sentences.length}</span>
              <span>{Math.round((currentSentenceIndex + 1) / (article?.sentences.length || 1) * 100)}%</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={playPreviousSentence}
              disabled={currentSentenceIndex === 0}
              className="p-3 rounded-full bg-sand text-ink disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sand/80 transition-colors"
            >
              <SkipBack size={24} />
            </button>

            {!playing ? (
              <button
                onClick={currentSentenceIndex > 0 ? resumePlayback : playFullArticle}
                className="p-4 rounded-full bg-lilacDeep text-white hover:bg-lilacDark transition-colors"
              >
                <Play size={32} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={pausePlayback}
                className="p-4 rounded-full bg-lilacDeep text-white hover:bg-lilacDark transition-colors"
              >
                <Pause size={32} />
              </button>
            )}

            <button
              onClick={playNextSentence}
              disabled={!article || currentSentenceIndex >= article.sentences.length - 1}
              className="p-3 rounded-full bg-sand text-ink disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sand/80 transition-colors"
            >
              <SkipForward size={24} />
            </button>

            <button
              onClick={stopPlayback}
              className="p-3 rounded-full bg-sand text-ink hover:bg-sand/80 transition-colors"
            >
              <Volume2 size={24} />
            </button>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowChinese(!showChinese)}
                className={`px-3 py-1 rounded-full text-sm ${
                  showChinese ? "bg-lilacLight text-lilacDeep" : "bg-sand text-inkSoft"
                }`}
              >
                繁中
              </button>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`px-3 py-1 rounded-full text-sm ${
                  autoScroll ? "bg-lilacLight text-lilacDeep" : "bg-sand text-inkSoft"
                }`}
              >
                自動捲動
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="px-3 py-1 rounded-full text-sm bg-sand text-ink"
              >
                <option value={0.75}>0.75x</option>
                <option value={0.9}>0.9x</option>
                <option value={1.0}>1.0x</option>
                <option value={1.15}>1.15x</option>
                <option value={1.25}>1.25x</option>
              </select>

              {!completed && (
                <button
                  onClick={markAsCompleted}
                  className="px-4 py-1 rounded-full text-sm bg-peachLight text-peachDeep hover:bg-peachLight/80 transition-colors"
                >
                  完成閱讀
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Word Sheet */}
      {selectedWord && (
        <WordSheet
          word={selectedWord.word}
          sentence={selectedWord.sentence}
          language={selectedLanguage}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}
