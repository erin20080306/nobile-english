import type { Scene, SceneTheme, DialogueLine, QuizItem, EnglishLevel } from "@/types";

const levelThemes: SceneTheme[] = [
  { id: "level-a1", name: "A1 入門基礎", enName: "A1 Beginner Basics", emoji: "🌱", color: "#D6F5E3", difficulty: "Beginner", minutes: 8, description: "打招呼、點餐、簡單購物" },
  { id: "level-a2", name: "A2 日常任務", enName: "A2 Everyday Tasks", emoji: "🧭", color: "#D8ECFF", difficulty: "Elementary", minutes: 10, description: "問路、預約、交通住宿" },
  { id: "level-b1", name: "B1 獨立表達", enName: "B1 Independent Speaking", emoji: "💬", color: "#E8E1FF", difficulty: "Intermediate", minutes: 12, description: "描述問題、表達意見、安排計畫" },
  { id: "level-b2", name: "B2 進階互動", enName: "B2 Advanced Interaction", emoji: "🎯", color: "#FFE0D2", difficulty: "Upper-Intermediate", minutes: 14, description: "協商、簡報、客服處理" },
  { id: "level-c1", name: "C1 高階溝通", enName: "C1 Fluent Communication", emoji: "🏆", color: "#F0E7FF", difficulty: "Advanced", minutes: 16, description: "策略討論、精準說服、複雜情境" },
];

export const themes: SceneTheme[] = [
  ...levelThemes,
  { id: "daily", name: "日常生活", enName: "Daily Life", emoji: "☀️", color: "#FFE0D2", difficulty: "Beginner", minutes: 10, description: "打招呼、天氣、日常對話" },
  { id: "cafe", name: "餐廳與咖啡廳", enName: "Food & Cafe", emoji: "☕", color: "#E8E1FF", difficulty: "Beginner", minutes: 12, description: "點餐、客製化、結帳" },
  { id: "travel", name: "旅遊", enName: "Travel", emoji: "🧳", color: "#D8ECFF", difficulty: "Elementary", minutes: 12, description: "問路、交通、觀光" },
  { id: "airport", name: "機場與飯店", enName: "Airport & Hotel", emoji: "✈️", color: "#D6F5E3", difficulty: "Elementary", minutes: 14, description: "報到、登機、入住" },
  { id: "shopping", name: "購物", enName: "Shopping", emoji: "🛍️", color: "#FFE0D2", difficulty: "Beginner", minutes: 10, description: "詢價、試穿、退換貨" },
  { id: "work", name: "職場英文", enName: "Workplace English", emoji: "💼", color: "#E8E1FF", difficulty: "Intermediate", minutes: 15, description: "會議、簡報、email" },
  { id: "interview", name: "英文面試", enName: "Job Interview", emoji: "🎯", color: "#D8ECFF", difficulty: "Intermediate", minutes: 16, description: "自我介紹、問答、薪資" },
  { id: "social", name: "社交與交朋友", enName: "Social English", emoji: "🎉", color: "#D6F5E3", difficulty: "Elementary", minutes: 12, description: "閒聊、興趣、邀約" },
  { id: "phone", name: "電話與客服", enName: "Phone & Customer Service", emoji: "📞", color: "#FFE0D2", difficulty: "Intermediate", minutes: 14, description: "留言、客訴、預約" },
  { id: "exam", name: "考試英文", enName: "Exam English", emoji: "📚", color: "#E8E1FF", difficulty: "Upper-Intermediate", minutes: 18, description: "TOEIC/IELTS/TOEFL 常用句" },
];

interface SceneSpec {
  name: string;
  enName: string;
  difficulty: EnglishLevel;
  words: string[];
  patterns: { en: string; zh: string }[];
  dialogue: DialogueLine[];
  quiz: QuizItem[];
}

// ---- Fully authored: Cafe theme ----
const cafeScenes: SceneSpec[] = [
  {
    name: "點咖啡", enName: "Ordering Coffee", difficulty: "Beginner",
    words: ["coffee", "order", "size", "menu", "please"],
    patterns: [
      { en: "I'd like a latte, please.", zh: "我想要一杯拿鐵，謝謝。" },
      { en: "Can I get a large latte?", zh: "可以給我一杯大杯拿鐵嗎？" },
      { en: "Is this coffee hot or iced?", zh: "這杯咖啡是熱的還是冰的？" },
      { en: "Could I get that to go?", zh: "可以幫我做成外帶嗎？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Hi! What can I get for you today?", zh: "嗨！今天想點什麼？" },
      { speaker: "user", en: "I'd like a medium latte, please.", zh: "我想要一杯中杯拿鐵，謝謝。" },
      { speaker: "tutor", en: "Sure. For here or to go?", zh: "好的。內用還是外帶？" },
      { speaker: "user", en: "To go, please.", zh: "外帶，謝謝。" },
      { speaker: "tutor", en: "That's 4 dollars. Anything else?", zh: "總共四美元，還需要別的嗎？" },
    ],
    quiz: [
      { question: "如何禮貌地點一杯中杯拿鐵？", options: ["Give me latte.", "I'd like a medium latte, please.", "Latte now!", "Where latte?"], answerIndex: 1, explanation: "用 I'd like... please 最禮貌。" },
      { question: "店員問 'For here or to go?' 是在問？", options: ["要冰或熱", "內用或外帶", "要不要加糖", "付現或刷卡"], answerIndex: 1, explanation: "for here=內用，to go=外帶。" },
    ],
  },
  {
    name: "修改飲料甜度", enName: "Adjusting Sweetness", difficulty: "Beginner",
    words: ["sugar", "sweet", "less", "ice", "please"],
    patterns: [
      { en: "Can I have less sugar?", zh: "可以少糖嗎？" },
      { en: "Half sugar and less ice, please.", zh: "半糖少冰，謝謝。" },
      { en: "No ice, please.", zh: "去冰，謝謝。" },
      { en: "Could you make it less sweet?", zh: "可以做得不要那麼甜嗎？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "How sweet would you like it?", zh: "甜度要多少？" },
      { speaker: "user", en: "Half sugar, please.", zh: "半糖，謝謝。" },
      { speaker: "tutor", en: "And how about the ice?", zh: "那冰塊呢？" },
      { speaker: "user", en: "Less ice, please.", zh: "少冰，謝謝。" },
      { speaker: "tutor", en: "Got it. Half sugar, less ice.", zh: "了解，半糖少冰。" },
    ],
    quiz: [
      { question: "「半糖」的英文是？", options: ["full sugar", "half sugar", "no ice", "extra hot"], answerIndex: 1, explanation: "half sugar = 半糖。" },
      { question: "想要少冰怎麼說？", options: ["More ice", "Less ice", "Hot ice", "No cup"], answerIndex: 1, explanation: "less ice = 少冰。" },
    ],
  },
  {
    name: "外帶餐點", enName: "Takeout Order", difficulty: "Beginner",
    words: ["order", "meal", "bag", "go", "ready"],
    patterns: [
      { en: "I'd like this to go.", zh: "我要外帶。" },
      { en: "Could you put it in a bag?", zh: "可以幫我裝袋嗎？" },
      { en: "Is my order ready yet?", zh: "我的餐點好了嗎？" },
      { en: "Can I get a receipt, please?", zh: "可以給我收據嗎？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Will that be for here or to go?", zh: "內用還是外帶？" },
      { speaker: "user", en: "To go, please.", zh: "外帶，謝謝。" },
      { speaker: "tutor", en: "Okay, it'll be ready in five minutes.", zh: "好的，五分鐘後好。" },
      { speaker: "user", en: "Great, thank you.", zh: "太好了，謝謝。" },
    ],
    quiz: [
      { question: "「外帶」怎麼說？", options: ["For here", "To go", "Sit down", "On time"], answerIndex: 1, explanation: "to go = 外帶。" },
      { question: "請對方裝袋可以說？", options: ["Open the bag", "Could you put it in a bag?", "Bag me", "No bag here"], answerIndex: 1, explanation: "禮貌請求用 Could you...?" },
    ],
  },
  {
    name: "餐廳訂位", enName: "Restaurant Reservation", difficulty: "Elementary",
    words: ["reservation", "table", "tonight", "name", "people"],
    patterns: [
      { en: "I'd like to make a reservation.", zh: "我想要訂位。" },
      { en: "A table for two at seven.", zh: "七點兩位。" },
      { en: "Do you have any tables available tonight?", zh: "今晚還有位子嗎？" },
      { en: "Could we sit near the window?", zh: "我們可以坐靠窗的位子嗎？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Thank you for calling. How can I help?", zh: "謝謝來電，需要什麼協助？" },
      { speaker: "user", en: "I'd like to make a reservation for tonight.", zh: "我想訂今晚的位子。" },
      { speaker: "tutor", en: "For how many people?", zh: "幾位呢？" },
      { speaker: "user", en: "A table for two at seven, please.", zh: "七點兩位，謝謝。" },
      { speaker: "tutor", en: "May I have your name?", zh: "請問您的大名？" },
    ],
    quiz: [
      { question: "「訂位」的英文是？", options: ["make a reservation", "make a coffee", "take a seat", "pay the bill"], answerIndex: 0, explanation: "make a reservation = 訂位。" },
      { question: "「兩位」怎麼說？", options: ["for too", "for two", "for to", "for tea"], answerIndex: 1, explanation: "for two = 兩位。" },
    ],
  },
  {
    name: "詢問菜單", enName: "Asking About the Menu", difficulty: "Elementary",
    words: ["menu", "recommend", "special", "popular", "dish"],
    patterns: [
      { en: "What do you recommend?", zh: "你推薦什麼？" },
      { en: "What's today's special?", zh: "今天的特餐是什麼？" },
      { en: "Could I see the menu, please?", zh: "可以給我看菜單嗎？" },
      { en: "Does this dish contain any nuts?", zh: "這道菜含堅果嗎？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Here's the menu. Take your time.", zh: "這是菜單，慢慢看。" },
      { speaker: "user", en: "What do you recommend?", zh: "你推薦什麼？" },
      { speaker: "tutor", en: "Our pasta is very popular.", zh: "我們的義大利麵很受歡迎。" },
      { speaker: "user", en: "Sounds good. I'll try that.", zh: "聽起來不錯，我試試看。" },
    ],
    quiz: [
      { question: "詢問推薦菜色說？", options: ["What do you recommend?", "What time is it?", "Where is it?", "How much?"], answerIndex: 0, explanation: "recommend = 推薦。" },
      { question: "popular 的意思是？", options: ["昂貴的", "受歡迎的", "辣的", "冷的"], answerIndex: 1, explanation: "popular = 受歡迎的。" },
    ],
  },
  {
    name: "點主餐", enName: "Ordering a Main Course", difficulty: "Elementary",
    words: ["order", "steak", "medium", "side", "drink"],
    patterns: [
      { en: "I'll have the steak.", zh: "我要牛排。" },
      { en: "How would you like it cooked?", zh: "要幾分熟？" },
      { en: "I'd like it medium, please.", zh: "我要五分熟，謝謝。" },
      { en: "Could I get that with a side salad?", zh: "可以幫我加點一份沙拉配菜嗎？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Are you ready to order?", zh: "可以點餐了嗎？" },
      { speaker: "user", en: "Yes, I'll have the steak, please.", zh: "好，我要牛排，謝謝。" },
      { speaker: "tutor", en: "How would you like it cooked?", zh: "要幾分熟？" },
      { speaker: "user", en: "Medium, please.", zh: "五分熟，謝謝。" },
    ],
    quiz: [
      { question: "「我要牛排」怎麼說？", options: ["I'll have the steak.", "I am steak.", "Steak me.", "Give steak go."], answerIndex: 0, explanation: "I'll have... 點餐常用。" },
      { question: "medium 指牛排？", options: ["全熟", "五分熟", "生的", "焦的"], answerIndex: 1, explanation: "medium = 五分熟。" },
    ],
  },
  {
    name: "詢問過敏原", enName: "Asking About Allergens", difficulty: "Intermediate",
    words: ["allergy", "nut", "contain", "ingredient", "safe"],
    patterns: [
      { en: "Does this contain nuts?", zh: "這個含有堅果嗎？" },
      { en: "I have a nut allergy.", zh: "我對堅果過敏。" },
      { en: "Could you check with the kitchen, please?", zh: "可以幫我問一下廚房嗎？" },
      { en: "Is there a dairy-free option?", zh: "有不含乳製品的選擇嗎？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Are you ready to order?", zh: "可以點餐了嗎？" },
      { speaker: "user", en: "Does this dish contain nuts? I have a nut allergy.", zh: "這道菜含堅果嗎？我對堅果過敏。" },
      { speaker: "tutor", en: "Let me check with the kitchen.", zh: "我幫您問廚房。" },
      { speaker: "user", en: "Thank you, I appreciate it.", zh: "謝謝，非常感謝。" },
    ],
    quiz: [
      { question: "「我對堅果過敏」怎麼說？", options: ["I like nuts.", "I have a nut allergy.", "No nuts here.", "Nuts are good."], answerIndex: 1, explanation: "have a ... allergy = 對…過敏。" },
      { question: "contain 的意思？", options: ["包含", "倒掉", "煮熟", "外帶"], answerIndex: 0, explanation: "contain = 含有。" },
    ],
  },
  {
    name: "結帳", enName: "Paying the Bill", difficulty: "Beginner",
    words: ["bill", "card", "cash", "receipt", "change"],
    patterns: [
      { en: "Can I have the bill, please?", zh: "可以給我帳單嗎？" },
      { en: "Can I pay by card?", zh: "可以刷卡嗎？" },
      { en: "Do you accept credit cards?", zh: "你們接受信用卡嗎？" },
      { en: "Could I get a receipt, please?", zh: "可以給我收據嗎？" },
    ],
    dialogue: [
      { speaker: "user", en: "Can I have the bill, please?", zh: "可以給我帳單嗎？" },
      { speaker: "tutor", en: "Of course. That's 25 dollars.", zh: "當然，總共 25 美元。" },
      { speaker: "user", en: "Can I pay by card?", zh: "可以刷卡嗎？" },
      { speaker: "tutor", en: "Yes, and here's your receipt.", zh: "可以，這是您的收據。" },
    ],
    quiz: [
      { question: "要結帳怎麼說？", options: ["Can I have the bill, please?", "Where is food?", "Open menu", "More ice"], answerIndex: 0, explanation: "the bill = 帳單。" },
      { question: "receipt 是？", options: ["收據", "食譜", "服務生", "甜點"], answerIndex: 0, explanation: "receipt = 收據。" },
    ],
  },
  {
    name: "抱怨餐點問題", enName: "Complaining About Food", difficulty: "Intermediate",
    words: ["cold", "wrong", "order", "sorry", "replace"],
    patterns: [
      { en: "Excuse me, this is cold.", zh: "不好意思，這個是冷的。" },
      { en: "I think there's a mistake with my order.", zh: "我的餐點好像送錯了。" },
      { en: "This isn't what I ordered.", zh: "這不是我點的餐點。" },
      { en: "Could you bring me a new one, please?", zh: "可以幫我換一份新的嗎？" },
    ],
    dialogue: [
      { speaker: "user", en: "Excuse me, my soup is cold.", zh: "不好意思，我的湯是冷的。" },
      { speaker: "tutor", en: "I'm so sorry. I'll bring a new one.", zh: "非常抱歉，我換一份新的。" },
      { speaker: "user", en: "Thank you, I appreciate it.", zh: "謝謝，感謝。" },
      { speaker: "tutor", en: "It won't take long.", zh: "不會太久。" },
    ],
    quiz: [
      { question: "禮貌抱怨開頭常用？", options: ["Hey!", "Excuse me,", "Go away", "Quick!"], answerIndex: 1, explanation: "Excuse me 開頭最有禮貌。" },
      { question: "replace 的意思？", options: ["更換", "付款", "推薦", "預約"], answerIndex: 0, explanation: "replace = 更換。" },
    ],
  },
  {
    name: "推薦餐點", enName: "Recommending Dishes", difficulty: "Intermediate",
    words: ["recommend", "favorite", "try", "delicious", "popular"],
    patterns: [
      { en: "You should try the salmon.", zh: "你應該試試鮭魚。" },
      { en: "It's one of our best sellers.", zh: "這是我們的招牌之一。" },
      { en: "What would you recommend for dessert?", zh: "甜點你推薦什麼？" },
      { en: "That sounds delicious. I'll take it.", zh: "聽起來很美味，我要這個。" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Have you decided?", zh: "決定好了嗎？" },
      { speaker: "user", en: "Not yet. What's your favorite?", zh: "還沒，你最喜歡哪道？" },
      { speaker: "tutor", en: "You should try the grilled salmon. It's delicious.", zh: "你應該試試烤鮭魚，很美味。" },
      { speaker: "user", en: "Great, I'll take it.", zh: "好，我點這個。" },
    ],
    quiz: [
      { question: "「你應該試試…」怎麼說？", options: ["You should try the...", "You must pay...", "You go now...", "You no eat..."], answerIndex: 0, explanation: "should try = 應該試試。" },
      { question: "delicious 是？", options: ["難吃的", "美味的", "便宜的", "冷的"], answerIndex: 1, explanation: "delicious = 美味的。" },
    ],
  },
];

// ---- Contextual builder for other themes ----
const themeWordBank: Record<string, string[]> = {
  daily: ["hello", "morning", "weather", "weekend", "friend", "family", "today", "time", "good", "happy"],
  travel: ["travel", "ticket", "way", "direction", "city", "map", "bus", "journey", "around", "street"],
  airport: ["airport", "passport", "luggage", "gate", "flight", "hotel", "reservation", "checkout", "ticket", "boarding"],
  shopping: ["shopping", "price", "discount", "size", "cash", "card", "refund", "receipt", "expensive", "cheap"],
  work: ["meeting", "project", "deadline", "schedule", "report", "client", "colleague", "email", "office", "manager"],
  interview: ["interview", "resume", "experience", "skill", "strength", "salary", "company", "position", "confident", "team"],
  social: ["friend", "hobby", "movie", "music", "weekend", "party", "invite", "fun", "favorite", "enjoy"],
  phone: ["phone", "message", "hold", "call", "appointment", "customer", "problem", "help", "number", "transfer"],
  exam: ["question", "answer", "reading", "listening", "grammar", "vocabulary", "score", "passage", "choice", "practice"],
};

// Each theme's full pool of shadowable sentences. Individual scenes within a
// theme only show a rotating 4-sentence window of this pool (see
// pickRotatingPatterns/buildScenes below) so scenes in the same theme don't
// all repeat the exact same four sentences.
const themePatterns: Record<string, { en: string; zh: string }[]> = {
  daily: [
    { en: "How's it going?", zh: "最近好嗎？" },
    { en: "What are you up to today?", zh: "你今天要做什麼？" },
    { en: "Nice to see you again.", zh: "很高興再見到你。" },
    { en: "Have a great day!", zh: "祝你有美好的一天！" },
    { en: "Long time no see!", zh: "好久不見！" },
    { en: "What's new with you?", zh: "你最近有什麼新鮮事？" },
    { en: "See you later!", zh: "待會見！" },
    { en: "Take care of yourself.", zh: "照顧好自己。" },
    { en: "It's nice out today.", zh: "今天天氣真好。" },
    { en: "Let's catch up soon.", zh: "我們找時間聚聚吧。" },
  ],
  travel: [
    { en: "How do I get to the station?", zh: "我要怎麼去車站？" },
    { en: "Is it far from here?", zh: "離這裡遠嗎？" },
    { en: "Could you show me on the map?", zh: "可以在地圖上指給我看嗎？" },
    { en: "Which bus goes downtown?", zh: "哪一班公車去市中心？" },
    { en: "How long does it take to get there?", zh: "到那裡要多久？" },
    { en: "Is there a train station nearby?", zh: "附近有火車站嗎？" },
    { en: "Can you recommend a good place to visit?", zh: "你可以推薦一個好去處嗎？" },
    { en: "Where can I buy a ticket?", zh: "我可以在哪裡買票？" },
    { en: "Does this bus stop at the museum?", zh: "這班公車有停博物館嗎？" },
    { en: "Thank you for your help.", zh: "謝謝你的幫忙。" },
  ],
  airport: [
    { en: "Where is the boarding gate?", zh: "登機門在哪裡？" },
    { en: "I'd like to check in.", zh: "我想要報到。" },
    { en: "Could I have a window seat?", zh: "可以給我靠窗的座位嗎？" },
    { en: "What time does boarding start?", zh: "什麼時候開始登機？" },
    { en: "Do I need to show my passport?", zh: "我需要出示護照嗎？" },
    { en: "How much luggage can I check?", zh: "我可以託運多少行李？" },
    { en: "Is this the line for security?", zh: "這是安檢的隊伍嗎？" },
    { en: "Where can I find a luggage cart?", zh: "哪裡可以找到行李推車？" },
    { en: "Is my flight on time?", zh: "我的班機準時嗎？" },
    { en: "Thank you for your assistance.", zh: "謝謝你的協助。" },
  ],
  shopping: [
    { en: "How much is this?", zh: "這個多少錢？" },
    { en: "Can I try it on?", zh: "我可以試穿嗎？" },
    { en: "Do you have a smaller size?", zh: "有比較小的尺寸嗎？" },
    { en: "Can I pay by card?", zh: "可以刷卡嗎？" },
    { en: "Is this on sale?", zh: "這個有特價嗎？" },
    { en: "Do you have this in another color?", zh: "這個有其他顏色嗎？" },
    { en: "Can I get a refund?", zh: "我可以退款嗎？" },
    { en: "Where is the fitting room?", zh: "試衣間在哪裡？" },
    { en: "Could I have a bag, please?", zh: "可以給我一個袋子嗎？" },
    { en: "Thank you for your help.", zh: "謝謝你的幫忙。" },
  ],
  work: [
    { en: "Let's go over the agenda.", zh: "我們來看一下議程。" },
    { en: "Could you send me the report?", zh: "可以把報告寄給我嗎？" },
    { en: "Can we push the deadline back?", zh: "可以延後截止日嗎？" },
    { en: "I'll follow up by email.", zh: "我會用電子郵件跟進。" },
    { en: "Let's schedule a follow-up meeting.", zh: "我們安排一個後續會議吧。" },
    { en: "Could you clarify this point?", zh: "可以說明一下這一點嗎？" },
    { en: "I'll have that ready by tomorrow.", zh: "我明天前會準備好。" },
    { en: "Let's take a short break.", zh: "我們稍微休息一下吧。" },
    { en: "Thanks for your hard work.", zh: "謝謝你的辛勞。" },
    { en: "Please keep me updated.", zh: "請隨時讓我知道進度。" },
  ],
  interview: [
    { en: "Tell me about yourself.", zh: "請自我介紹。" },
    { en: "What are your strengths?", zh: "你的優勢是什麼？" },
    { en: "Why do you want this job?", zh: "你為什麼想要這份工作？" },
    { en: "Do you have any questions for me?", zh: "你有什麼問題要問我嗎？" },
    { en: "What is your greatest weakness?", zh: "你最大的缺點是什麼？" },
    { en: "Why should we hire you?", zh: "我們為什麼應該僱用你？" },
    { en: "Where do you see yourself in five years?", zh: "你五年後想成為什麼樣子？" },
    { en: "Can you describe your work experience?", zh: "可以描述一下你的工作經驗嗎？" },
    { en: "What motivates you at work?", zh: "什麼激勵你努力工作？" },
    { en: "Thank you for this opportunity.", zh: "謝謝你給我這個機會。" },
  ],
  social: [
    { en: "What do you do for fun?", zh: "你平常喜歡做什麼？" },
    { en: "Want to hang out this weekend?", zh: "這週末要不要出來？" },
    { en: "How do you know each other?", zh: "你們怎麼認識的？" },
    { en: "Let's keep in touch.", zh: "我們保持聯絡吧。" },
    { en: "What kind of music do you like?", zh: "你喜歡什麼樣的音樂？" },
    { en: "Have you seen any good movies lately?", zh: "你最近有看什麼好電影嗎？" },
    { en: "Let's grab lunch sometime.", zh: "我們找時間一起吃午餐吧。" },
    { en: "It was great meeting you.", zh: "很高興認識你。" },
    { en: "Do you want to join us?", zh: "你想加入我們嗎？" },
    { en: "Have a wonderful weekend.", zh: "祝你有美好的週末。" },
  ],
  phone: [
    { en: "Can I leave a message?", zh: "我可以留言嗎？" },
    { en: "Could you hold on a second?", zh: "可以稍等一下嗎？" },
    { en: "Could you repeat that, please?", zh: "可以再說一次嗎？" },
    { en: "I'll call back later.", zh: "我晚點會再打來。" },
    { en: "May I ask who's calling?", zh: "請問是哪位來電？" },
    { en: "Could you spell your name, please?", zh: "可以拼一下你的名字嗎？" },
    { en: "I'm sorry, the line is busy.", zh: "不好意思，線路忙線中。" },
    { en: "Thank you for calling.", zh: "謝謝你的來電。" },
    { en: "Let me transfer your call.", zh: "我幫你轉接電話。" },
    { en: "Have a nice day.", zh: "祝你有美好的一天。" },
  ],
  exam: [
    { en: "Choose the best answer.", zh: "選出最佳答案。" },
    { en: "Read the question carefully.", zh: "仔細讀題。" },
    { en: "Check each option before deciding.", zh: "決定前先檢查每個選項。" },
    { en: "Manage your time wisely.", zh: "妥善管理你的時間。" },
    { en: "Underline the key words.", zh: "把關鍵字劃線。" },
    { en: "Eliminate the wrong choices first.", zh: "先刪除錯誤的選項。" },
    { en: "Review your answers before submitting.", zh: "提交前檢查你的答案。" },
    { en: "Stay calm during the test.", zh: "考試時保持冷靜。" },
    { en: "Practice makes perfect.", zh: "熟能生巧。" },
    { en: "Focus on one question at a time.", zh: "一次專注一題。" },
  ],
};

// Picks a rotating 4-sentence window from a theme's full pattern pool, offset
// by the scene's index within its theme, so consecutive scenes shift through
// different (overlapping) sentences instead of every scene in a theme
// showing the exact same fixed set.
function pickRotatingPatterns(pool: { en: string; zh: string }[], sceneIndex: number): { en: string; zh: string }[] {
  const windowSize = Math.min(4, pool.length);
  const step = 2;
  const start = (sceneIndex * step) % pool.length;
  return Array.from({ length: windowSize }, (_, k) => pool[(start + k) % pool.length]);
}

function buildDialogue(themeId: string, name: string): DialogueLine[] {
  switch (themeId) {
    case "daily":
      if (name.includes("問路")) {
        return [
          { speaker: "tutor", en: "Excuse me, you seem a bit lost. Are you looking for somewhere?", zh: "不好意思，你看起來有點迷路。你在找地方嗎？" },
          { speaker: "user", en: "Yes, I'm trying to find the nearest station.", zh: "對，我想找最近的車站。" },
          { speaker: "tutor", en: "You're close. Go straight for two blocks, then turn left.", zh: "你很近了。直走兩個街區，然後左轉。" },
          { speaker: "user", en: "Is it next to the market?", zh: "它在市場旁邊嗎？" },
          { speaker: "tutor", en: "Yes, it's across from the market entrance.", zh: "對，它在市場入口對面。" },
          { speaker: "user", en: "Great. How long does it take to walk there?", zh: "太好了。走路要多久？" },
          { speaker: "tutor", en: "About eight minutes. Keep the park on your right.", zh: "大約八分鐘。讓公園保持在你的右手邊。" },
          { speaker: "user", en: "Thank you. That helps a lot.", zh: "謝謝你，這幫了我很多。" },
          { speaker: "tutor", en: "You're welcome. If you reach the bridge, you've gone too far.", zh: "不客氣。如果你走到橋那邊，就是走太遠了。" },
          { speaker: "user", en: "Got it. I'll turn before the bridge.", zh: "了解。我會在橋前轉彎。" },
          { speaker: "tutor", en: "Exactly. Have a good walk.", zh: "沒錯。祝你走路順利。" },
        ];
      }
      return [
        { speaker: "tutor", en: "Hey, good to see you. You look a little rushed.", zh: "嘿，很高興看到你。你看起來有點趕。" },
        { speaker: "user", en: "Yeah, I have a few errands before lunch.", zh: "對，我午餐前有幾件事要辦。" },
        { speaker: "tutor", en: "No worries. Do you have a minute to chat?", zh: "沒關係。你有一分鐘可以聊一下嗎？" },
        { speaker: "user", en: "Sure, but I need to leave soon.", zh: "可以，但我很快就得走。" },
        { speaker: "tutor", en: "How has your morning been so far?", zh: "你今天早上到目前為止過得如何？" },
        { speaker: "user", en: "Pretty good, just busier than usual.", zh: "還不錯，只是比平常忙。" },
        { speaker: "tutor", en: "Anything fun planned for later?", zh: "晚點有安排什麼有趣的事嗎？" },
        { speaker: "user", en: "I might meet a friend after work.", zh: "我下班後可能會見朋友。" },
        { speaker: "tutor", en: "Nice. Do you want to grab coffee before you go?", zh: "不錯。你走之前要不要買杯咖啡？" },
        { speaker: "user", en: "That sounds good. I could use one.", zh: "聽起來不錯，我正需要一杯。" },
        { speaker: "tutor", en: "Great, I'll walk with you for a bit.", zh: "太好了，我陪你走一段。" },
        { speaker: "user", en: "Thanks, I appreciate the company.", zh: "謝謝，有人陪真好。" },
        { speaker: "tutor", en: "Of course. Tell me what else is on your list.", zh: "當然。跟我說說你還要辦哪些事。" },
      ];
    case "travel":
      return [
        { speaker: "tutor", en: "Excuse me, you seem a bit lost. Are you looking for somewhere?", zh: "不好意思，你看起來有點迷路。你在找地方嗎？" },
        { speaker: "user", en: "Yes, I'm trying to get to the old town station.", zh: "對，我想去舊城車站。" },
        { speaker: "tutor", en: "You're close. It's about a ten-minute walk from here.", zh: "你很近了，從這裡走路大約十分鐘。" },
        { speaker: "user", en: "Great. Is it easier to walk or take a bus?", zh: "太好了。走路比較方便還是搭公車？" },
        { speaker: "tutor", en: "Walking is easier. Go straight and turn right at the pharmacy.", zh: "走路比較方便。直走，看到藥局右轉。" },
        { speaker: "user", en: "Got it. Is the station on the left?", zh: "了解。車站是在左邊嗎？" },
        { speaker: "tutor", en: "Yes, you'll see a blue sign above the entrance.", zh: "對，你會看到入口上方有一個藍色招牌。" },
        { speaker: "user", en: "Thank you. I was worried I had gone the wrong way.", zh: "謝謝。我剛剛還擔心走錯方向。" },
        { speaker: "tutor", en: "No problem. Do you already have a ticket?", zh: "沒問題。你已經有票了嗎？" },
        { speaker: "user", en: "Not yet. I'll buy one at the station.", zh: "還沒有。我會到車站買。" },
        { speaker: "tutor", en: "The ticket machines have an English menu.", zh: "售票機有英文選單。" },
        { speaker: "user", en: "Perfect. That helps a lot.", zh: "太好了，這幫了我很多。" },
        { speaker: "tutor", en: "Have a good trip, and keep your map open.", zh: "祝你旅途順利，地圖記得開著。" },
      ];
    case "airport":
      return [
        { speaker: "tutor", en: "Good afternoon. May I see your passport and booking, please?", zh: "午安。可以看您的護照和訂位資料嗎？" },
        { speaker: "user", en: "Sure, here are my passport and confirmation email.", zh: "可以，這是我的護照和確認信。" },
        { speaker: "tutor", en: "Thank you. Are you checking any luggage today?", zh: "謝謝。今天有行李要託運嗎？" },
        { speaker: "user", en: "Yes, just this one suitcase.", zh: "有，只有這個行李箱。" },
        { speaker: "tutor", en: "Please place it on the scale. It is within the limit.", zh: "請放到秤上。重量在限制內。" },
        { speaker: "user", en: "Great. Could I have an aisle seat if possible?", zh: "太好了。如果可以，我能坐走道位嗎？" },
        { speaker: "tutor", en: "Let me check. Yes, I can move you to 18C.", zh: "我查一下。可以，我幫您換到 18C。" },
        { speaker: "user", en: "Thank you. What time does boarding start?", zh: "謝謝。什麼時候開始登機？" },
        { speaker: "tutor", en: "Boarding starts at 2:20 at gate B6.", zh: "下午 2:20 在 B6 登機門開始登機。" },
        { speaker: "user", en: "Is security straight ahead?", zh: "安檢是在前面直走嗎？" },
        { speaker: "tutor", en: "Yes, straight ahead, then follow the signs for B gates.", zh: "對，直走，然後跟著 B 登機門指標走。" },
        { speaker: "user", en: "Perfect. Thanks for your help.", zh: "太好了，謝謝你的協助。" },
        { speaker: "tutor", en: "You're welcome. Have a safe flight.", zh: "不客氣，祝您飛行順利。" },
      ];
    case "shopping":
      return [
        { speaker: "tutor", en: "Hi there. Let me know if you need a different size.", zh: "您好，如果需要別的尺寸可以跟我說。" },
        { speaker: "user", en: "Thanks. I like this shirt, but it looks a little small.", zh: "謝謝。我喜歡這件襯衫，但看起來有點小。" },
        { speaker: "tutor", en: "I can check the stockroom. What size do you usually wear?", zh: "我可以去倉庫查。你平常穿什麼尺寸？" },
        { speaker: "user", en: "Usually a medium, but this brand runs small.", zh: "通常穿中號，但這個牌子版型偏小。" },
        { speaker: "tutor", en: "Then you may want a large. Would you like to try it on?", zh: "那你可能需要大號。想試穿看看嗎？" },
        { speaker: "user", en: "Yes, where is the fitting room?", zh: "想，試衣間在哪裡？" },
        { speaker: "tutor", en: "Right behind the mirror. I'll bring the large to you.", zh: "鏡子後面就是。我拿大號給你。" },
        { speaker: "user", en: "Thanks. Also, is this on sale today?", zh: "謝謝。另外，這件今天有特價嗎？" },
        { speaker: "tutor", en: "Yes, it's twenty percent off with a member account.", zh: "有，會員帳號可以打八折。" },
        { speaker: "user", en: "Great. If it fits, I'll take it.", zh: "太好了。如果合身，我就買。" },
        { speaker: "tutor", en: "Sounds good. I can hold it at the counter for you.", zh: "好的。我可以先幫你放在櫃台。" },
        { speaker: "user", en: "That would be helpful, thank you.", zh: "那很有幫助，謝謝。" },
        { speaker: "tutor", en: "Of course. Take your time.", zh: "當然，慢慢來。" },
      ];
    case "work":
      return [
        { speaker: "tutor", en: "Morning. Do you have a minute to go over the client update?", zh: "早。你有一分鐘可以看一下客戶更新嗎？" },
        { speaker: "user", en: "Yes, I just finished the report draft.", zh: "可以，我剛完成報告草稿。" },
        { speaker: "tutor", en: "Great. What's the biggest issue right now?", zh: "很好。目前最大的問題是什麼？" },
        { speaker: "user", en: "The timeline is tight, but the scope is clear.", zh: "時程很緊，但範圍很清楚。" },
        { speaker: "tutor", en: "Can we still send the proposal by Friday?", zh: "我們週五前還能寄出提案嗎？" },
        { speaker: "user", en: "Yes, if design sends the final images by tomorrow.", zh: "可以，只要設計明天前給我們最後圖片。" },
        { speaker: "tutor", en: "I'll follow up with them after lunch.", zh: "我午餐後會跟他們追進度。" },
        { speaker: "user", en: "Thanks. I'll update the schedule and share it with the team.", zh: "謝謝。我會更新時程表並分享給團隊。" },
        { speaker: "tutor", en: "Please add one short risk note for the client.", zh: "請加一段簡短的風險說明給客戶。" },
        { speaker: "user", en: "Got it. I'll keep it clear and polite.", zh: "了解。我會寫得清楚又禮貌。" },
        { speaker: "tutor", en: "Perfect. Let's check it again at three.", zh: "太好了。我們三點再確認一次。" },
        { speaker: "user", en: "Works for me. I'll be ready.", zh: "我可以。到時我會準備好。" },
        { speaker: "tutor", en: "Thanks. This should keep the project moving.", zh: "謝謝。這樣專案應該能繼續推進。" },
      ];
    case "interview":
      return [
        { speaker: "tutor", en: "Thanks for coming in today. Did you find the office okay?", zh: "謝謝你今天過來。辦公室還好找嗎？" },
        { speaker: "user", en: "Yes, thank you. The directions were very clear.", zh: "有，謝謝。路線說明很清楚。" },
        { speaker: "tutor", en: "Great. Could you start by telling me a little about yourself?", zh: "很好。可以先簡單介紹一下自己嗎？" },
        { speaker: "user", en: "Sure. I have two years of customer service experience.", zh: "可以。我有兩年的客服經驗。" },
        { speaker: "tutor", en: "What kind of customers did you usually support?", zh: "你通常協助哪類客戶？" },
        { speaker: "user", en: "Mostly online shoppers who needed order or refund help.", zh: "主要是需要訂單或退款協助的網購客戶。" },
        { speaker: "tutor", en: "That sounds relevant. What would your manager say is your strength?", zh: "這很相關。你的主管會說你的優勢是什麼？" },
        { speaker: "user", en: "She would say I stay calm and explain things clearly.", zh: "她會說我能保持冷靜，而且解釋事情很清楚。" },
        { speaker: "tutor", en: "Can you give me a quick example?", zh: "可以給我一個簡短例子嗎？" },
        { speaker: "user", en: "Last month, I helped an angry customer solve a delivery problem.", zh: "上個月，我協助一位生氣的客戶解決配送問題。" },
        { speaker: "tutor", en: "Nice. Why are you interested in this role?", zh: "不錯。你為什麼對這個職位有興趣？" },
        { speaker: "user", en: "I want to grow in a team that values clear communication.", zh: "我想在重視清楚溝通的團隊中成長。" },
        { speaker: "tutor", en: "Thank you. That's a strong answer.", zh: "謝謝，這是很有力的回答。" },
      ];
    case "social":
      return [
        { speaker: "tutor", en: "Hey, I don't think we've met. I'm Maya.", zh: "嘿，我們應該還沒見過。我是 Maya。" },
        { speaker: "user", en: "Nice to meet you, Maya. I'm Alex.", zh: "很高興認識你，Maya。我是 Alex。" },
        { speaker: "tutor", en: "Nice to meet you too. How do you know Jason?", zh: "我也很高興認識你。你怎麼認識 Jason 的？" },
        { speaker: "user", en: "We used to work together at a small cafe.", zh: "我們以前在一家小咖啡店一起工作。" },
        { speaker: "tutor", en: "Oh, that's fun. Do you still work in food service?", zh: "喔，那很有趣。你現在還做餐飲服務嗎？" },
        { speaker: "user", en: "No, now I work in marketing.", zh: "沒有，現在我做行銷。" },
        { speaker: "tutor", en: "Cool. What do you like to do outside of work?", zh: "很酷。你工作之外喜歡做什麼？" },
        { speaker: "user", en: "I like movies, live music, and trying new restaurants.", zh: "我喜歡電影、現場音樂和嘗試新餐廳。" },
        { speaker: "tutor", en: "Same here. There's a jazz night downtown this Friday.", zh: "我也是。市中心這週五有爵士樂夜。" },
        { speaker: "user", en: "That sounds great. Are you going?", zh: "聽起來很棒。你會去嗎？" },
        { speaker: "tutor", en: "I might. Want me to send you the details?", zh: "可能會。要我把資訊傳給你嗎？" },
        { speaker: "user", en: "Sure, that would be great.", zh: "好啊，那太好了。" },
        { speaker: "tutor", en: "Perfect. Let's exchange numbers before we leave.", zh: "太好了。離開前我們交換電話吧。" },
      ];
    case "phone":
      return [
        { speaker: "tutor", en: "Good morning, Green Dental Clinic. This is Emma speaking.", zh: "早安，Green 牙科診所，我是 Emma。" },
        { speaker: "user", en: "Hi, I'd like to make an appointment.", zh: "你好，我想預約。" },
        { speaker: "tutor", en: "Of course. Is this for a cleaning or a specific problem?", zh: "當然。是洗牙還是有特定問題？" },
        { speaker: "user", en: "I have a toothache, so I'd like to see a dentist soon.", zh: "我牙痛，所以想盡快看牙醫。" },
        { speaker: "tutor", en: "I'm sorry to hear that. Are you available tomorrow afternoon?", zh: "很抱歉聽到這樣。你明天下午有空嗎？" },
        { speaker: "user", en: "Yes, after three would work for me.", zh: "有，三點後我可以。" },
        { speaker: "tutor", en: "We have 3:30 with Dr. Lee. Would that be okay?", zh: "李醫師 3:30 有空。這時間可以嗎？" },
        { speaker: "user", en: "Yes, that works. Do you need my phone number?", zh: "可以。你需要我的電話嗎？" },
        { speaker: "tutor", en: "Yes, please, and could you spell your last name?", zh: "需要，另外可以拼一下你的姓氏嗎？" },
        { speaker: "user", en: "Sure. My number is 555-1234, and my last name is Chen.", zh: "可以。我的電話是 555-1234，姓 Chen。" },
        { speaker: "tutor", en: "Thanks. You're booked for tomorrow at 3:30.", zh: "謝謝。已幫你預約明天 3:30。" },
        { speaker: "user", en: "Thank you. I'll be there.", zh: "謝謝，我會到。" },
        { speaker: "tutor", en: "You're welcome. Please arrive ten minutes early.", zh: "不客氣。請提前十分鐘到。" },
      ];
    case "exam":
      return [
        { speaker: "tutor", en: "You have ninety seconds for this question. Read the first sentence.", zh: "這題你有九十秒。先讀第一句。" },
        { speaker: "user", en: "Okay, the first sentence gives the topic.", zh: "好，第一句給了主題。" },
        { speaker: "tutor", en: "Good. What is the writer mainly talking about?", zh: "很好。作者主要在談什麼？" },
        { speaker: "user", en: "The writer is talking about a change in travel habits.", zh: "作者在談旅遊習慣的改變。" },
        { speaker: "tutor", en: "Now check the answer choices. Which one is too broad?", zh: "現在看選項。哪一個太廣泛？" },
        { speaker: "user", en: "Choice A is too broad because it says all travelers.", zh: "A 選項太廣，因為它說所有旅客。" },
        { speaker: "tutor", en: "Exactly. Which choice matches the detail in line three?", zh: "沒錯。哪個選項符合第三行的細節？" },
        { speaker: "user", en: "Choice C matches the detail about cheaper tickets.", zh: "C 選項符合便宜票券的細節。" },
        { speaker: "tutor", en: "Before you choose, check for any negative words.", zh: "選之前，檢查是否有否定詞。" },
        { speaker: "user", en: "I don't see any negative words in the question.", zh: "我在題目裡沒有看到否定詞。" },
        { speaker: "tutor", en: "Then choose C and move on. Don't spend too long here.", zh: "那就選 C 然後往下走。不要在這題花太久。" },
        { speaker: "user", en: "Got it. I'll choose C and keep going.", zh: "了解。我會選 C 然後繼續。" },
        { speaker: "tutor", en: "Nice work. Your reasoning was clear.", zh: "做得好。你的推理很清楚。" },
      ];
    default:
      return [
        { speaker: "tutor", en: "Hi, thanks for coming in. What can I help you with today?", zh: "你好，謝謝你過來。今天需要什麼協助？" },
        { speaker: "user", en: "Hi, I need some help with this situation.", zh: "你好，我需要協助處理這個狀況。" },
        { speaker: "tutor", en: "Of course. Tell me what's going on.", zh: "當然，跟我說發生什麼事。" },
        { speaker: "user", en: "Sure, the main issue is timing.", zh: "可以，主要問題是時間。" },
        { speaker: "tutor", en: "I see. What would you like to happen next?", zh: "我了解。你希望接下來怎麼處理？" },
        { speaker: "user", en: "I'd like to find a simple solution.", zh: "我想找到一個簡單的解決方法。" },
        { speaker: "tutor", en: "That makes sense. Let's look at your options.", zh: "有道理。我們來看你的選項。" },
      ];
  }
}

function buildQuiz(patterns: { en: string; zh: string }[]): QuizItem[] {
  const p = patterns.length >= 2 ? patterns : themePatterns.daily;
  return [
    { question: "下列哪一句適合此情境？", options: ["Random words.", p[0].en, "No talk here.", "Go away now."], answerIndex: 1, explanation: "句型：" + p[0].zh },
    { question: "「" + p[1].zh + "」的英文是？", options: [p[1].en, "I am fine thanks.", "Where is bank?", "See you later."], answerIndex: 0, explanation: "正確句型為 " + p[1].en },
  ];
}

const MIN_USER_PRACTICE_TURNS = 6;

const practiceFollowUps: Record<string, { tutor: DialogueLine; user: DialogueLine }[]> = {
  cafe: [
    {
      tutor: { speaker: "tutor", en: "Would you like anything else with that?", zh: "還需要搭配其他的嗎？" },
      user: { speaker: "user", en: "No, that's all for now, thank you.", zh: "不用，目前就這些，謝謝。" },
    },
    {
      tutor: { speaker: "tutor", en: "Can I have your name for the order?", zh: "可以留您的名字做訂單嗎？" },
      user: { speaker: "user", en: "Sure, my name is Alex.", zh: "可以，我叫 Alex。" },
    },
    {
      tutor: { speaker: "tutor", en: "Your order will be ready in five minutes.", zh: "您的餐點五分鐘後會好。" },
      user: { speaker: "user", en: "Great, I'll wait over there.", zh: "太好了，我會在那邊等。" },
    },
  ],
  daily: [
    {
      tutor: { speaker: "tutor", en: "How has your day been so far?", zh: "你今天到目前為止過得如何？" },
      user: { speaker: "user", en: "It's been good, but a little busy.", zh: "還不錯，不過有點忙。" },
    },
    {
      tutor: { speaker: "tutor", en: "What are you planning to do later?", zh: "你晚點打算做什麼？" },
      user: { speaker: "user", en: "I'm going to study English and rest.", zh: "我要讀英文然後休息。" },
    },
    {
      tutor: { speaker: "tutor", en: "That sounds nice. Who do you usually talk with?", zh: "聽起來不錯。你通常和誰聊天？" },
      user: { speaker: "user", en: "I usually talk with my friends or family.", zh: "我通常和朋友或家人聊天。" },
    },
  ],
  travel: [
    {
      tutor: { speaker: "tutor", en: "Do you need a map or directions?", zh: "你需要地圖或方向指引嗎？" },
      user: { speaker: "user", en: "Yes, could you show me the way?", zh: "需要，可以告訴我怎麼走嗎？" },
    },
    {
      tutor: { speaker: "tutor", en: "Would you rather take a bus or a taxi?", zh: "你比較想搭公車還是計程車？" },
      user: { speaker: "user", en: "I'd rather take a bus if it is not too far.", zh: "如果不太遠，我比較想搭公車。" },
    },
    {
      tutor: { speaker: "tutor", en: "The stop is two blocks from here.", zh: "站牌離這裡兩個街區。" },
      user: { speaker: "user", en: "Thank you. I'll walk there now.", zh: "謝謝，我現在走過去。" },
    },
  ],
  airport: [
    {
      tutor: { speaker: "tutor", en: "May I see your passport and ticket?", zh: "可以看您的護照和機票嗎？" },
      user: { speaker: "user", en: "Sure, here they are.", zh: "可以，這是我的證件。" },
    },
    {
      tutor: { speaker: "tutor", en: "Do you have any luggage to check?", zh: "您有行李要託運嗎？" },
      user: { speaker: "user", en: "Yes, I have one suitcase to check.", zh: "有，我有一個行李箱要託運。" },
    },
    {
      tutor: { speaker: "tutor", en: "Your boarding gate is on the left.", zh: "您的登機門在左邊。" },
      user: { speaker: "user", en: "Thank you. What time does boarding start?", zh: "謝謝，什麼時候開始登機？" },
    },
  ],
  shopping: [
    {
      tutor: { speaker: "tutor", en: "Are you looking for a specific size?", zh: "您在找特定尺寸嗎？" },
      user: { speaker: "user", en: "Yes, do you have this in medium?", zh: "有，這件有中號嗎？" },
    },
    {
      tutor: { speaker: "tutor", en: "Would you like to try it on?", zh: "您想試穿看看嗎？" },
      user: { speaker: "user", en: "Yes, where is the fitting room?", zh: "想，試衣間在哪裡？" },
    },
    {
      tutor: { speaker: "tutor", en: "It is on sale today.", zh: "今天有特價。" },
      user: { speaker: "user", en: "Great. I'll pay by card.", zh: "太好了，我刷卡付款。" },
    },
  ],
  work: [
    {
      tutor: { speaker: "tutor", en: "Could you give us a quick update?", zh: "可以快速回報一下進度嗎？" },
      user: { speaker: "user", en: "Sure, the project is on schedule.", zh: "可以，專案進度正常。" },
    },
    {
      tutor: { speaker: "tutor", en: "What is the next deadline?", zh: "下一個截止日是什麼時候？" },
      user: { speaker: "user", en: "The next deadline is Friday afternoon.", zh: "下一個截止日是週五下午。" },
    },
    {
      tutor: { speaker: "tutor", en: "Please send the report after the meeting.", zh: "會後請寄報告。" },
      user: { speaker: "user", en: "No problem. I'll send it today.", zh: "沒問題，我今天會寄。" },
    },
  ],
  interview: [
    {
      tutor: { speaker: "tutor", en: "Can you tell me about your experience?", zh: "可以談談你的經驗嗎？" },
      user: { speaker: "user", en: "I have two years of customer service experience.", zh: "我有兩年的客服經驗。" },
    },
    {
      tutor: { speaker: "tutor", en: "What is one of your strengths?", zh: "你的其中一個優勢是什麼？" },
      user: { speaker: "user", en: "One of my strengths is communication.", zh: "我的其中一個優勢是溝通。" },
    },
    {
      tutor: { speaker: "tutor", en: "Why are you interested in this position?", zh: "你為什麼對這個職位有興趣？" },
      user: { speaker: "user", en: "I want to grow with a strong team.", zh: "我想和強大的團隊一起成長。" },
    },
  ],
  social: [
    {
      tutor: { speaker: "tutor", en: "What do you like to do on weekends?", zh: "你週末喜歡做什麼？" },
      user: { speaker: "user", en: "I like watching movies and trying new food.", zh: "我喜歡看電影和嘗試新食物。" },
    },
    {
      tutor: { speaker: "tutor", en: "Do you want to hang out sometime?", zh: "你想找時間出去嗎？" },
      user: { speaker: "user", en: "Sure, that sounds fun.", zh: "好啊，聽起來很有趣。" },
    },
    {
      tutor: { speaker: "tutor", en: "Let's exchange contact information.", zh: "我們交換聯絡方式吧。" },
      user: { speaker: "user", en: "Good idea. Here is my number.", zh: "好主意，這是我的電話。" },
    },
  ],
  phone: [
    {
      tutor: { speaker: "tutor", en: "May I ask who is calling?", zh: "請問是哪位來電？" },
      user: { speaker: "user", en: "This is Alex from the sales team.", zh: "我是業務團隊的 Alex。" },
    },
    {
      tutor: { speaker: "tutor", en: "Would you like to leave a message?", zh: "您想留言嗎？" },
      user: { speaker: "user", en: "Yes, please ask her to call me back.", zh: "想，請她回電給我。" },
    },
    {
      tutor: { speaker: "tutor", en: "Could you repeat your phone number?", zh: "可以再說一次您的電話嗎？" },
      user: { speaker: "user", en: "Sure, it's 555-1234.", zh: "可以，是 555-1234。" },
    },
  ],
  exam: [
    {
      tutor: { speaker: "tutor", en: "Read the question carefully before choosing.", zh: "作答前請仔細讀題。" },
      user: { speaker: "user", en: "Okay, I'll look for the key words first.", zh: "好的，我會先找關鍵字。" },
    },
    {
      tutor: { speaker: "tutor", en: "What is the main idea of the passage?", zh: "文章主旨是什麼？" },
      user: { speaker: "user", en: "The main idea is about travel planning.", zh: "主旨是關於旅遊規劃。" },
    },
    {
      tutor: { speaker: "tutor", en: "Which answer best matches the context?", zh: "哪個答案最符合上下文？" },
      user: { speaker: "user", en: "I think choice B matches the context best.", zh: "我認為 B 選項最符合上下文。" },
    },
  ],
  "level-a1": [
    {
      tutor: { speaker: "tutor", en: "Can you say that again, please?", zh: "可以請你再說一次嗎？" },
      user: { speaker: "user", en: "Sure. I would like this, please.", zh: "可以。我想要這個，謝謝。" },
    },
    {
      tutor: { speaker: "tutor", en: "Is that for here or to go?", zh: "這是內用還是外帶？" },
      user: { speaker: "user", en: "To go, please.", zh: "外帶，謝謝。" },
    },
    {
      tutor: { speaker: "tutor", en: "Anything else today?", zh: "今天還需要其他的嗎？" },
      user: { speaker: "user", en: "No, thank you.", zh: "不用，謝謝。" },
    },
  ],
  "level-a2": [
    {
      tutor: { speaker: "tutor", en: "What time works for you?", zh: "你什麼時間方便？" },
      user: { speaker: "user", en: "Tomorrow morning works for me.", zh: "明天早上我方便。" },
    },
    {
      tutor: { speaker: "tutor", en: "Do you need directions?", zh: "你需要方向指引嗎？" },
      user: { speaker: "user", en: "Yes, please tell me how to get there.", zh: "需要，請告訴我怎麼到那裡。" },
    },
    {
      tutor: { speaker: "tutor", en: "Would you like me to write it down?", zh: "你需要我寫下來嗎？" },
      user: { speaker: "user", en: "Yes, that would help a lot.", zh: "好，那會很有幫助。" },
    },
  ],
  "level-b1": [
    {
      tutor: { speaker: "tutor", en: "What seems to be the problem?", zh: "看起來問題是什麼？" },
      user: { speaker: "user", en: "The main problem is the timing.", zh: "主要問題是時間。" },
    },
    {
      tutor: { speaker: "tutor", en: "What would you prefer to do?", zh: "你比較希望怎麼做？" },
      user: { speaker: "user", en: "I would prefer to reschedule it.", zh: "我比較希望重新安排時間。" },
    },
    {
      tutor: { speaker: "tutor", en: "Can you explain your reason briefly?", zh: "你可以簡短說明原因嗎？" },
      user: { speaker: "user", en: "Sure. The new time is easier for my team.", zh: "可以。新的時間對我的團隊比較方便。" },
    },
  ],
  "level-b2": [
    {
      tutor: { speaker: "tutor", en: "What outcome are you hoping for?", zh: "你希望達成什麼結果？" },
      user: { speaker: "user", en: "I'm hoping we can find a fair compromise.", zh: "我希望我們能找到公平的折衷方案。" },
    },
    {
      tutor: { speaker: "tutor", en: "Which part is the most urgent?", zh: "哪個部分最急迫？" },
      user: { speaker: "user", en: "The deadline is the most urgent part.", zh: "截止時間是最急迫的部分。" },
    },
    {
      tutor: { speaker: "tutor", en: "How should we explain this to the client?", zh: "我們應該怎麼向客戶說明？" },
      user: { speaker: "user", en: "We should be honest and offer a clear next step.", zh: "我們應該誠實說明並提出清楚的下一步。" },
    },
  ],
  "level-c1": [
    {
      tutor: { speaker: "tutor", en: "How would you frame the issue diplomatically?", zh: "你會如何有技巧地包裝這個問題？" },
      user: { speaker: "user", en: "I would focus on the shared goal before raising the concern.", zh: "我會先聚焦共同目標，再提出疑慮。" },
    },
    {
      tutor: { speaker: "tutor", en: "What trade-off are you willing to accept?", zh: "你願意接受什麼取捨？" },
      user: { speaker: "user", en: "I can accept a longer timeline if the quality stays high.", zh: "如果品質維持高水準，我可以接受較長時程。" },
    },
    {
      tutor: { speaker: "tutor", en: "How can we make the proposal more convincing?", zh: "我們如何讓提案更有說服力？" },
      user: { speaker: "user", en: "We can support it with data and a practical example.", zh: "我們可以用數據和實際例子支持它。" },
    },
  ],
};

const defaultFollowUps = [
  {
    tutor: { speaker: "tutor" as const, en: "Could you tell me a little more?", zh: "可以多告訴我一點嗎？" },
    user: { speaker: "user" as const, en: "Sure, let me explain my situation.", zh: "可以，讓我說明一下我的狀況。" },
  },
  {
    tutor: { speaker: "tutor" as const, en: "What would you like to do next?", zh: "你接下來想怎麼做？" },
    user: { speaker: "user" as const, en: "I'd like to keep practicing this topic.", zh: "我想繼續練習這個主題。" },
  },
];

function bridgeAnswer(lastTutor: string): DialogueLine {
  const lower = lastTutor.toLowerCase();
  if (lower.includes("name")) return { speaker: "user", en: "Sure, my name is Alex.", zh: "可以，我叫 Alex。" };
  if (lower.includes("anything else")) return { speaker: "user", en: "No, that's all for now, thank you.", zh: "不用，目前就這些，謝謝。" };
  if (lower.includes("how sweet")) return { speaker: "user", en: "Half sugar, please.", zh: "半糖，謝謝。" };
  if (lower.includes("ice")) return { speaker: "user", en: "Less ice, please.", zh: "少冰，謝謝。" };
  if (lower.includes("how many")) return { speaker: "user", en: "For two people, please.", zh: "兩位，謝謝。" };
  if (lower.includes("cooked")) return { speaker: "user", en: "Medium, please.", zh: "五分熟，謝謝。" };
  if (lower.includes("ready to order")) return { speaker: "user", en: "Yes, I'd like to order now.", zh: "好，我現在想點餐。" };
  return { speaker: "user", en: "Sure, let me answer that.", zh: "可以，讓我回答一下。" };
}

function ensurePracticeDialogue(themeId: string, dialogue: DialogueLine[]): DialogueLine[] {
  const lines = [...dialogue];
  let userTurns = lines.filter((line) => line.speaker === "user").length;

  if (userTurns < MIN_USER_PRACTICE_TURNS && lines.at(-1)?.speaker === "tutor") {
    lines.push(bridgeAnswer(lines.at(-1)?.en || ""));
    userTurns += 1;
  }

  const followUps = practiceFollowUps[themeId] || defaultFollowUps;
  let i = 0;
  while (userTurns < MIN_USER_PRACTICE_TURNS) {
    const pair = followUps[i % followUps.length];
    if (lines.at(-1)?.speaker !== "tutor") lines.push(pair.tutor);
    lines.push(pair.user);
    userTurns += 1;
    i += 1;
  }

  if (lines.at(-1)?.speaker === "user") {
    lines.push({
      speaker: "tutor",
      en: "Excellent. You completed this practice round.",
      zh: "太好了，你完成這輪練習了。",
    });
  }

  return lines;
}

interface LevelSceneInput {
  id: string;
  themeId: string;
  name: string;
  enName: string;
  difficulty: EnglishLevel;
  minutes: number;
  words: string[];
  patterns: { en: string; zh: string }[];
  dialogue: DialogueLine[];
  intro?: string;
  goals?: string[];
}

function makeLevelScene(input: LevelSceneInput): Scene {
  return {
    id: input.id,
    themeId: input.themeId,
    name: input.name,
    enName: input.enName,
    intro: input.intro || `依照 ${input.difficulty} 程度練習「${input.name}」，從句型到回應都循序漸進。`,
    difficulty: input.difficulty,
    minutes: input.minutes,
    goals: input.goals || [`完成「${input.name}」角色對話`, "練熟本級別常用句", "能用自然句子回答導師"],
    keyWords: input.words,
    keyPatterns: input.patterns,
    dialogue: ensurePracticeDialogue(input.themeId, input.dialogue),
    quiz: buildQuiz(input.patterns),
  };
}

const levelScenes: Scene[] = [
  makeLevelScene({
    id: "level-a1-1",
    themeId: "level-a1",
    name: "打招呼與自我介紹",
    enName: "Greetings and Self-introduction",
    difficulty: "Beginner",
    minutes: 8,
    words: ["hello", "name", "from", "nice", "learn", "English"],
    patterns: [
      { en: "Hello, my name is Mina.", zh: "你好，我叫 Mina。" },
      { en: "Nice to meet you.", zh: "很高興認識你。" },
      { en: "I am from Taiwan.", zh: "我來自台灣。" },
      { en: "I am learning English.", zh: "我正在學英文。" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Hi! What's your name?", zh: "嗨！你叫什麼名字？" },
      { speaker: "user", en: "My name is Mina.", zh: "我叫 Mina。" },
      { speaker: "tutor", en: "Nice to meet you. Where are you from?", zh: "很高興認識你。你來自哪裡？" },
      { speaker: "user", en: "I'm from Taiwan.", zh: "我來自台灣。" },
      { speaker: "tutor", en: "Are you learning English?", zh: "你正在學英文嗎？" },
      { speaker: "user", en: "Yes, I am learning English.", zh: "是的，我正在學英文。" },
    ],
  }),
  makeLevelScene({
    id: "level-a1-2",
    themeId: "level-a1",
    name: "咖啡店點飲料",
    enName: "Ordering a Drink",
    difficulty: "Beginner",
    minutes: 8,
    words: ["coffee", "tea", "small", "medium", "iced", "please"],
    patterns: [
      { en: "I'd like an iced tea, please.", zh: "我想要一杯冰茶，謝謝。" },
      { en: "Can I get a medium coffee?", zh: "可以給我一杯中杯咖啡嗎？" },
      { en: "No sugar, please.", zh: "不要糖，謝謝。" },
      { en: "That's all, thank you.", zh: "就這樣，謝謝。" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Hi! What would you like?", zh: "嗨！你想要什麼？" },
      { speaker: "user", en: "I'd like an iced tea, please.", zh: "我想要一杯冰茶，謝謝。" },
      { speaker: "tutor", en: "What size would you like?", zh: "你想要什麼尺寸？" },
      { speaker: "user", en: "Medium, please.", zh: "中杯，謝謝。" },
      { speaker: "tutor", en: "Would you like sugar?", zh: "你要加糖嗎？" },
      { speaker: "user", en: "No sugar, please.", zh: "不要糖，謝謝。" },
    ],
  }),
  makeLevelScene({
    id: "level-a1-3",
    themeId: "level-a1",
    name: "商店買東西",
    enName: "Buying a Small Item",
    difficulty: "Beginner",
    minutes: 8,
    words: ["price", "buy", "card", "cash", "bag", "receipt"],
    patterns: [
      { en: "How much is this?", zh: "這個多少錢？" },
      { en: "I would like to buy this.", zh: "我想買這個。" },
      { en: "Can I pay by card?", zh: "我可以刷卡嗎？" },
      { en: "Can I have a bag, please?", zh: "可以給我一個袋子嗎？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Hello. Can I help you?", zh: "你好，需要幫忙嗎？" },
      { speaker: "user", en: "Yes. How much is this?", zh: "需要。這個多少錢？" },
      { speaker: "tutor", en: "It's ten dollars.", zh: "十美元。" },
      { speaker: "user", en: "I would like to buy this.", zh: "我想買這個。" },
      { speaker: "tutor", en: "Sure. Cash or card?", zh: "好的。現金還是刷卡？" },
      { speaker: "user", en: "Card, please.", zh: "刷卡，謝謝。" },
    ],
  }),
  makeLevelScene({
    id: "level-a2-1",
    themeId: "level-a2",
    name: "問路到車站",
    enName: "Asking the Way to the Station",
    difficulty: "Elementary",
    minutes: 10,
    words: ["station", "straight", "left", "right", "block", "near"],
    patterns: [
      { en: "Could you tell me how to get to the station?", zh: "可以告訴我怎麼到車站嗎？" },
      { en: "Go straight for two blocks.", zh: "直走兩個街區。" },
      { en: "Turn left at the corner.", zh: "在轉角左轉。" },
      { en: "Is it near here?", zh: "它離這裡近嗎？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Hi, you look a little lost. Where are you going?", zh: "嗨，你看起來有點迷路。你要去哪裡？" },
      { speaker: "user", en: "I'm looking for the station.", zh: "我在找車站。" },
      { speaker: "tutor", en: "It's close. Go straight for two blocks.", zh: "很近。直走兩個街區。" },
      { speaker: "user", en: "Do I turn left or right?", zh: "我要左轉還是右轉？" },
      { speaker: "tutor", en: "Turn left at the corner.", zh: "在轉角左轉。" },
      { speaker: "user", en: "Thank you. That's very helpful.", zh: "謝謝。這很有幫助。" },
    ],
  }),
  makeLevelScene({
    id: "level-a2-2",
    themeId: "level-a2",
    name: "電話預約時間",
    enName: "Booking an Appointment by Phone",
    difficulty: "Elementary",
    minutes: 10,
    words: ["appointment", "available", "tomorrow", "morning", "change", "confirm"],
    patterns: [
      { en: "I'd like to make an appointment.", zh: "我想預約。" },
      { en: "Are you available tomorrow morning?", zh: "你明天早上有空嗎？" },
      { en: "Could I change the time?", zh: "我可以更改時間嗎？" },
      { en: "Can you confirm the appointment?", zh: "你可以確認預約嗎？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Good morning. How can I help you?", zh: "早安。需要什麼協助？" },
      { speaker: "user", en: "I'd like to make an appointment.", zh: "我想預約。" },
      { speaker: "tutor", en: "Sure. Are you available tomorrow morning?", zh: "好的。你明天早上有空嗎？" },
      { speaker: "user", en: "Yes, tomorrow morning works for me.", zh: "有，明天早上我可以。" },
      { speaker: "tutor", en: "Great. Your appointment is at ten.", zh: "很好。你的預約是十點。" },
      { speaker: "user", en: "Thank you. Could you confirm it by email?", zh: "謝謝。可以用 email 確認嗎？" },
    ],
  }),
  makeLevelScene({
    id: "level-a2-3",
    themeId: "level-a2",
    name: "飯店入住確認",
    enName: "Checking in at a Hotel",
    difficulty: "Elementary",
    minutes: 10,
    words: ["reservation", "passport", "room", "breakfast", "key", "checkout"],
    patterns: [
      { en: "I have a reservation under Chen.", zh: "我有用 Chen 這個姓訂房。" },
      { en: "May I see your passport?", zh: "我可以看你的護照嗎？" },
      { en: "Is breakfast included?", zh: "早餐有包含嗎？" },
      { en: "What time is checkout?", zh: "退房時間是幾點？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Welcome. Do you have a reservation?", zh: "歡迎。你有訂房嗎？" },
      { speaker: "user", en: "Yes, I have a reservation under Chen.", zh: "有，我用 Chen 這個姓訂房。" },
      { speaker: "tutor", en: "May I see your passport?", zh: "可以看你的護照嗎？" },
      { speaker: "user", en: "Sure, here it is.", zh: "可以，這是我的護照。" },
      { speaker: "tutor", en: "Breakfast is included, and checkout is at eleven.", zh: "早餐有包含，退房是十一點。" },
      { speaker: "user", en: "Great. Thank you for your help.", zh: "太好了。謝謝你的協助。" },
    ],
  }),
  makeLevelScene({
    id: "level-b1-1",
    themeId: "level-b1",
    name: "看醫生描述症狀",
    enName: "Describing Symptoms",
    difficulty: "Intermediate",
    minutes: 12,
    words: ["symptom", "fever", "headache", "cough", "medicine", "rest"],
    patterns: [
      { en: "I've had a fever since yesterday.", zh: "我從昨天開始發燒。" },
      { en: "My throat hurts when I swallow.", zh: "我吞嚥時喉嚨會痛。" },
      { en: "Do I need to take any medicine?", zh: "我需要吃藥嗎？" },
      { en: "How long should I rest?", zh: "我應該休息多久？" },
    ],
    dialogue: [
      { speaker: "tutor", en: "What brings you in today?", zh: "你今天哪裡不舒服？" },
      { speaker: "user", en: "I've had a fever since yesterday.", zh: "我從昨天開始發燒。" },
      { speaker: "tutor", en: "Do you have any other symptoms?", zh: "還有其他症狀嗎？" },
      { speaker: "user", en: "Yes, my throat hurts when I swallow.", zh: "有，我吞嚥時喉嚨會痛。" },
      { speaker: "tutor", en: "I'll check your throat first.", zh: "我先檢查你的喉嚨。" },
      { speaker: "user", en: "Okay. Do I need to take any medicine?", zh: "好。我需要吃藥嗎？" },
    ],
  }),
  makeLevelScene({
    id: "level-b1-2",
    themeId: "level-b1",
    name: "安排小組計畫",
    enName: "Planning a Group Project",
    difficulty: "Intermediate",
    minutes: 12,
    words: ["project", "deadline", "task", "schedule", "progress", "share"],
    patterns: [
      { en: "Let's divide the tasks clearly.", zh: "我們把任務清楚分配吧。" },
      { en: "I can finish my part by Friday.", zh: "我可以在週五前完成我的部分。" },
      { en: "Could you update the schedule?", zh: "你可以更新時程表嗎？" },
      { en: "We should check our progress tomorrow.", zh: "我們明天應該確認進度。" },
    ],
    dialogue: [
      { speaker: "tutor", en: "We need to plan the project. Any ideas?", zh: "我們需要規劃專案。有想法嗎？" },
      { speaker: "user", en: "Let's divide the tasks clearly.", zh: "我們把任務清楚分配吧。" },
      { speaker: "tutor", en: "Good. When can you finish your part?", zh: "很好。你什麼時候能完成你的部分？" },
      { speaker: "user", en: "I can finish my part by Friday.", zh: "我可以在週五前完成我的部分。" },
      { speaker: "tutor", en: "I'll update the schedule.", zh: "我會更新時程表。" },
      { speaker: "user", en: "Great. We should check our progress tomorrow.", zh: "太好了。我們明天應該確認進度。" },
    ],
  }),
  makeLevelScene({
    id: "level-b1-3",
    themeId: "level-b1",
    name: "禮貌表達不同意",
    enName: "Disagreeing Politely",
    difficulty: "Intermediate",
    minutes: 12,
    words: ["agree", "concern", "suggest", "option", "reason", "solution"],
    patterns: [
      { en: "I see your point, but I have a concern.", zh: "我理解你的觀點，但我有一個疑慮。" },
      { en: "Could we consider another option?", zh: "我們可以考慮另一個選項嗎？" },
      { en: "The main reason is the cost.", zh: "主要原因是成本。" },
      { en: "Maybe we can find a better solution.", zh: "也許我們可以找到更好的解決方案。" },
    ],
    dialogue: [
      { speaker: "tutor", en: "I think we should choose the fastest option.", zh: "我認為我們應該選最快的方案。" },
      { speaker: "user", en: "I see your point, but I have a concern.", zh: "我理解你的觀點，但我有一個疑慮。" },
      { speaker: "tutor", en: "What is your concern?", zh: "你的疑慮是什麼？" },
      { speaker: "user", en: "The main reason is the cost.", zh: "主要原因是成本。" },
      { speaker: "tutor", en: "What do you suggest instead?", zh: "你建議改成什麼？" },
      { speaker: "user", en: "Could we consider another option?", zh: "我們可以考慮另一個選項嗎？" },
    ],
  }),
  makeLevelScene({
    id: "level-b2-1",
    themeId: "level-b2",
    name: "客訴與補救方案",
    enName: "Handling a Complaint",
    difficulty: "Upper-Intermediate",
    minutes: 14,
    words: ["complaint", "mistake", "replace", "refund", "apologize", "resolve"],
    patterns: [
      { en: "I understand why this is frustrating.", zh: "我理解為什麼這件事令人沮喪。" },
      { en: "Let me check what went wrong.", zh: "讓我確認是哪裡出問題。" },
      { en: "We can offer a replacement or a refund.", zh: "我們可以提供更換或退款。" },
      { en: "I appreciate your patience while we resolve this.", zh: "感謝你在我們處理期間的耐心。" },
    ],
    dialogue: [
      { speaker: "tutor", en: "I'm not happy with this order. It arrived damaged.", zh: "我對這個訂單不滿意。它送來時損壞了。" },
      { speaker: "user", en: "I'm sorry about that. I understand why this is frustrating.", zh: "很抱歉。我理解為什麼這令人沮喪。" },
      { speaker: "tutor", en: "What can you do about it?", zh: "你們可以怎麼處理？" },
      { speaker: "user", en: "Let me check what went wrong first.", zh: "讓我先確認是哪裡出問題。" },
      { speaker: "tutor", en: "I need a solution today.", zh: "我今天需要解決方案。" },
      { speaker: "user", en: "We can offer a replacement or a refund.", zh: "我們可以提供更換或退款。" },
    ],
  }),
  makeLevelScene({
    id: "level-b2-2",
    themeId: "level-b2",
    name: "工作簡報開場",
    enName: "Opening a Work Presentation",
    difficulty: "Upper-Intermediate",
    minutes: 14,
    words: ["presentation", "agenda", "overview", "highlight", "recommendation", "question"],
    patterns: [
      { en: "Today, I'll give a brief overview of our progress.", zh: "今天我會簡短概述我們的進度。" },
      { en: "I'll start with the key results.", zh: "我會從關鍵結果開始。" },
      { en: "The main point I'd like to highlight is growth.", zh: "我想強調的重點是成長。" },
      { en: "I'll leave time for questions at the end.", zh: "最後我會保留時間讓大家提問。" },
    ],
    dialogue: [
      { speaker: "tutor", en: "You're presenting to the team today. How will you begin?", zh: "你今天要對團隊簡報。你會怎麼開始？" },
      { speaker: "user", en: "Today, I'll give a brief overview of our progress.", zh: "今天我會簡短概述我們的進度。" },
      { speaker: "tutor", en: "What will you cover first?", zh: "你會先講什麼？" },
      { speaker: "user", en: "I'll start with the key results.", zh: "我會從關鍵結果開始。" },
      { speaker: "tutor", en: "And what is the main point?", zh: "那主要重點是什麼？" },
      { speaker: "user", en: "The main point I'd like to highlight is growth.", zh: "我想強調的重點是成長。" },
    ],
  }),
  makeLevelScene({
    id: "level-b2-3",
    themeId: "level-b2",
    name: "協商截止時間",
    enName: "Negotiating a Deadline",
    difficulty: "Upper-Intermediate",
    minutes: 14,
    words: ["deadline", "priority", "timeline", "delay", "compromise", "quality"],
    patterns: [
      { en: "Given the current workload, Friday may be too tight.", zh: "以目前工作量來看，週五可能太趕。" },
      { en: "Could we extend the deadline by two days?", zh: "我們可以把截止日延後兩天嗎？" },
      { en: "That would help us maintain the quality.", zh: "那會幫助我們維持品質。" },
      { en: "I'm open to a compromise if needed.", zh: "如果需要，我願意接受折衷方案。" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Can your team deliver everything by Friday?", zh: "你的團隊能在週五前交付全部嗎？" },
      { speaker: "user", en: "Given the current workload, Friday may be too tight.", zh: "以目前工作量來看，週五可能太趕。" },
      { speaker: "tutor", en: "How much extra time do you need?", zh: "你需要多長的額外時間？" },
      { speaker: "user", en: "Could we extend the deadline by two days?", zh: "我們可以把截止日延後兩天嗎？" },
      { speaker: "tutor", en: "Why would that be better?", zh: "為什麼那樣比較好？" },
      { speaker: "user", en: "That would help us maintain the quality.", zh: "那會幫助我們維持品質。" },
    ],
  }),
  makeLevelScene({
    id: "level-c1-1",
    themeId: "level-c1",
    name: "策略會議提出取捨",
    enName: "Discussing Trade-offs in a Strategy Meeting",
    difficulty: "Advanced",
    minutes: 16,
    words: ["strategy", "trade-off", "constraint", "priority", "evidence", "impact"],
    patterns: [
      { en: "The key trade-off is speed versus long-term stability.", zh: "關鍵取捨是速度與長期穩定性。" },
      { en: "We need to prioritize the option with measurable impact.", zh: "我們需要優先選擇有可衡量影響的方案。" },
      { en: "The evidence suggests a phased rollout would reduce risk.", zh: "證據顯示分階段推出會降低風險。" },
      { en: "I would recommend revisiting the plan after the pilot.", zh: "我建議試行後再重新檢視計畫。" },
    ],
    dialogue: [
      { speaker: "tutor", en: "We have two strategies. How would you compare them?", zh: "我們有兩個策略。你會怎麼比較它們？" },
      { speaker: "user", en: "The key trade-off is speed versus long-term stability.", zh: "關鍵取捨是速度與長期穩定性。" },
      { speaker: "tutor", en: "Which option would you prioritize?", zh: "你會優先選哪個方案？" },
      { speaker: "user", en: "We need to prioritize the option with measurable impact.", zh: "我們需要優先選擇有可衡量影響的方案。" },
      { speaker: "tutor", en: "How can we reduce the risk?", zh: "我們如何降低風險？" },
      { speaker: "user", en: "The evidence suggests a phased rollout would reduce risk.", zh: "證據顯示分階段推出會降低風險。" },
    ],
  }),
  makeLevelScene({
    id: "level-c1-2",
    themeId: "level-c1",
    name: "給予敏感回饋",
    enName: "Giving Sensitive Feedback",
    difficulty: "Advanced",
    minutes: 16,
    words: ["feedback", "specific", "constructive", "impact", "align", "improve"],
    patterns: [
      { en: "I want to frame this feedback constructively.", zh: "我想用建設性的方式表達這個回饋。" },
      { en: "The intention was clear, but the message could be more specific.", zh: "意圖很清楚，但訊息可以更具體。" },
      { en: "This may help the team align more quickly.", zh: "這可能會幫助團隊更快對齊。" },
      { en: "Let's focus on what can be improved next time.", zh: "我們聚焦下次可以改善的地方吧。" },
    ],
    dialogue: [
      { speaker: "tutor", en: "You need to give feedback without discouraging the team.", zh: "你需要給回饋，但不能打擊團隊士氣。" },
      { speaker: "user", en: "I want to frame this feedback constructively.", zh: "我想用建設性的方式表達這個回饋。" },
      { speaker: "tutor", en: "What would you say first?", zh: "你會先說什麼？" },
      { speaker: "user", en: "The intention was clear, but the message could be more specific.", zh: "意圖很清楚，但訊息可以更具體。" },
      { speaker: "tutor", en: "Why does that matter?", zh: "為什麼這很重要？" },
      { speaker: "user", en: "This may help the team align more quickly.", zh: "這可能會幫助團隊更快對齊。" },
    ],
  }),
  makeLevelScene({
    id: "level-c1-3",
    themeId: "level-c1",
    name: "高階面試說服決策",
    enName: "Persuading in a Senior Interview",
    difficulty: "Advanced",
    minutes: 16,
    words: ["leadership", "decision", "stakeholder", "outcome", "initiative", "persuade"],
    patterns: [
      { en: "I led the initiative from planning to implementation.", zh: "我從規劃到執行主導了這個專案。" },
      { en: "The biggest challenge was aligning different stakeholders.", zh: "最大的挑戰是協調不同利害關係人。" },
      { en: "I persuaded the team by connecting the decision to business outcomes.", zh: "我透過把決策連結到商業成果來說服團隊。" },
      { en: "The result was a clearer process and faster execution.", zh: "結果是流程更清楚，執行更快。" },
    ],
    dialogue: [
      { speaker: "tutor", en: "Tell me about a time you led a difficult initiative.", zh: "請談談你曾經主導困難專案的經驗。" },
      { speaker: "user", en: "I led the initiative from planning to implementation.", zh: "我從規劃到執行主導了這個專案。" },
      { speaker: "tutor", en: "What was the biggest challenge?", zh: "最大的挑戰是什麼？" },
      { speaker: "user", en: "The biggest challenge was aligning different stakeholders.", zh: "最大的挑戰是協調不同利害關係人。" },
      { speaker: "tutor", en: "How did you persuade them?", zh: "你如何說服他們？" },
      { speaker: "user", en: "I persuaded the team by connecting the decision to business outcomes.", zh: "我透過把決策連結到商業成果來說服團隊。" },
    ],
  }),
];

const otherThemeScenes: Record<string, { name: string; enName: string; difficulty: EnglishLevel }[]> = {
  daily: [
    { name: "打招呼", enName: "Greetings", difficulty: "Beginner" },
    { name: "聊天氣", enName: "Talking About Weather", difficulty: "Beginner" },
    { name: "介紹自己", enName: "Introducing Yourself", difficulty: "Beginner" },
    { name: "問時間", enName: "Asking the Time", difficulty: "Beginner" },
    { name: "週末計畫", enName: "Weekend Plans", difficulty: "Elementary" },
    { name: "問路", enName: "Asking for Directions", difficulty: "Elementary" },
    { name: "搭乘大眾運輸", enName: "Taking Public Transport", difficulty: "Elementary" },
    { name: "看醫生", enName: "Seeing a Doctor", difficulty: "Intermediate" },
    { name: "鄰居寒暄", enName: "Chatting with Neighbors", difficulty: "Elementary" },
    { name: "日常購物", enName: "Daily Errands", difficulty: "Beginner" },
  ],
  travel: [
    { name: "問路", enName: "Asking Directions", difficulty: "Elementary" },
    { name: "買車票", enName: "Buying Tickets", difficulty: "Elementary" },
    { name: "搭計程車", enName: "Taking a Taxi", difficulty: "Elementary" },
    { name: "租車", enName: "Renting a Car", difficulty: "Intermediate" },
    { name: "觀光導覽", enName: "Joining a Tour", difficulty: "Intermediate" },
    { name: "換匯", enName: "Exchanging Money", difficulty: "Elementary" },
    { name: "拍照請求", enName: "Asking for a Photo", difficulty: "Beginner" },
    { name: "緊急求助", enName: "Asking for Help", difficulty: "Intermediate" },
    { name: "推薦景點", enName: "Recommending Spots", difficulty: "Intermediate" },
    { name: "退房離開", enName: "Checking Out", difficulty: "Elementary" },
  ],
  airport: [
    { name: "報到劃位", enName: "Check-in", difficulty: "Elementary" },
    { name: "託運行李", enName: "Checking Luggage", difficulty: "Elementary" },
    { name: "安檢", enName: "Security Check", difficulty: "Intermediate" },
    { name: "詢問登機門", enName: "Finding the Gate", difficulty: "Elementary" },
    { name: "海關入境", enName: "Immigration", difficulty: "Intermediate" },
    { name: "飯店入住", enName: "Hotel Check-in", difficulty: "Elementary" },
    { name: "客房服務", enName: "Room Service", difficulty: "Elementary" },
    { name: "詢問設施", enName: "Asking About Facilities", difficulty: "Elementary" },
    { name: "更改房型", enName: "Changing Rooms", difficulty: "Intermediate" },
    { name: "退房結帳", enName: "Hotel Checkout", difficulty: "Elementary" },
  ],
  shopping: [
    { name: "詢問價格", enName: "Asking Prices", difficulty: "Beginner" },
    { name: "試穿衣服", enName: "Trying on Clothes", difficulty: "Elementary" },
    { name: "詢問尺寸", enName: "Asking About Size", difficulty: "Beginner" },
    { name: "要求折扣", enName: "Asking for a Discount", difficulty: "Intermediate" },
    { name: "結帳付款", enName: "Checking Out", difficulty: "Beginner" },
    { name: "退換貨", enName: "Returns and Exchanges", difficulty: "Intermediate" },
    { name: "詢問庫存", enName: "Asking About Stock", difficulty: "Elementary" },
    { name: "比較商品", enName: "Comparing Products", difficulty: "Intermediate" },
    { name: "網購客服", enName: "Online Shopping Support", difficulty: "Intermediate" },
    { name: "詢問保固", enName: "Asking About Warranty", difficulty: "Intermediate" },
  ],
  work: [
    { name: "會議開場", enName: "Starting a Meeting", difficulty: "Intermediate" },
    { name: "表達意見", enName: "Giving Opinions", difficulty: "Intermediate" },
    { name: "進度回報", enName: "Status Update", difficulty: "Intermediate" },
    { name: "寄送 Email", enName: "Writing Emails", difficulty: "Intermediate" },
    { name: "安排會議", enName: "Scheduling Meetings", difficulty: "Elementary" },
    { name: "簡報開場", enName: "Presentation Opening", difficulty: "Upper-Intermediate" },
    { name: "客戶溝通", enName: "Talking to Clients", difficulty: "Upper-Intermediate" },
    { name: "請假", enName: "Asking for Leave", difficulty: "Elementary" },
    { name: "團隊協作", enName: "Team Collaboration", difficulty: "Intermediate" },
    { name: "回報問題", enName: "Reporting Issues", difficulty: "Intermediate" },
  ],
  interview: [
    { name: "自我介紹", enName: "Self Introduction", difficulty: "Intermediate" },
    { name: "談優缺點", enName: "Strengths & Weaknesses", difficulty: "Intermediate" },
    { name: "談工作經驗", enName: "Work Experience", difficulty: "Intermediate" },
    { name: "為何想加入", enName: "Why This Company", difficulty: "Upper-Intermediate" },
    { name: "情境問題", enName: "Behavioral Questions", difficulty: "Upper-Intermediate" },
    { name: "薪資談判", enName: "Salary Negotiation", difficulty: "Upper-Intermediate" },
    { name: "提問環節", enName: "Asking Questions", difficulty: "Intermediate" },
    { name: "行政助理面試", enName: "Admin Assistant Interview", difficulty: "Intermediate" },
    { name: "未來規劃", enName: "Career Goals", difficulty: "Intermediate" },
    { name: "面試收尾", enName: "Closing the Interview", difficulty: "Intermediate" },
  ],
  social: [
    { name: "認識新朋友", enName: "Meeting New People", difficulty: "Elementary" },
    { name: "聊興趣", enName: "Talking About Hobbies", difficulty: "Elementary" },
    { name: "聊電影", enName: "Talking About Movies", difficulty: "Elementary" },
    { name: "聊音樂", enName: "Talking About Music", difficulty: "Elementary" },
    { name: "邀約出去", enName: "Making Invitations", difficulty: "Elementary" },
    { name: "派對閒聊", enName: "Small Talk at Parties", difficulty: "Intermediate" },
    { name: "交換聯絡方式", enName: "Exchanging Contacts", difficulty: "Beginner" },
    { name: "讚美他人", enName: "Giving Compliments", difficulty: "Elementary" },
    { name: "婉拒邀約", enName: "Declining Politely", difficulty: "Intermediate" },
    { name: "道別", enName: "Saying Goodbye", difficulty: "Beginner" },
  ],
  phone: [
    { name: "接聽電話", enName: "Answering Calls", difficulty: "Elementary" },
    { name: "留言", enName: "Leaving a Message", difficulty: "Intermediate" },
    { name: "轉接電話", enName: "Transferring Calls", difficulty: "Intermediate" },
    { name: "預約服務", enName: "Booking by Phone", difficulty: "Elementary" },
    { name: "客訴處理", enName: "Handling Complaints", difficulty: "Upper-Intermediate" },
    { name: "確認訂單", enName: "Confirming Orders", difficulty: "Intermediate" },
    { name: "詢問狀態", enName: "Asking About Status", difficulty: "Intermediate" },
    { name: "技術支援", enName: "Tech Support", difficulty: "Upper-Intermediate" },
    { name: "取消預約", enName: "Cancelling Appointments", difficulty: "Intermediate" },
    { name: "結束通話", enName: "Ending the Call", difficulty: "Elementary" },
  ],
  exam: [
    { name: "單字選擇", enName: "Vocabulary Choice", difficulty: "Upper-Intermediate" },
    { name: "文法填空", enName: "Grammar Fill-in", difficulty: "Upper-Intermediate" },
    { name: "短文閱讀", enName: "Short Reading", difficulty: "Upper-Intermediate" },
    { name: "聽力理解", enName: "Listening Comprehension", difficulty: "Upper-Intermediate" },
    { name: "句子重組", enName: "Sentence Reorder", difficulty: "Upper-Intermediate" },
    { name: "情境判斷", enName: "Situational Judgement", difficulty: "Upper-Intermediate" },
    { name: "圖表題", enName: "Chart Questions", difficulty: "Advanced" },
    { name: "口說描述", enName: "Speaking Description", difficulty: "Advanced" },
    { name: "寫作開頭", enName: "Writing Opening", difficulty: "Advanced" },
    { name: "考試技巧", enName: "Test Strategies", difficulty: "Upper-Intermediate" },
  ],
};

function buildScenes(): Scene[] {
  const all: Scene[] = [...levelScenes];
  // cafe (authored)
  cafeScenes.forEach((s, i) => {
    all.push({
      id: `cafe-${i + 1}`,
      themeId: "cafe",
      name: s.name,
      enName: s.enName,
      intro: `在「${s.name}」情境中練習實用英文，學會自然地表達。`,
      difficulty: s.difficulty,
      minutes: 8 + (i % 4) * 2,
      goals: [`能完成「${s.name}」對話`, "掌握關鍵單字與句型", "提升口說自然度"],
      keyWords: s.words,
      keyPatterns: s.patterns,
      dialogue: ensurePracticeDialogue("cafe", s.dialogue),
      quiz: s.quiz,
    });
  });
  // other themes (contextual builder)
  Object.entries(otherThemeScenes).forEach(([themeId, specs]) => {
    const pool = themePatterns[themeId] || themePatterns.daily;
    specs.forEach((sp, i) => {
      const patterns = pickRotatingPatterns(pool, i);
      all.push({
        id: `${themeId}-${i + 1}`,
        themeId,
        name: sp.name,
        enName: sp.enName,
        intro: `在「${sp.name}」情境中練習實用英文，學會自然地表達。`,
        difficulty: sp.difficulty,
        minutes: 8 + (i % 4) * 2,
        goals: [`能完成「${sp.name}」對話`, "掌握關鍵單字與句型", "提升口說自然度"],
        keyWords: (themeWordBank[themeId] || themeWordBank.daily).slice(0, 6),
        keyPatterns: patterns,
        dialogue: ensurePracticeDialogue(themeId, buildDialogue(themeId, sp.name)),
        quiz: buildQuiz(patterns),
      });
    });
  });
  return all;
}

export const scenes: Scene[] = buildScenes();
