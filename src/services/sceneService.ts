import type { Scene, SceneTheme, CustomScene, EnglishLevel } from "@/types";
import { scenes, themes } from "@/data/scenes";
import { vocabulary } from "@/data/vocabulary";
import { storageService, KEYS } from "./storageService";

type ProgressMap = Record<string, { completed: boolean; score: number }>;

export const sceneService = {
  getThemes(): SceneTheme[] {
    return themes;
  },
  getTheme(id: string): SceneTheme | undefined {
    return themes.find((t) => t.id === id);
  },
  getScenesByTheme(themeId: string): Scene[] {
    return scenes.filter((s) => s.themeId === themeId);
  },
  getScene(id: string): Scene | undefined {
    const custom = this.getCustomScenes().find((c) => c.scene.id === id);
    if (custom) return custom.scene;
    return scenes.find((s) => s.id === id);
  },
  countScenes(themeId: string): number {
    return scenes.filter((s) => s.themeId === themeId).length;
  },

  // ---- Progress ----
  getProgress(): ProgressMap {
    return storageService.get<ProgressMap>(KEYS.sceneProgress, {});
  },
  setProgress(sceneId: string, score: number) {
    const p = this.getProgress();
    p[sceneId] = { completed: true, score: Math.max(score, p[sceneId]?.score ?? 0) };
    storageService.set(KEYS.sceneProgress, p);
  },
  themeProgress(themeId: string): { done: number; total: number } {
    const list = this.getScenesByTheme(themeId);
    const p = this.getProgress();
    const done = list.filter((s) => p[s.id]?.completed).length;
    return { done, total: list.length };
  },

  // ---- Custom scenes ----
  getCustomScenes(): CustomScene[] {
    return storageService.get<CustomScene[]>(KEYS.customScenes, []);
  },
  createCustomScene(input: {
    situation: string;
    role: string;
    place: string;
    difficulty: EnglishLevel;
    topic: string;
    pattern: string;
    showChinese: boolean;
    rounds: number;
  }): CustomScene {
    const id = "custom-" + Math.random().toString(36).slice(2, 8);
    const name = input.situation || `${input.place} ${input.role} 練習`;
    // Pick 10 key words contextually from vocabulary.
    const keyWords = pickWords(input.topic + " " + input.situation, 10);
    const patterns = buildPatterns(input);
    const dialogue = buildCustomDialogue(input, name);
    const scene: Scene = {
      id,
      themeId: "custom",
      name,
      enName: "My Custom Scene",
      intro: `情境：在${input.place}，你的角色是「${input.role}」。${input.situation}`,
      difficulty: input.difficulty,
      minutes: 10,
      goals: [
        `完成「${name}」角色扮演`,
        `練習句型：${input.pattern || "實用表達"}`,
        "提升口說自然度與自信",
      ],
      keyWords,
      keyPatterns: patterns,
      dialogue,
      quiz: [
        {
          question: `在此情境中，最適合的開場是？`,
          options: ["Whatever.", patterns[0]?.en || "Hello, nice to meet you.", "No.", "Go away."],
          answerIndex: 1,
          explanation: "用禮貌且切題的句型開場最自然。",
        },
      ],
    };
    const custom: CustomScene = {
      id,
      situation: input.situation,
      role: input.role,
      place: input.place,
      difficulty: input.difficulty,
      topic: input.topic,
      pattern: input.pattern,
      showChinese: input.showChinese,
      rounds: input.rounds,
      scene,
      createdAt: new Date().toISOString(),
    };
    const list = this.getCustomScenes();
    list.unshift(custom);
    storageService.set(KEYS.customScenes, list);
    return custom;
  },
};

function pickWords(seed: string, n: number) {
  const lower = seed.toLowerCase();
  const matched = vocabulary.filter((w) => lower.includes(w.word.toLowerCase())).map((w) => w.word);
  const pool = vocabulary.map((w) => w.word);
  const set = new Set(matched);
  let i = 0;
  while (set.size < n && i < pool.length) {
    set.add(pool[i]);
    i++;
  }
  return Array.from(set).slice(0, n);
}

function buildPatterns(input: { pattern: string; place: string }) {
  const base = [
    { en: "Hello, nice to meet you.", zh: "你好，很高興認識你。" },
    { en: "Could you help me with this?", zh: "你可以幫我這個忙嗎？" },
    { en: `I'm here about the ${input.place}.`, zh: `我是為了${input.place}的事來的。` },
    { en: "Thank you very much for your time.", zh: "非常感謝你的時間。" },
    { en: "Let me explain my situation.", zh: "讓我說明一下我的狀況。" },
  ];
  if (input.pattern.trim()) {
    base.unshift({ en: input.pattern.trim(), zh: "（自訂句型）" });
  }
  return base.slice(0, 5);
}

function buildCustomDialogue(
  input: { role: string; place: string; situation: string },
  name: string
) {
  return [
    { speaker: "tutor" as const, en: `Welcome! Let's role-play: ${name}.`, zh: `歡迎！我們來角色扮演：${name}。` },
    { speaker: "tutor" as const, en: `So, you're at the ${input.place}. How can I help you today?`, zh: `所以你在${input.place}，今天有什麼需要協助的嗎？` },
    { speaker: "user" as const, en: "Hi, I'd like to start, please.", zh: "嗨，我想開始，謝謝。" },
    { speaker: "tutor" as const, en: "Great. Tell me what you need.", zh: "太好了，告訴我你需要什麼。" },
    { speaker: "user" as const, en: "Let me explain my situation.", zh: "讓我說明一下我的狀況。" },
    { speaker: "tutor" as const, en: "Sure, take your time. What is the most important point?", zh: "當然，慢慢來。最重要的重點是什麼？" },
    { speaker: "user" as const, en: "The most important point is that I need clear help.", zh: "最重要的是我需要清楚的協助。" },
    { speaker: "tutor" as const, en: "I understand. What would you like to do next?", zh: "我了解。你接下來想怎麼做？" },
    { speaker: "user" as const, en: "I'd like to ask a follow-up question.", zh: "我想再問一個後續問題。" },
    { speaker: "tutor" as const, en: "Of course. Please ask your question.", zh: "當然，請問你的問題。" },
    { speaker: "user" as const, en: "Could you explain the next step?", zh: "你可以說明下一步嗎？" },
    { speaker: "tutor" as const, en: "Yes. First, we confirm the details together.", zh: "可以。首先，我們一起確認細節。" },
    { speaker: "user" as const, en: "That sounds good. Thank you for your help.", zh: "聽起來很好。謝謝你的幫忙。" },
    { speaker: "tutor" as const, en: "You're welcome. You completed this practice round.", zh: "不客氣，你完成這輪練習了。" },
  ];
}
