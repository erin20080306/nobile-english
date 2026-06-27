import type { Scene, SceneTheme, DialogueLine, QuizItem, EnglishLevel } from "@/types";

export const themes: SceneTheme[] = [
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
      { en: "I'd like a ___, please.", zh: "我想要一杯 ___，謝謝。" },
      { en: "Can I get a large latte?", zh: "可以給我一杯大杯拿鐵嗎？" },
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
      { en: "You should try the ___.", zh: "你應該試試 ___。" },
      { en: "It's one of our best sellers.", zh: "這是我們的招牌之一。" },
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

const themePatterns: Record<string, { en: string; zh: string }[]> = {
  daily: [{ en: "How's it going?", zh: "最近好嗎？" }, { en: "What are you up to today?", zh: "你今天要做什麼？" }],
  travel: [{ en: "How do I get to ___?", zh: "我要怎麼去 ___？" }, { en: "Is it far from here?", zh: "離這裡遠嗎？" }],
  airport: [{ en: "Where is the boarding gate?", zh: "登機門在哪裡？" }, { en: "I'd like to check in.", zh: "我想要報到。" }],
  shopping: [{ en: "How much is this?", zh: "這個多少錢？" }, { en: "Can I try it on?", zh: "我可以試穿嗎？" }],
  work: [{ en: "Let's go over the agenda.", zh: "我們來看一下議程。" }, { en: "Could you send me the report?", zh: "可以把報告寄給我嗎？" }],
  interview: [{ en: "Tell me about yourself.", zh: "請自我介紹。" }, { en: "What are your strengths?", zh: "你的優勢是什麼？" }],
  social: [{ en: "What do you do for fun?", zh: "你平常喜歡做什麼？" }, { en: "Want to hang out this weekend?", zh: "這週末要不要出來？" }],
  phone: [{ en: "Can I leave a message?", zh: "我可以留言嗎？" }, { en: "Could you hold on a second?", zh: "可以稍等一下嗎？" }],
  exam: [{ en: "Choose the best answer.", zh: "選出最佳答案。" }, { en: "According to the passage, ...", zh: "根據文章，…" }],
};

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

function buildQuiz(themeId: string): QuizItem[] {
  const p = themePatterns[themeId] || themePatterns.daily;
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
  const all: Scene[] = [];
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
    specs.forEach((sp, i) => {
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
        keyPatterns: themePatterns[themeId] || themePatterns.daily,
        dialogue: ensurePracticeDialogue(themeId, buildDialogue(themeId, sp.name)),
        quiz: buildQuiz(themeId),
      });
    });
  });
  return all;
}

export const scenes: Scene[] = buildScenes();
