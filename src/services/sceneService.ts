import type { Scene, SceneTheme, CustomScene, CustomSceneStage, EnglishLevel } from "@/types";
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
    const smart = inferScenarioPlan(input.situation, input.place, input.role);
    const name = smart.name || input.situation || `${input.place} ${input.role} 練習`;
    // Pick 10 key words contextually from vocabulary.
    const keyWords = smart.keyWords.length ? smart.keyWords : pickWords(input.topic + " " + input.situation, 10);
    const patterns = smart.patterns.length ? smart.patterns : buildPatterns(input);
    const dialogue = buildCustomDialogue(input, name, smart.stages);
    const scene: Scene = {
      id,
      themeId: "custom",
      name,
      enName: smart.enName || "My Custom Scene",
      intro: smart.intro || `情境：在${input.place}，你的角色是「${input.role}」。${input.situation}`,
      difficulty: input.difficulty,
      minutes: 10,
      goals: [
        `完成「${name}」角色扮演`,
        smart.stages.length ? `依序完成 ${smart.stages.map((s) => s.title).join("、")}` : `練習句型：${input.pattern || "實用表達"}`,
        "練習真人場景中的接話、提問與確認",
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
      stages: smart.stages,
      scene,
      createdAt: new Date().toISOString(),
    };
    const list = this.getCustomScenes();
    list.unshift(custom);
    storageService.set(KEYS.customScenes, list);
    return custom;
  },
};

function inferScenarioPlan(situation: string, place = "", role = ""): {
  name: string;
  enName: string;
  intro: string;
  keyWords: string[];
  patterns: { en: string; zh: string }[];
  stages: CustomSceneStage[];
} {
  const text = `${situation} ${place} ${role}`.toLowerCase();
  const hasRestaurant = /餐廳|吃飯|點餐|訂位|reservation|restaurant|order food|dining|menu/.test(text);
  if (hasRestaurant) {
    const stages: CustomSceneStage[] = [
      {
        title: "接待與預約",
        enTitle: "Greeting and reservation",
        tutorPrompt: "Good evening. Welcome in. Do you have a reservation?",
        learnerGoal: "說明是否有預約，或請對方安排座位。",
        sampleUser: "Hi, we don't have a reservation. Do you have a table for two?",
      },
      {
        title: "座位需求",
        enTitle: "Seating preference",
        tutorPrompt: "Sure. Would you prefer a table by the window or somewhere quieter?",
        learnerGoal: "表達想坐哪裡、幾位、是否有特殊需求。",
        sampleUser: "A quiet table would be great, thank you.",
      },
      {
        title: "看菜單與推薦",
        enTitle: "Menu and recommendations",
        tutorPrompt: "Here are the menus. Would you like any recommendations?",
        learnerGoal: "詢問推薦、特色菜、食材或過敏資訊。",
        sampleUser: "What do you recommend for something light?",
      },
      {
        title: "正式點餐",
        enTitle: "Ordering food",
        tutorPrompt: "Are you ready to order, or do you need a few more minutes?",
        learnerGoal: "用自然句型點主餐、飲料或套餐。",
        sampleUser: "I'm ready. I'd like the grilled chicken and an iced tea, please.",
      },
      {
        title: "加點與客製",
        enTitle: "Extras and changes",
        tutorPrompt: "Would you like anything else with that? Any changes to the order?",
        learnerGoal: "練習加點、不要某食材、調整口味或確認份量。",
        sampleUser: "Could I have the dressing on the side, please?",
      },
      {
        title: "結帳與收據",
        enTitle: "Payment and receipt",
        tutorPrompt: "How was everything? Would you like the bill now?",
        learnerGoal: "要求帳單、付款方式、收據與道謝。",
        sampleUser: "Everything was great. Could we have the bill, please?",
      },
    ];
    return {
      name: "餐廳點餐",
      enName: "Restaurant Ordering",
      intro: "在餐廳從入座、詢問推薦、點餐、客製需求到結帳的完整真人情境練習。",
      keyWords: ["reservation", "table", "menu", "recommend", "order", "starter", "main course", "drink", "allergy", "bill"],
      patterns: [
        { en: "Do you have a table for two?", zh: "有兩人座位嗎？" },
        { en: "What do you recommend?", zh: "你推薦什麼？" },
        { en: "I'd like the ___, please.", zh: "我想點 ___，謝謝。" },
        { en: "Could I have ___ on the side?", zh: "可以把 ___ 放旁邊嗎？" },
        { en: "Could we have the bill, please?", zh: "可以給我們帳單嗎？" },
      ],
      stages,
    };
  }

  return {
    name: situation,
    enName: "Custom Scenario",
    intro: "",
    keyWords: [],
    patterns: [],
    stages: [
      {
        title: "開場說明",
        enTitle: "Opening",
        tutorPrompt: `Hi. Let's practice this situation: ${situation || "your custom topic"}. What would you like to do first?`,
        learnerGoal: "用一句話說明自己的需求。",
        sampleUser: "Hi, I'd like to explain what I need.",
      },
      {
        title: "確認細節",
        enTitle: "Clarifying details",
        tutorPrompt: "Got it. Could you tell me a little more about the details?",
        learnerGoal: "補充時間、地點、數量或原因。",
        sampleUser: "Sure. The main detail is that I need clear help.",
      },
      {
        title: "提出問題",
        enTitle: "Asking a follow-up",
        tutorPrompt: "That makes sense. What would you like to ask next?",
        learnerGoal: "提出一個後續問題。",
        sampleUser: "Could you explain the next step?",
      },
      {
        title: "確認結果",
        enTitle: "Confirming",
        tutorPrompt: "Let's confirm the plan together.",
        learnerGoal: "確認資訊並禮貌收尾。",
        sampleUser: "That sounds good. Thank you for your help.",
      },
    ],
  };
}

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
  _input: { role: string; place: string; situation: string },
  name: string,
  stages: CustomSceneStage[] = []
) {
  const lines: Scene["dialogue"] = [
    { speaker: "tutor" as const, en: `Welcome. Let's role-play: ${name}.`, zh: `歡迎，我們來角色扮演：${name}。` },
  ];

  stages.forEach((stage) => {
    lines.push({ speaker: "tutor" as const, en: stage.tutorPrompt, zh: stage.learnerGoal });
    lines.push({ speaker: "user" as const, en: stage.sampleUser, zh: stage.learnerGoal });
  });

  return lines;
}
