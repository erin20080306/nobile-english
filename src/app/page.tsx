"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, MessageCircle, BookOpen, GraduationCap } from "lucide-react";
import CheerImage from "@/components/CheerImage";
import { authService } from "@/services/authService";

export default function Landing() {
  const router = useRouter();

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      router.replace(user.onboarded ? "/dashboard" : "/onboarding");
    }
  }, [router]);
  const features = [
    { icon: MessageCircle, title: "場景對話", desc: "100+ 真實情境練習" },
    { icon: BookOpen, title: "同尾字＆字典", desc: "多語單字、例句解釋" },
    { icon: GraduationCap, title: "三大考試", desc: "TOEIC / IELTS / TOEFL" },
    { icon: Sparkles, title: "AI 對話導師", desc: "即時回饋與鼓勵" },
  ];
  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-12 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <span className="chip bg-lilac text-lilacDeep">時尚 Q 版語言學習</span>
        <h1 className="mt-4 text-4xl font-extrabold text-ink leading-tight">
          Mobile <span className="text-lilacDeep">Language</span>
        </h1>
        <p className="mt-2 text-inkSoft">每天 15 分鐘，輕鬆把語言練成日常。</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, type: "spring" }}
        className="flex justify-center my-6"
      >
        <div className="animate-float">
          <CheerImage size={200} />
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.07 }}
            className="card !p-4"
          >
            <f.icon className="text-lilacDeep" size={24} />
            <p className="mt-2 font-bold text-ink">{f.title}</p>
            <p className="text-xs text-inkSoft">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-auto pt-8 space-y-3">
        <button className="btn-primary w-full text-lg" onClick={() => router.push("/login")}>
          開始學習
        </button>
      </div>
    </div>
  );
}
