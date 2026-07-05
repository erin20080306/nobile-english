"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Film, PlayCircle, Sparkles, X } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import { useUser } from "@/hooks/useUser";

type VideoItem = {
  id: string;
  title: string;
  subtitle: string;
  src: string;
  poster: string;
};

type VideoTopic = {
  id: string;
  eyebrow: string;
  title: string;
  videos: VideoItem[];
};

const VIDEO_TOPICS: VideoTopic[] = [
  {
    id: "theme-characters",
    eyebrow: "Theme Characters",
    title: "主題人物",
    videos: [
      {
        id: "theme-character-1",
        title: "我們是兄弟",
        subtitle: "主題人物",
        src: "/assets/theme-character-videos/theme-character-1.mov",
        poster: "/assets/theme-character-videos/theme-character-1-poster.png",
      },
      {
        id: "theme-character-2",
        title: "吃晚餐",
        subtitle: "主題人物",
        src: "/assets/theme-character-videos/theme-character-2.mov",
        poster: "/assets/theme-character-videos/theme-character-2-poster.png",
      },
      {
        id: "theme-character-3",
        title: "豬姐姐關心篇",
        subtitle: "主題人物",
        src: "/assets/theme-character-videos/theme-character-3.mov",
        poster: "/assets/theme-character-videos/theme-character-3-poster.png",
      },
    ],
  },
  {
    id: "a1-a2-learning",
    eyebrow: "A1-A2 Learning",
    title: "A1~A2學習影片",
    videos: [
      {
        id: "learning-a1-a2-1",
        title: "A1~A2學習影片 1",
        subtitle: "初級英文",
        src: "/assets/theme-character-videos/learning-a1-a2-1.mov",
        poster: "/assets/theme-character-videos/learning-a1-a2-1-poster.png",
      },
      {
        id: "learning-a1-a2-2",
        title: "A1~A2學習影片 2",
        subtitle: "初級英文",
        src: "/assets/theme-character-videos/learning-a1-a2-2.mov",
        poster: "/assets/theme-character-videos/learning-a1-a2-2-poster.png",
      },
      {
        id: "learning-a1-a2-3",
        title: "A1~A2學習影片 3",
        subtitle: "初級英文",
        src: "/assets/theme-character-videos/learning-a1-a2-3.mov",
        poster: "/assets/theme-character-videos/learning-a1-a2-3-poster.png",
      },
      {
        id: "learning-a1-a2-4",
        title: "A1~A2學習影片 4",
        subtitle: "初級英文",
        src: "/assets/theme-character-videos/learning-a1-a2-4.mov",
        poster: "/assets/theme-character-videos/learning-a1-a2-4-poster.png",
      },
      {
        id: "learning-a1-a2-5",
        title: "A1~A2學習影片 5",
        subtitle: "初級英文",
        src: "/assets/theme-character-videos/learning-a1-a2-5.mov",
        poster: "/assets/theme-character-videos/learning-a1-a2-5-poster.png",
      },
      {
        id: "learning-a1-a2-6",
        title: "A1~A2學習影片 6",
        subtitle: "初級英文",
        src: "/assets/theme-character-videos/learning-a1-a2-6.mov",
        poster: "/assets/theme-character-videos/learning-a1-a2-6-poster.png",
      },
    ],
  },
];

export default function ThemeCharacterVideosPage() {
  const { user, ready } = useUser({ requireOnboarded: true });
  const [showGuide, setShowGuide] = useState(true);

  if (!ready || !user) {
    return <div className="p-10 text-center text-inkSoft">載入中…</div>;
  }

  return (
    <div className="min-h-[100dvh] pb-2">
      <AppHeader title="影片" subtitle="主題人物與學習影片" back={false} />

      <main className="px-5 pt-3">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[34px] bg-gradient-to-br from-lilac via-white to-mint p-5 shadow-soft"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/45" />
          <div className="absolute -bottom-10 left-8 h-28 w-28 rounded-full bg-peach/45" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white text-lilacDeep shadow-softer">
              <Film size={28} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-inkSoft">Theme Characters</p>
              <h1 className="text-2xl font-extrabold text-ink">主題人物影片</h1>
              <p className="mt-1 text-sm font-semibold text-inkSoft">收藏主題人物的短片時刻</p>
            </div>
          </div>
        </motion.section>

        {showGuide && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-4 overflow-hidden rounded-[28px] bg-white p-4 shadow-soft"
          >
            <div className="absolute -right-7 -bottom-10 h-24 w-24 rounded-full bg-mint/45" />
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              aria-label="關閉提示"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-cream text-inkSoft active:scale-95 transition"
            >
              <X size={16} />
            </button>
            <div className="relative flex items-center gap-3 pr-8">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-peach text-peachDeep">
                <BookOpen size={22} />
              </span>
              <p className="text-sm font-extrabold leading-relaxed text-ink">
                來看看主題人物與學習影片學習英文吧
              </p>
            </div>
          </motion.section>
        )}

        <div className="mt-5 space-y-6">
          {VIDEO_TOPICS.map((topic) => (
            <VideoTopicSection key={topic.id} topic={topic} />
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function VideoTopicSection({ topic }: { topic: VideoTopic }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-inkSoft">{topic.eyebrow}</p>
          <h2 className="text-xl font-extrabold text-ink">{topic.title}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-lilac px-3 py-1 text-xs font-extrabold text-lilacDeep">
          {topic.videos.length} 部影片
        </span>
      </div>

      <div className="-mx-5 overflow-x-auto px-5 pb-2 no-scrollbar snap-x snap-mandatory">
        <div className="flex gap-3">
          {topic.videos.map((video, index) => (
            <motion.article
              key={video.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="w-[80vw] max-w-[350px] shrink-0 snap-start overflow-hidden rounded-[30px] bg-white shadow-soft"
            >
              <div className="relative aspect-[4/5] bg-ink">
                <video
                  className="h-full w-full object-contain"
                  src={video.src}
                  poster={video.poster}
                  controls
                  playsInline
                  preload="metadata"
                />
              </div>
              <div className="flex min-h-[78px] items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lilac text-lilacDeep">
                  <PlayCircle size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-extrabold text-ink">{video.title}</h3>
                  <p className="text-sm font-semibold text-inkSoft">{video.subtitle}</p>
                </div>
                <Sparkles className="shrink-0 text-mintDeep" size={19} />
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
