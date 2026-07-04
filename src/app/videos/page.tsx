"use client";

import { motion } from "framer-motion";
import { Film, PlayCircle, Sparkles } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import { useUser } from "@/hooks/useUser";

type CharacterVideo = {
  id: string;
  title: string;
  subtitle: string;
  src: string;
  poster: string;
};

const CHARACTER_VIDEOS: CharacterVideo[] = [
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
];

export default function ThemeCharacterVideosPage() {
  const { user, ready } = useUser({ requireOnboarded: true });

  if (!ready || !user) {
    return <div className="p-10 text-center text-inkSoft">載入中…</div>;
  }

  return (
    <div className="min-h-[100dvh] pb-2">
      <AppHeader title="主題人物" subtitle="影片區" back={false} />

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

        <section className="mt-4 space-y-4">
          {CHARACTER_VIDEOS.map((video, index) => (
            <motion.article
              key={video.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="overflow-hidden rounded-[34px] bg-white shadow-soft"
            >
              <div className="relative bg-ink/5">
                <video
                  className="block w-full max-h-[520px] bg-ink object-contain"
                  src={video.src}
                  poster={video.poster}
                  controls
                  playsInline
                  preload="metadata"
                />
              </div>
              <div className="flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lilac text-lilacDeep">
                  <PlayCircle size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-extrabold text-ink">{video.title}</h2>
                  <p className="text-sm font-semibold text-inkSoft">{video.subtitle}</p>
                </div>
                <Sparkles className="shrink-0 text-mintDeep" size={20} />
              </div>
            </motion.article>
          ))}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
