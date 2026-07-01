import type { Scene, SceneTheme, CustomScene, CustomSceneStage, EnglishLevel, LearningLanguageCode, QuizItem } from "@/types";
import { scenes, themes } from "@/data/scenes";
import { vocabulary } from "@/data/vocabulary";
import { getLearningLanguage } from "@/data/learningLanguages";
import { storageService, KEYS } from "./storageService";

type ProgressMap = Record<string, { completed: boolean; score: number }>;

export interface ScenarioPlan {
  name: string;
  enName: string;
  intro: string;
  keyWords: string[];
  patterns: { en: string; zh: string }[];
  stages: CustomSceneStage[];
  quiz: QuizItem[];
}

interface CustomSceneInput {
  situation: string;
  role: string;
  place: string;
  difficulty: EnglishLevel;
  topic: string;
  pattern: string;
  showChinese: boolean;
  rounds: number;
  targetLanguage?: LearningLanguageCode;
}

// Ask the Gemini-backed API to design scenario content tailored to the exact
// topic the learner typed/spoke. Falls back to the local rule-based planner
// (inferScenarioPlan) if the request fails or the response is unusable, so
// custom scene creation always succeeds even without Gemini configured.
async function fetchScenarioPlan(input: CustomSceneInput, targetLanguage: LearningLanguageCode): Promise<ScenarioPlan> {
  try {
    const response = await fetch("/api/scenes/generate-custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        situation: input.situation,
        role: input.role,
        place: input.place,
        difficulty: input.difficulty,
        topic: input.topic,
        pattern: input.pattern,
        targetLanguage,
      }),
    });
    if (!response.ok) throw new Error("generate-custom request failed");
    const data = (await response.json()) as { plan?: ScenarioPlan };
    if (!data.plan || !Array.isArray(data.plan.stages) || data.plan.stages.length === 0) {
      throw new Error("generate-custom missing plan");
    }
    return data.plan;
  } catch {
    return inferScenarioPlan(input.situation, input.place, input.role, targetLanguage);
  }
}

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
  async createCustomScene(input: CustomSceneInput): Promise<CustomScene> {
    const id = "custom-" + Math.random().toString(36).slice(2, 8);
    const targetLanguage = input.targetLanguage || "en";
    const language = getLearningLanguage(targetLanguage);
    const smart = await fetchScenarioPlan(input, targetLanguage);
    const name = smart.name || input.situation || `${input.place} ${input.role} 練習`;
    // Pick 10 key words contextually from vocabulary.
    const keyWords = smart.keyWords.length ? smart.keyWords : pickWords(input.topic + " " + input.situation, 10);
    const patterns = smart.patterns.length ? smart.patterns : buildPatterns(input);
    const dialogue = buildCustomDialogue(input, name, smart.stages);
    const quiz = smart.quiz.length ? smart.quiz : buildFallbackQuiz(patterns);
    const scene: Scene = {
      id,
      themeId: "custom",
      targetLanguage,
      name,
      enName: smart.enName || "My Custom Scene",
      intro: smart.intro || `情境：在${input.place}，你的角色是「${input.role}」。${input.situation}`,
      difficulty: input.difficulty,
      minutes: 10,
      goals: [
        `完成「${name}」角色扮演`,
        smart.stages.length ? `依序完成 ${smart.stages.map((s) => s.title).join("、")}` : `練習句型：${input.pattern || "實用表達"}`,
        `練習${language.zhName}真人場景中的接話、提問與確認`,
      ],
      keyWords,
      keyPatterns: patterns,
      dialogue,
      quiz,
    };
    const custom: CustomScene = {
      id,
      targetLanguage,
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

function buildFallbackQuiz(patterns: { en: string; zh: string }[]): QuizItem[] {
  const primary = patterns[0]?.en || "Hello, nice to meet you.";
  const secondary = patterns[1]?.en || primary;
  return [
    {
      question: "在此情境中，最適合的開場是？",
      options: ["Whatever.", primary, "No.", "Go away."],
      answerIndex: 1,
      explanation: "用禮貌且切題的句型開場最自然。",
    },
    {
      question: "情境中想清楚表達需求時，較適合的說法是？",
      options: [secondary, "Just give it to me.", "Whatever, I don't care.", "No thanks, bye."],
      answerIndex: 0,
      explanation: "清楚且禮貌地表達需求，對方才能順利協助你。",
    },
  ];
}

export function inferScenarioPlan(situation: string, place = "", role = "", targetLanguage: LearningLanguageCode = "en"): ScenarioPlan {
  const text = `${situation} ${place} ${role}`.toLowerCase();
  const hasRestaurant = /餐廳|吃飯|點餐|訂位|reservation|restaurant|order food|dining|menu/.test(text);
  if (hasRestaurant) {
    if (targetLanguage !== "en") return localizedRestaurantPlan(targetLanguage);
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
      quiz: buildFallbackQuiz([
        { en: "Do you have a table for two?", zh: "有兩人座位嗎？" },
        { en: "What do you recommend?", zh: "你推薦什麼？" },
      ]),
    };
  }

  const defaultPatterns = localizedDefaultPatterns(targetLanguage);
  return {
    name: situation,
    enName: targetLanguage === "en" ? "Custom Scenario" : `${getLearningLanguage(targetLanguage).label} Custom Scenario`,
    intro: targetLanguage === "en" ? "" : `使用${getLearningLanguage(targetLanguage).zhName}練習你指定的情境。`,
    keyWords: [],
    patterns: defaultPatterns,
    stages: localizedDefaultStages(situation, targetLanguage),
    quiz: buildFallbackQuiz(defaultPatterns),
  };
}

function localizedRestaurantPlan(targetLanguage: LearningLanguageCode): ScenarioPlan {
  if (targetLanguage === "ja") {
    const stages: CustomSceneStage[] = [
      { title: "接待與預約", enTitle: "受付と予約", tutorPrompt: "いらっしゃいませ。ご予約はありますか？", learnerGoal: "說明是否有預約，或詢問座位。", sampleUser: "予約はありません。二人用の席はありますか？" },
      { title: "座位需求", enTitle: "席の希望", tutorPrompt: "かしこまりました。窓側の席と静かな席、どちらがよろしいですか？", learnerGoal: "表達想坐哪裡或特殊需求。", sampleUser: "静かな席をお願いします。" },
      { title: "菜單與推薦", enTitle: "メニューとおすすめ", tutorPrompt: "こちらがメニューです。おすすめをお伝えしましょうか？", learnerGoal: "詢問推薦、特色菜或過敏資訊。", sampleUser: "軽い料理でおすすめはありますか？" },
      { title: "正式點餐", enTitle: "注文する", tutorPrompt: "ご注文はお決まりですか？", learnerGoal: "自然地點餐和飲料。", sampleUser: "グリルチキンとアイスティーをお願いします。" },
      { title: "加點與客製", enTitle: "追加と変更", tutorPrompt: "ほかに何かご注文や変更はありますか？", learnerGoal: "練習加點或調整口味。", sampleUser: "ドレッシングは別にしてもらえますか？" },
      { title: "結帳與收據", enTitle: "会計とレシート", tutorPrompt: "お食事はいかがでしたか？お会計にしますか？", learnerGoal: "要求帳單、付款與道謝。", sampleUser: "とてもおいしかったです。お会計をお願いします。" },
    ];
    return {
      name: "餐廳點餐（日文）",
      enName: "Restaurant Ordering in Japanese",
      intro: "用日文練習從入座、詢問推薦、點餐、客製需求到結帳的完整餐廳情境。",
      keyWords: ["予約", "席", "メニュー", "おすすめ", "注文", "飲み物", "アレルギー", "お会計", "レシート", "お願いします"],
      patterns: [
        { en: "二人用の席はありますか？", zh: "有兩人座位嗎？" },
        { en: "おすすめは何ですか？", zh: "你推薦什麼？" },
        { en: "___をお願いします。", zh: "我想點 ___，謝謝。" },
        { en: "別にしてもらえますか？", zh: "可以分開放嗎？" },
        { en: "お会計をお願いします。", zh: "請幫我結帳。" },
      ],
      stages,
      quiz: buildFallbackQuiz([
        { en: "二人用の席はありますか？", zh: "有兩人座位嗎？" },
        { en: "おすすめは何ですか？", zh: "你推薦什麼？" },
      ]),
    };
  }
  if (targetLanguage === "ko") {
    const stages: CustomSceneStage[] = [
      { title: "接待與預約", enTitle: "예약 확인", tutorPrompt: "어서 오세요. 예약하셨나요?", learnerGoal: "說明是否有預約，或詢問座位。", sampleUser: "예약은 없어요. 두 명 자리 있나요?" },
      { title: "座位需求", enTitle: "자리 요청", tutorPrompt: "네. 창가 자리와 조용한 자리 중 어디가 좋으세요?", learnerGoal: "表達想坐哪裡或特殊需求。", sampleUser: "조용한 자리로 부탁드려요." },
      { title: "菜單與推薦", enTitle: "메뉴와 추천", tutorPrompt: "메뉴 여기 있습니다. 추천해 드릴까요?", learnerGoal: "詢問推薦、特色菜或過敏資訊。", sampleUser: "가벼운 음식으로 뭐가 좋아요?" },
      { title: "正式點餐", enTitle: "주문하기", tutorPrompt: "주문하시겠어요, 아니면 조금 더 보시겠어요?", learnerGoal: "自然地點餐和飲料。", sampleUser: "그릴 치킨이랑 아이스티 주세요." },
      { title: "加點與客製", enTitle: "추가와 변경", tutorPrompt: "더 필요한 것이나 변경할 내용이 있나요?", learnerGoal: "練習加點或調整口味。", sampleUser: "드레싱은 따로 주실 수 있나요?" },
      { title: "結帳與收據", enTitle: "계산과 영수증", tutorPrompt: "식사는 괜찮으셨어요? 계산해 드릴까요?", learnerGoal: "要求帳單、付款與道謝。", sampleUser: "맛있었어요. 계산 부탁드려요." },
    ];
    return {
      name: "餐廳點餐（韓文）",
      enName: "Restaurant Ordering in Korean",
      intro: "用韓文練習從入座、詢問推薦、點餐、客製需求到結帳的完整餐廳情境。",
      keyWords: ["예약", "자리", "메뉴", "추천", "주문", "음료", "알레르기", "계산", "영수증", "부탁드려요"],
      patterns: [
        { en: "두 명 자리 있나요?", zh: "有兩人座位嗎？" },
        { en: "뭐가 좋아요?", zh: "你推薦什麼？" },
        { en: "___ 주세요.", zh: "我想點 ___，謝謝。" },
        { en: "따로 주실 수 있나요?", zh: "可以分開放嗎？" },
        { en: "계산 부탁드려요.", zh: "請幫我結帳。" },
      ],
      stages,
      quiz: buildFallbackQuiz([
        { en: "두 명 자리 있나요?", zh: "有兩人座位嗎？" },
        { en: "뭐가 좋아요?", zh: "你推薦什麼？" },
      ]),
    };
  }
  if (targetLanguage === "it") {
    const stages: CustomSceneStage[] = [
      { title: "接待與預約", enTitle: "Accoglienza e prenotazione", tutorPrompt: "Buonasera, benvenuti. Avete una prenotazione?", learnerGoal: "說明是否有預約，或詢問座位。", sampleUser: "Non abbiamo una prenotazione. Avete un tavolo per due?" },
      { title: "座位需求", enTitle: "Preferenza del tavolo", tutorPrompt: "Certo. Preferite un tavolo vicino alla finestra o un posto più tranquillo?", learnerGoal: "表達想坐哪裡或特殊需求。", sampleUser: "Un tavolo tranquillo sarebbe perfetto, grazie." },
      { title: "菜單與推薦", enTitle: "Menu e consigli", tutorPrompt: "Ecco i menu. Volete qualche consiglio?", learnerGoal: "詢問推薦、特色菜或過敏資訊。", sampleUser: "Che cosa mi consiglia di leggero?" },
      { title: "正式點餐", enTitle: "Ordinare", tutorPrompt: "Siete pronti per ordinare?", learnerGoal: "自然地點餐和飲料。", sampleUser: "Vorrei il pollo alla griglia e un tè freddo, per favore." },
      { title: "加點與客製", enTitle: "Extra e modifiche", tutorPrompt: "Volete qualcos'altro o qualche modifica?", learnerGoal: "練習加點或調整口味。", sampleUser: "Potrei avere il condimento a parte?" },
      { title: "結帳與收據", enTitle: "Conto e ricevuta", tutorPrompt: "Com'è andata? Volete il conto?", learnerGoal: "要求帳單、付款與道謝。", sampleUser: "Era tutto ottimo. Possiamo avere il conto, per favore?" },
    ];
    return {
      name: "餐廳點餐（義大利文）",
      enName: "Restaurant Ordering in Italian",
      intro: "用義大利文練習從入座、詢問推薦、點餐、客製需求到結帳的完整餐廳情境。",
      keyWords: ["prenotazione", "tavolo", "menu", "consiglio", "ordinare", "bevanda", "allergia", "conto", "ricevuta", "per favore"],
      patterns: [
        { en: "Avete un tavolo per due?", zh: "有兩人座位嗎？" },
        { en: "Che cosa mi consiglia?", zh: "你推薦什麼？" },
        { en: "Vorrei ___, per favore.", zh: "我想點 ___，謝謝。" },
        { en: "Potrei avere ___ a parte?", zh: "可以把 ___ 分開放嗎？" },
        { en: "Possiamo avere il conto, per favore?", zh: "可以給我們帳單嗎？" },
      ],
      stages,
      quiz: buildFallbackQuiz([
        { en: "Avete un tavolo per due?", zh: "有兩人座位嗎？" },
        { en: "Che cosa mi consiglia?", zh: "你推薦什麼？" },
      ]),
    };
  }
  if (targetLanguage === "es") {
    const stages: CustomSceneStage[] = [
      { title: "接待與預約", enTitle: "Recepción y reserva", tutorPrompt: "Buenas noches, bienvenidos. ¿Tienen una reserva?", learnerGoal: "說明是否有預約，或詢問座位。", sampleUser: "No tenemos una reserva. ¿Tienen una mesa para dos?" },
      { title: "座位需求", enTitle: "Preferencia de mesa", tutorPrompt: "¿Prefieren una mesa junto a la ventana o un lugar más tranquilo?", learnerGoal: "表達想坐哪裡或特殊需求。", sampleUser: "Una mesa tranquila estaría bien, gracias." },
      { title: "菜單與推薦", enTitle: "Menú y recomendaciones", tutorPrompt: "Aquí tienen los menús. ¿Quieren alguna recomendación?", learnerGoal: "詢問推薦、特色菜或過敏資訊。", sampleUser: "¿Qué me recomienda que sea ligero?" },
      { title: "正式點餐", enTitle: "Pedir comida", tutorPrompt: "¿Están listos para pedir?", learnerGoal: "自然地點餐和飲料。", sampleUser: "Quisiera el pollo a la parrilla y un té helado, por favor." },
      { title: "加點與客製", enTitle: "Extras y cambios", tutorPrompt: "¿Quieren algo más o algún cambio?", learnerGoal: "練習加點或調整口味。", sampleUser: "¿Podría traer la salsa aparte?" },
      { title: "結帳與收據", enTitle: "Cuenta y recibo", tutorPrompt: "¿Qué tal estuvo todo? ¿Quieren la cuenta?", learnerGoal: "要求帳單、付款與道謝。", sampleUser: "Todo estuvo muy bien. ¿Nos trae la cuenta, por favor?" },
    ];
    return {
      name: "餐廳點餐（西班牙文）",
      enName: "Restaurant Ordering in Spanish",
      intro: "用西班牙文練習從入座、詢問推薦、點餐、客製需求到結帳的完整餐廳情境。",
      keyWords: ["reserva", "mesa", "menú", "recomendación", "pedir", "bebida", "alergia", "cuenta", "recibo", "por favor"],
      patterns: [
        { en: "¿Tienen una mesa para dos?", zh: "有兩人座位嗎？" },
        { en: "¿Qué me recomienda?", zh: "你推薦什麼？" },
        { en: "Quisiera ___, por favor.", zh: "我想點 ___，謝謝。" },
        { en: "¿Podría traer ___ aparte?", zh: "可以把 ___ 分開放嗎？" },
        { en: "¿Nos trae la cuenta, por favor?", zh: "可以給我們帳單嗎？" },
      ],
      stages,
      quiz: buildFallbackQuiz([
        { en: "¿Tienen una mesa para dos?", zh: "有兩人座位嗎？" },
        { en: "¿Qué me recomienda?", zh: "你推薦什麼？" },
      ]),
    };
  }
  return inferScenarioPlan("餐廳點餐", "restaurant", "customer", "en");
}

function localizedDefaultStages(situation: string, targetLanguage: LearningLanguageCode): CustomSceneStage[] {
  if (targetLanguage === "ja") {
    return [
      { title: "開場說明", enTitle: "始める", tutorPrompt: `こんにちは。「${situation || "カスタムテーマ"}」を練習しましょう。まず何を言いたいですか？`, learnerGoal: "用一句日文說明自己的需求。", sampleUser: "こんにちは。少し相談したいです。" },
      { title: "確認細節", enTitle: "詳しく確認", tutorPrompt: "わかりました。もう少し詳しく教えてください。", learnerGoal: "補充時間、地點、數量或原因。", sampleUser: "はい。大事なポイントは時間です。" },
      { title: "提出問題", enTitle: "質問する", tutorPrompt: "いいですね。次に何を聞きたいですか？", learnerGoal: "提出一個後續問題。", sampleUser: "次のステップを教えてもらえますか？" },
      { title: "確認結果", enTitle: "確認する", tutorPrompt: "では、最後に内容を確認しましょう。", learnerGoal: "確認資訊並禮貌收尾。", sampleUser: "わかりました。ありがとうございます。" },
    ];
  }
  if (targetLanguage === "ko") {
    return [
      { title: "開場說明", enTitle: "시작하기", tutorPrompt: `안녕하세요. "${situation || "사용자 주제"}" 상황을 연습해 봐요. 먼저 무엇을 말하고 싶어요?`, learnerGoal: "用一句韓文說明自己的需求。", sampleUser: "안녕하세요. 조금 상담하고 싶어요." },
      { title: "確認細節", enTitle: "자세히 확인", tutorPrompt: "좋아요. 조금 더 자세히 말해 주세요.", learnerGoal: "補充時間、地點、數量或原因。", sampleUser: "네. 중요한 점은 시간이에요." },
      { title: "提出問題", enTitle: "질문하기", tutorPrompt: "좋습니다. 다음에는 무엇을 물어보고 싶어요?", learnerGoal: "提出一個後續問題。", sampleUser: "다음 단계를 알려 주실 수 있나요?" },
      { title: "確認結果", enTitle: "확인하기", tutorPrompt: "그럼 마지막으로 내용을 확인해 봐요.", learnerGoal: "確認資訊並禮貌收尾。", sampleUser: "알겠습니다. 감사합니다." },
    ];
  }
  if (targetLanguage === "it") {
    return [
      { title: "開場說明", enTitle: "Apertura", tutorPrompt: `Ciao. Facciamo pratica con questa situazione: ${situation || "il tuo tema"}. Che cosa vuoi dire per prima cosa?`, learnerGoal: "用一句義大利文說明自己的需求。", sampleUser: "Ciao, vorrei chiedere un'informazione." },
      { title: "確認細節", enTitle: "Chiarire i dettagli", tutorPrompt: "Va bene. Puoi dirmi qualche dettaglio in più?", learnerGoal: "補充時間、地點、數量或原因。", sampleUser: "Certo. Il dettaglio principale è l'orario." },
      { title: "提出問題", enTitle: "Fare una domanda", tutorPrompt: "Perfetto. Che cosa vuoi chiedere adesso?", learnerGoal: "提出一個後續問題。", sampleUser: "Può spiegarmi il prossimo passo?" },
      { title: "確認結果", enTitle: "Confermare", tutorPrompt: "Allora confermiamo il piano insieme.", learnerGoal: "確認資訊並禮貌收尾。", sampleUser: "Va bene. Grazie per l'aiuto." },
    ];
  }
  if (targetLanguage === "es") {
    return [
      { title: "開場說明", enTitle: "Apertura", tutorPrompt: `Hola. Practiquemos esta situación: ${situation || "tu tema"}. ¿Qué quieres decir primero?`, learnerGoal: "用一句西班牙文說明自己的需求。", sampleUser: "Hola, quisiera pedir información." },
      { title: "確認細節", enTitle: "Aclarar detalles", tutorPrompt: "Muy bien. ¿Puedes darme algún detalle más?", learnerGoal: "補充時間、地點、數量或原因。", sampleUser: "Claro. El detalle principal es la hora." },
      { title: "提出問題", enTitle: "Hacer una pregunta", tutorPrompt: "Perfecto. ¿Qué quieres preguntar ahora?", learnerGoal: "提出一個後續問題。", sampleUser: "¿Puede explicarme el siguiente paso?" },
      { title: "確認結果", enTitle: "Confirmar", tutorPrompt: "Entonces confirmemos el plan juntos.", learnerGoal: "確認資訊並禮貌收尾。", sampleUser: "Está bien. Gracias por la ayuda." },
    ];
  }
  return [
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
    ];
}

function localizedDefaultPatterns(targetLanguage: LearningLanguageCode) {
  if (targetLanguage === "ja") {
    return [
      { en: "少し相談したいです。", zh: "我想稍微諮詢一下。" },
      { en: "もう少し詳しく教えてください。", zh: "請再詳細告訴我一點。" },
      { en: "次のステップは何ですか？", zh: "下一步是什麼？" },
      { en: "確認してもいいですか？", zh: "我可以確認一下嗎？" },
      { en: "ありがとうございます。助かりました。", zh: "謝謝你，幫了大忙。" },
    ];
  }
  if (targetLanguage === "ko") {
    return [
      { en: "조금 상담하고 싶어요.", zh: "我想稍微諮詢一下。" },
      { en: "조금 더 자세히 말해 주세요.", zh: "請再詳細說一點。" },
      { en: "다음 단계는 뭐예요?", zh: "下一步是什麼？" },
      { en: "확인해도 될까요?", zh: "我可以確認一下嗎？" },
      { en: "감사합니다. 도움이 됐어요.", zh: "謝謝你，幫了大忙。" },
    ];
  }
  if (targetLanguage === "it") {
    return [
      { en: "Vorrei chiedere un'informazione.", zh: "我想詢問一個資訊。" },
      { en: "Può dirmi qualche dettaglio in più?", zh: "可以再多告訴我一些細節嗎？" },
      { en: "Qual è il prossimo passo?", zh: "下一步是什麼？" },
      { en: "Posso confermare una cosa?", zh: "我可以確認一件事嗎？" },
      { en: "Grazie, mi è stato molto utile.", zh: "謝謝，這對我很有幫助。" },
    ];
  }
  if (targetLanguage === "es") {
    return [
      { en: "Quisiera pedir información.", zh: "我想詢問一個資訊。" },
      { en: "¿Puede darme algún detalle más?", zh: "可以再多告訴我一些細節嗎？" },
      { en: "¿Cuál es el siguiente paso?", zh: "下一步是什麼？" },
      { en: "¿Puedo confirmar una cosa?", zh: "我可以確認一件事嗎？" },
      { en: "Gracias, me ha sido muy útil.", zh: "謝謝，這對我很有幫助。" },
    ];
  }
  return [];
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
