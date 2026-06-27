import type { Scene, TutorFeedback } from "@/types";

// Local mock AI tutor. Generates context-aware English replies and accurate
// feedback (typo + grammar correction, not blind "Could you...please?" wrapping).
// No API key required. A real model can later replace this via aiTutorService.

const encouragements = [
  "加油！你今天進步了！",
  "Great job! 你的表達越來越自然。",
  "Keep going! 你離目標更近一步了！",
  "很棒！再練習一次會更流暢。",
  "Let's go! 你的英文正在進步。",
];

function pick<T>(arr: T[], seed = 0): T {
  return arr[Math.abs(seed) % arr.length];
}

function countWords(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// Common typo / informal -> correct form.
const TYPOS: Record<string, string> = {
  mane: "name", teh: "the", recieve: "receive", adress: "address", wnat: "want",
  yuo: "you", thnx: "thanks", plz: "please", u: "you", r: "are", ur: "your",
  im: "I'm", dont: "don't", cant: "can't", wont: "won't", ive: "I've", id: "I'd",
  doesnt: "doesn't", didnt: "didn't", isnt: "isn't", arent: "aren't", wasnt: "wasn't",
  wanna: "want to", gonna: "going to", gotta: "have to", thier: "their",
  definately: "definitely", goin: "going", helo: "hello", hii: "hi", nmae: "name",
};

// Capitalize the first letter only.
function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

interface Correction {
  corrected: string;
  fixes: string[];
}

// Produce a genuinely corrected version of the user's sentence + notes of what
// was changed. This replaces the old blind "Could you ...please?" logic.
function correctSentence(raw: string): Correction {
  const fixes: string[] = [];
  const input = raw.trim();
  if (!input) return { corrected: "", fixes: [] };

  const tokens = input.split(/\s+/).map((tok) => {
    const m = tok.match(/^([A-Za-z']+)([.,!?;:]*)$/);
    let core = m ? m[1] : tok;
    const punct = m ? m[2] : "";
    const lc = core.toLowerCase();
    if (TYPOS[lc]) {
      if (TYPOS[lc].toLowerCase() !== lc) fixes.push(`「${core}」應為「${TYPOS[lc]}」`);
      core = TYPOS[lc];
    }
    if (core === "i") core = "I"; // standalone pronoun
    return core + punct;
  });

  let corrected = tokens.join(" ");

  // Capitalize the word right after a name/identity marker (likely a name).
  const before = corrected;
  corrected = corrected.replace(
    /\b(name is|name's|i am|i'm|this is|call me)\s+([a-z])/gi,
    (_m, p1, p2) => `${p1} ${p2.toUpperCase()}`
  );
  if (corrected !== before) fixes.push("專有名詞（人名）開頭要大寫");

  // First-letter capitalization.
  if (/^[a-z]/.test(corrected)) {
    fixes.push("句首字母要大寫");
    corrected = cap(corrected);
  } else {
    corrected = cap(corrected);
  }

  // Ending punctuation.
  if (!/[.?!]$/.test(corrected)) {
    const isQuestion =
      /\?$/.test(input) ||
      /^(what|where|when|why|who|how|do|does|did|can|could|would|will|is|are|am|may|should|have|has)\b/i.test(corrected);
    corrected += isQuestion ? "?" : ".";
    fixes.push("句尾要加上標點符號");
  }

  return { corrected, fixes };
}

// Make a polite request form only when it is actually a request.
function politeRequest(corrected: string): string | null {
  const t = corrected.replace(/[.?!]+$/, "").trim();
  if (/^(i want|i wanna|give me)\b/i.test(t)) {
    const rest = t.replace(/^(i want to|i want|i wanna|give me)\s*/i, "");
    return `I'd like ${rest}, please.`;
  }
  if (/^can i\b/i.test(t)) return cap(t) + ", please?";
  if (/^(help me|i need)\b/i.test(t)) return `Could you help me, please? ${cap(t)}.`;
  return null;
}

function extractRequestItem(text: string) {
  const lower = text.toLowerCase();
  const item =
    lower.match(/\b(?:i'?d like|i want|i wanna|can i have|could i get|i'?ll have|give me)\s+(?:a|an|the)?\s*([^?.!,]+)/)?.[1] ||
    lower.match(/\b(?:coffee|latte|tea|ticket|receipt|refund|reservation|appointment|report|table|room|seat|gate|size|discount)\b.*$/)?.[0] ||
    "";
  return item.trim().replace(/\s+/g, " ");
}

function withArticle(item: string) {
  const clean = item.trim();
  if (!clean) return "";
  if (/^(a|an|the|some|two|three|four|five|half|less|no)\b/i.test(clean)) return clean;
  if (/^(coffee|tea|water|rice|cash|luggage|information|help)\b/i.test(clean)) return clean;
  return /^[aeiou]/i.test(clean) ? `an ${clean}` : `a ${clean}`;
}

function isGuidedScene(scene: Scene) {
  return scene.themeId !== "free" && scene.id !== "free-chat" && scene.dialogue.length > 0;
}

function scriptedTutorReply(scene: Scene, turn: number): { en: string; zh: string } | null {
  if (!isGuidedScene(scene)) return null;
  const tutorLines = scene.dialogue.filter((line) => line.speaker === "tutor");
  const line = tutorLines[turn];
  return line ? { en: line.en, zh: line.zh } : null;
}

function expectedUserReply(scene: Scene, turn: number): string | null {
  if (!isGuidedScene(scene)) return null;
  const userLines = scene.dialogue.filter((line) => line.speaker === "user");
  return userLines[Math.max(0, turn - 1)]?.en || null;
}

function isLearningQuestion(text: string) {
  return (
    /\?$/.test(text.trim()) &&
    /\b(what does|what is|how do i say|how can i say|meaning|mean|translate|grammar|pronounce)\b/i.test(text)
  );
}

function nativeRewrite(scene: Scene, raw: string, corrected: string, turn = 1): string | null {
  const lower = raw.toLowerCase();
  const cleaned = corrected.replace(/[.?!]+$/, "").trim();
  const item = extractRequestItem(raw);
  const expected = expectedUserReply(scene, turn);

  if (
    expected &&
    !isLearningQuestion(raw) &&
    (/^(yes|yeah|yep|ok|okay|sure)\b/.test(lower) ||
      /\b(thanks|thank you)\b/.test(lower) ||
      countWords(raw) <= 4)
  ) {
    return expected;
  }

  if (/^(yes|yeah|yep|ok|okay|sure)\b/.test(lower)) return "Yes, that works for me.";
  if (/^(no|nope)\b/.test(lower)) return "No, that's okay for now, thank you.";
  if (/\b(thanks|thank you)\b/.test(lower)) return "Thank you. I really appreciate it.";
  if (/\b(i don't know|not know|no idea)\b/.test(lower)) return "I'm not sure yet, but I can try to explain.";

  if (scene.themeId === "cafe") {
    if (/\b(i want|give me|latte|coffee|tea|order|drink)\b/.test(lower)) {
      return `Could I get ${withArticle(item) || "a coffee"}, please?`;
    }
    if (/\b(no sugar|less sugar|half sugar|ice|sweet)\b/.test(lower)) {
      return "Could I have it half sugar with less ice, please?";
    }
    if (/\b(bill|pay|card|cash|receipt)\b/.test(lower)) {
      return "Could I pay by card, and could I get a receipt?";
    }
  }

  if (scene.themeId === "travel") {
    if (/\b(where|how|go|get|station|bus|taxi|ticket|lost|direction|way)\b/.test(lower)) {
      return "Excuse me, could you tell me how to get there?";
    }
    if (/\b(far|long|time)\b/.test(lower)) return "How long does it take to get there?";
  }

  if (scene.themeId === "airport") {
    if (/\b(check in|passport|luggage|flight|gate|boarding|seat)\b/.test(lower)) {
      return "Hi, I'd like to check in for my flight, please.";
    }
    if (/\b(where|gate|security)\b/.test(lower)) return "Could you point me toward security and the boarding gates?";
  }

  if (scene.themeId === "shopping") {
    if (/\b(size|try|fit|shirt|clothes|medium|large|small)\b/.test(lower)) {
      return "Do you have this in another size?";
    }
    if (/\b(price|discount|sale|expensive|cheap|cost)\b/.test(lower)) {
      return "Is this on sale, or is there any discount today?";
    }
    if (/\b(refund|return|exchange|receipt)\b/.test(lower)) {
      return "I'd like to return this, and I have the receipt with me.";
    }
  }

  if (scene.themeId === "work") {
    if (/\b(report|send|email|update|deadline|schedule|meeting|client)\b/.test(lower)) {
      return "I'll send a brief update after the meeting.";
    }
    if (/\b(problem|issue|risk|late|delay)\b/.test(lower)) {
      return "The main concern is the timeline, but I have a plan to keep it on track.";
    }
  }

  if (scene.themeId === "interview") {
    if (/\b(experience|worked|years|job)\b/.test(lower)) {
      return "I have two years of hands-on experience in customer service.";
    }
    if (/\b(strength|good at|skill|communication)\b/.test(lower)) {
      return "One of my strengths is staying calm and communicating clearly.";
    }
    if (/\b(want|join|company|position|role)\b/.test(lower)) {
      return "I'm excited about this role because it matches my experience and goals.";
    }
  }

  if (scene.themeId === "social") {
    if (/\b(nice|meet|hello|hi|name)\b/.test(lower)) return "Nice to meet you. How do you know everyone here?";
    if (/\b(movie|music|hobby|weekend|fun|restaurant)\b/.test(lower)) {
      return "I usually like movies, live music, and trying new restaurants.";
    }
    if (/\b(invite|join|go|hang out)\b/.test(lower)) return "That sounds fun. I'd love to join if you're going.";
  }

  if (scene.themeId === "phone") {
    if (/\b(appointment|book|reserve|schedule)\b/.test(lower)) return "Hi, I'd like to make an appointment, please.";
    if (/\b(message|call back|number|hold|transfer)\b/.test(lower)) {
      return "Could you please ask her to call me back when she's available?";
    }
  }

  if (scene.themeId === "exam") {
    if (/\b(answer|choice|question|passage|main idea|grammar)\b/.test(lower)) {
      return "I think choice C is correct because it matches the main idea.";
    }
  }

  if (/^i want\b/i.test(cleaned)) return cleaned.replace(/^I want\b/i, "I'd like") + ", please.";
  if (countWords(raw) <= 3) return "Could you say a little more about that?";
  return null;
}

function extractName(text: string): string | null {
  const m = text.match(
    /\b(?:my name is|name's|i am|i'm|this is|call me|mane is|nmae is)\s+([A-Za-z]+)/i
  );
  if (m && !/^(a|an|the|fine|good|ok|okay|here|going|from|happy|sorry)$/i.test(m[1])) {
    return cap(m[1].toLowerCase());
  }
  return null;
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

interface ReplyCtx {
  scene: Scene;
  userInput: string;
  turn: number;
  history: string[];
}

function sceneSpecificReply(ctx: ReplyCtx): { en: string; zh: string } | null {
  const { scene, userInput, turn } = ctx;
  const lower = userInput.toLowerCase();
  const seed = turn + userInput.length;

  if (scene.themeId === "cafe") {
    if (hasAny(lower, ["sugar", "sweet", "ice", "hot", "iced"])) {
      return pick(
        [
          { en: "No problem. I'll make it half sugar and less ice.", zh: "沒問題，我幫你做半糖少冰。" },
          { en: "Sure. Would you like it hot or iced?", zh: "當然。你要熱的還是冰的？" },
          { en: "Got it. I'll note that on your order.", zh: "了解，我會幫你註記在訂單上。" },
        ],
        seed
      );
    }
    if (hasAny(lower, ["allergy", "nuts", "nut", "contain", "ingredient"])) {
      return pick(
        [
          { en: "Thanks for telling me. I'll check the ingredients with the kitchen.", zh: "謝謝你告訴我。我會跟廚房確認食材。" },
          { en: "I understand. Let me make sure this is safe for you.", zh: "我了解。讓我確認這對你是安全的。" },
        ],
        seed
      );
    }
    if (hasAny(lower, ["bill", "receipt", "card", "cash", "pay"])) {
      return pick(
        [
          { en: "Of course. You can pay by card or cash, and I'll bring your receipt.", zh: "當然。你可以刷卡或付現，我會拿收據給你。" },
          { en: "Sure. The total is ready whenever you are.", zh: "可以。你準備好時就可以結帳。" },
        ],
        seed
      );
    }
    if (hasAny(lower, ["reservation", "table", "people", "tonight"])) {
      return pick(
        [
          { en: "Certainly. What time would you like the table?", zh: "當然。你想訂幾點的位子？" },
          { en: "I can help with that. How many people will be coming?", zh: "我可以協助。請問幾位會來？" },
        ],
        seed
      );
    }
  }

  if (scene.themeId === "daily" && hasAny(lower, ["weather", "weekend", "today", "time", "family", "morning", "afternoon"])) {
    return pick(
      [
        { en: "Nice. Try adding one more detail, like when, where, or who with.", zh: "不錯。試著再加一個細節，例如時間、地點或和誰一起。" },
        { en: "That sounds natural. What else happened today?", zh: "這樣很自然。今天還發生了什麼？" },
        { en: "Good daily English. Can you say that again with a feeling word?", zh: "很好的日常英文。你可以加上一個感受詞再說一次嗎？" },
      ],
      seed
    );
  }

  if (scene.themeId === "travel" && hasAny(lower, ["way", "direction", "map", "bus", "taxi", "ticket", "station", "far", "lost", "street"])) {
    return pick(
      [
        { en: "You're asking clearly. The natural follow-up is: 'How long does it take?'", zh: "你問得很清楚。自然的下一句是：How long does it take?" },
        { en: "Good travel phrase. You can also ask, 'Is it within walking distance?'", zh: "很好的旅遊句。你也可以問：Is it within walking distance?" },
        { en: "Sure. First go straight, then turn left at the next street.", zh: "可以。先直走，然後在下一條街左轉。" },
      ],
      seed
    );
  }

  if (scene.themeId === "airport" && hasAny(lower, ["passport", "luggage", "gate", "flight", "boarding", "hotel", "check in", "reservation", "room"])) {
    return pick(
      [
        { en: "Good airport English. Please keep your passport and boarding pass ready.", zh: "很好的機場英文。請準備好護照和登機證。" },
        { en: "Your question is clear. The gate number is usually shown on the screen.", zh: "你的問題很清楚。登機門號通常會顯示在螢幕上。" },
        { en: "I can help with check-in. Do you have any luggage to check?", zh: "我可以協助報到。你有行李要託運嗎？" },
      ],
      seed
    );
  }

  if (scene.themeId === "shopping" && hasAny(lower, ["price", "discount", "size", "try", "refund", "receipt", "cash", "card", "expensive", "cheap", "stock"])) {
    return pick(
      [
        { en: "That works well in a store. You can add, 'Do you have another size?'", zh: "這在商店很適合。你可以加一句：Do you have another size?" },
        { en: "Sure, I can check the size and price for you.", zh: "當然，我可以幫你確認尺寸和價格。" },
        { en: "Good question. If it doesn't fit, you can ask about returns or exchanges.", zh: "問得好。如果不合身，可以詢問退換貨。" },
      ],
      seed
    );
  }

  if (scene.themeId === "work" && hasAny(lower, ["meeting", "project", "deadline", "schedule", "report", "client", "email", "problem", "manager"])) {
    return pick(
      [
        { en: "Clear and professional. Can you add the deadline or next action?", zh: "清楚又專業。你可以補上截止日或下一步行動嗎？" },
        { en: "Good workplace English. A natural reply is: 'I'll follow up after the meeting.'", zh: "很好的職場英文。自然回覆可以說：I'll follow up after the meeting." },
        { en: "Understood. Please send a short update to the team after this.", zh: "了解。請在之後寄一個簡短更新給團隊。" },
      ],
      seed
    );
  }

  if (scene.themeId === "interview" && hasAny(lower, ["experience", "strength", "weakness", "salary", "company", "position", "resume", "team", "skill"])) {
    return pick(
      [
        { en: "Nice interview answer. Try adding a specific example from your experience.", zh: "很好的面試回答。試著加上一個你的經驗例子。" },
        { en: "That sounds confident. Can you connect it to this position?", zh: "聽起來很有自信。你可以把它連結到這個職位嗎？" },
        { en: "Good. A stronger answer would include a result or achievement.", zh: "不錯。更有力的回答可以包含成果或成就。" },
      ],
      seed
    );
  }

  if (scene.themeId === "social" && hasAny(lower, ["friend", "hobby", "movie", "music", "weekend", "party", "invite", "favorite", "fun"])) {
    return pick(
      [
        { en: "That sounds friendly. Ask a follow-up question to keep the conversation going.", zh: "聽起來很友善。問一個後續問題讓對話繼續。" },
        { en: "Nice small talk. You could say, 'How about you?'", zh: "很好的閒聊。你可以說：How about you?" },
        { en: "Great. Try inviting them with: 'Would you like to join me?'", zh: "很棒。試著邀請對方：Would you like to join me?" },
      ],
      seed
    );
  }

  if (scene.themeId === "phone" && hasAny(lower, ["phone", "call", "message", "hold", "appointment", "customer", "number", "transfer", "cancel"])) {
    return pick(
      [
        { en: "Good phone phrase. Please speak slowly and confirm the number.", zh: "很好的電話用語。請慢慢說並確認電話號碼。" },
        { en: "Sure, I can take a message. What should I tell them?", zh: "可以，我可以幫你留言。我要轉達什麼？" },
        { en: "Thanks for holding. How can I help you with the appointment?", zh: "謝謝等候。關於預約我可以怎麼幫你？" },
      ],
      seed
    );
  }

  if (scene.themeId === "exam" && hasAny(lower, ["question", "answer", "reading", "listening", "grammar", "vocabulary", "score", "passage", "choice"])) {
    return pick(
      [
        { en: "Good test strategy. Look for keywords before choosing the answer.", zh: "很好的考試策略。作答前先找關鍵字。" },
        { en: "Try explaining why that answer is correct in one sentence.", zh: "試著用一句話說明為什麼那個答案正確。" },
        { en: "Nice. For exam English, accuracy matters more than speed at first.", zh: "不錯。考試英文一開始準確度比速度更重要。" },
      ],
      seed
    );
  }

  return null;
}

function adaptiveRoleplayReply(
  ctx: ReplyCtx,
  scripted: { en: string; zh: string } | null
): { en: string; zh: string } | null {
  const { scene, userInput, turn } = ctx;
  if (!isGuidedScene(scene) || isLearningQuestion(userInput)) return null;

  const lower = userInput.toLowerCase();
  const seed = turn + userInput.length;

  if (hasAny(lower, ["sorry", "repeat", "again", "what do you mean", "don't understand", "not understand"])) {
    return {
      en: `No problem. Let me say it another way: ${scripted?.en || "Can you tell me a little more?"}`,
      zh: `沒問題。我換個方式說：${scripted?.zh || "可以多告訴我一點嗎？"}`,
    };
  }

  if (scene.name.includes("問路") || scene.enName.toLowerCase().includes("direction")) {
    if (hasAny(lower, ["seafood", "sell", "supermarket", "grocery", "groceries", "market", "restaurant", "food"])) {
      return { en: "I don't sell seafood, but the market near the station does. Go straight two blocks, then turn left.", zh: "我不是賣海鮮的，但車站附近的市場有賣。直走兩個街區，然後左轉。" };
    }
    if (hasAny(lower, ["lost", "station", "street", "map", "direction", "where", "how do i get", "walk", "bus", "taxi", "far", "long"])) {
      return { en: "You're close. Go straight for two blocks, then turn right at the pharmacy. The station will be on your left.", zh: "你很近了。直走兩個街區，然後在藥局右轉。車站會在你的左邊。" };
    }
  }

  if (scene.themeId === "daily") {
    if (hasAny(lower, ["lost", "hard to find", "couldn't find", "office", "directions"])) {
      return { en: "That happens a lot in this building. Did someone at the front desk help you?", zh: "這棟樓很多人第一次都會找不到。櫃台有人協助你嗎？" };
    }
    if (hasAny(lower, ["busy", "rushed", "late", "errands", "work"])) {
      return { en: "No worries. We can keep this quick. What's the most important thing on your schedule today?", zh: "沒關係，我們可以簡短一點。你今天行程裡最重要的是什麼？" };
    }
    if (/^(yes|yeah|yep|sure|ok|okay)\b/.test(lower) || hasAny(lower, ["thank", "clear"])) {
      return scripted || { en: "Great. Tell me a little more about your day.", zh: "很好。多跟我說說你今天的狀況。" };
    }
    if (hasAny(lower, ["friend", "family", "movie", "music", "weekend", "hobby"])) {
      return { en: "That sounds nice. Do you usually do that alone or with other people?", zh: "聽起來不錯。你通常自己做，還是和別人一起？" };
    }
  }

  if (scene.themeId === "cafe") {
    if (hasAny(lower, ["latte", "coffee", "tea", "drink", "order", "want", "like"])) {
      return pick(
        [
          { en: "Sure. What size would you like?", zh: "好的。你想要什麼尺寸？" },
          { en: "Of course. Would you like that hot or iced?", zh: "當然。你要熱的還是冰的？" },
          { en: "Great choice. Would you like it for here or to go?", zh: "好選擇。內用還是外帶？" },
        ],
        seed
      );
    }
    if (hasAny(lower, ["sugar", "sweet", "ice", "hot", "iced"])) {
      return { en: "Got it. I'll make a note of that on your order.", zh: "了解，我會在你的訂單上註記。" };
    }
    if (hasAny(lower, ["allergy", "nuts", "ingredient"])) {
      return { en: "Thanks for telling me. I'll check with the kitchen before we place the order.", zh: "謝謝你告訴我。我會先跟廚房確認再下單。" };
    }
    if (hasAny(lower, ["bill", "pay", "card", "cash", "receipt"])) {
      return { en: "Of course. You can pay by card, and I'll bring the receipt to you.", zh: "當然，可以刷卡，我也會把收據給你。" };
    }
  }

  if (scene.themeId === "travel") {
    if (hasAny(lower, ["seafood", "sell", "supermarket", "grocery", "groceries", "market", "restaurant", "food"])) {
      return { en: "I don't sell food, but I can point you to the market. Go straight two blocks, then turn left.", zh: "我不是賣食物的，但我可以指路去市場。直走兩個街區，然後左轉。" };
    }
    if (hasAny(lower, ["lost", "station", "street", "map", "direction", "where", "how do i get"])) {
      return { en: "You're close. Go straight for two blocks, then turn right at the pharmacy.", zh: "你很近了。直走兩個街區，然後在藥局右轉。" };
    }
    if (hasAny(lower, ["walk", "bus", "taxi", "far", "long"])) {
      return { en: "Walking is easiest from here. It should take about ten minutes.", zh: "從這裡走路最方便，大約十分鐘。" };
    }
    if (hasAny(lower, ["ticket", "machine", "buy"])) {
      return { en: "You can buy a ticket at the machine. There is an English menu on the screen.", zh: "你可以在售票機買票。螢幕上有英文選單。" };
    }
  }

  if ((scene.name.includes("問路") || scene.enName.toLowerCase().includes("direction")) && hasAny(lower, ["seafood", "sell", "supermarket", "grocery", "groceries", "market", "restaurant", "food"])) {
    return { en: "I don't work at a shop, but the market near the station has food. Go straight, then turn left at the pharmacy.", zh: "我不是店員，但車站附近的市場有吃的。直走，然後在藥局左轉。" };
  }

  if (scene.themeId === "airport") {
    if (hasAny(lower, ["passport", "confirmation", "booking", "email"])) {
      return { en: "Thank you. Are you checking any luggage today?", zh: "謝謝。今天有行李要託運嗎？" };
    }
    if (hasAny(lower, ["luggage", "suitcase", "bag", "check"])) {
      return { en: "Please place it on the scale. You're still within the weight limit.", zh: "請放到秤上。重量仍在限制內。" };
    }
    if (hasAny(lower, ["gate", "boarding", "security", "seat"])) {
      return { en: "Boarding starts at gate B6, and security is straight ahead.", zh: "B6 登機門開始登機，安檢在前方直走。" };
    }
  }

  if (scene.themeId === "shopping") {
    if (hasAny(lower, ["small", "large", "medium", "size", "fit"])) {
      return { en: "I can check another size for you. What size do you usually wear?", zh: "我可以幫你查其他尺寸。你平常穿什麼尺寸？" };
    }
    if (hasAny(lower, ["try", "fitting", "room"])) {
      return { en: "The fitting room is right behind the mirror. I'll bring the size to you.", zh: "試衣間就在鏡子後面。我拿尺寸給你。" };
    }
    if (hasAny(lower, ["sale", "discount", "price", "expensive"])) {
      return { en: "Yes, it's twenty percent off today if you use a member account.", zh: "有，今天使用會員帳號可以打八折。" };
    }
  }

  if (scene.themeId === "work") {
    if (hasAny(lower, ["report", "draft", "update", "finished"])) {
      return { en: "Great. What's the biggest issue we should flag for the client?", zh: "很好。我們應該提醒客戶最大的問題是什麼？" };
    }
    if (hasAny(lower, ["deadline", "schedule", "timeline", "late", "delay"])) {
      return { en: "Can we still send the proposal by Friday if design finishes tomorrow?", zh: "如果設計明天完成，我們週五前還能寄出提案嗎？" };
    }
    if (hasAny(lower, ["client", "risk", "proposal", "meeting"])) {
      return { en: "Please add one short risk note, then share it with the team.", zh: "請加一段簡短風險說明，然後分享給團隊。" };
    }
  }

  if (scene.themeId === "interview") {
    if (hasAny(lower, ["found", "directions", "clear", "office", "thank"])) {
      return { en: "Great. Could you start by telling me a little about yourself?", zh: "很好。可以先簡單介紹一下自己嗎？" };
    }
    if (hasAny(lower, ["experience", "customer", "service", "worked", "years"])) {
      return { en: "That sounds relevant. What kind of customers did you usually support?", zh: "這很相關。你通常協助哪類客戶？" };
    }
    if (hasAny(lower, ["strength", "calm", "communicat", "skill"])) {
      return { en: "Can you give me a quick example of a time you used that strength?", zh: "可以舉一個你使用這個優勢的簡短例子嗎？" };
    }
    if (hasAny(lower, ["role", "company", "position", "grow", "team"])) {
      return { en: "Thank you. That's a strong answer, and it connects well to the role.", zh: "謝謝。這是很有力的回答，也和職位連結得很好。" };
    }
  }

  if (scene.themeId === "social") {
    if (hasAny(lower, ["nice", "meet", "name", "i'm", "i am"])) {
      return { en: "Nice to meet you too. How do you know everyone here?", zh: "我也很高興認識你。你怎麼認識這裡的人？" };
    }
    if (hasAny(lower, ["work", "school", "cafe", "friend"])) {
      return { en: "Oh, that's fun. Do you still see them often?", zh: "喔，那很有趣。你現在還常見到他們嗎？" };
    }
    if (hasAny(lower, ["movie", "music", "restaurant", "weekend", "hobby"])) {
      return { en: "Same here. There's a live music night downtown this Friday.", zh: "我也是。市中心這週五有現場音樂夜。" };
    }
  }

  if (scene.themeId === "phone") {
    if (hasAny(lower, ["appointment", "book", "schedule"])) {
      return { en: "Of course. Is this for a routine visit or a specific problem?", zh: "當然。是例行預約還是有特定問題？" };
    }
    if (hasAny(lower, ["toothache", "pain", "problem", "soon"])) {
      return { en: "I'm sorry to hear that. Are you available tomorrow afternoon?", zh: "很抱歉聽到這樣。你明天下午有空嗎？" };
    }
    if (hasAny(lower, ["number", "name", "spell", "call back", "message"])) {
      return { en: "Thanks. Could you repeat your phone number one more time?", zh: "謝謝。可以再重複一次你的電話號碼嗎？" };
    }
  }

  if (scene.themeId === "exam") {
    if (hasAny(lower, ["main idea", "topic", "first sentence"])) {
      return { en: "Good. Now check which answer choice is too broad or too narrow.", zh: "很好。現在檢查哪個選項太廣或太窄。" };
    }
    if (hasAny(lower, ["choice", "answer", "c", "b", "a", "d"])) {
      return { en: "Before you choose, match it with one detail from the passage.", zh: "選之前，先把它和文章中的一個細節對上。" };
    }
    if (hasAny(lower, ["grammar", "vocabulary", "word", "negative"])) {
      return { en: "Exactly. Watch for small words because they can change the answer.", zh: "沒錯。注意小字，因為它們可能改變答案。" };
    }
  }

  return scripted;
}

// Context-aware reply generation. Detects intent and responds to whatever the
// user actually says, while gently steering back to the scene topic.
function generateReply(ctx: ReplyCtx): { en: string; zh: string } {
  const { scene, userInput, turn, history } = ctx;
  const lower = userInput.toLowerCase();
  const allText = [...history, userInput].join(" ");
  const name = extractName(allText);
  const who = name ? `, ${name}` : "";
  const scripted = scriptedTutorReply(scene, turn);

  const roleplayReply = adaptiveRoleplayReply(ctx, scripted);
  if (roleplayReply) return roleplayReply;

  // 1) Greeting
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|yo)\b/.test(lower)) {
    return pick(
      [
        { en: `Hi${who}! Great to see you. How are you doing today?`, zh: `嗨${name ? `，${name}` : ""}！很高興見到你，今天過得如何？` },
        { en: `Hello${who}! I'm your English tutor. Shall we start?`, zh: `你好${name ? `，${name}` : ""}！我是你的英文導師，我們開始吧？` },
        { en: `Hey${who}! Ready to practice some English?`, zh: `嘿${name ? `，${name}` : ""}！準備好練習英文了嗎？` },
        { en: `Good to see you${who}! What would you like to talk about?`, zh: `很高興見到你${name ? `，${name}` : ""}！想聊些什麼呢？` },
      ],
      turn
    );
  }

  // 2) Self-introduction (name)
  if (name && /\b(name|i am|i'm|this is|call me|mane)\b/.test(lower)) {
    return pick(
      [
        { en: `Nice to meet you, ${name}! Where are you from?`, zh: `很高興認識你，${name}！你來自哪裡呢？` },
        { en: `Lovely to meet you, ${name}! What do you like to do for fun?`, zh: `很高興認識你，${name}！你平常喜歡做什麼呢？` },
        { en: `Hello ${name}! What brings you here today?`, zh: `你好 ${name}！今天為什麼來這裡呢？` },
        { en: `Great to meet you, ${name}! How can I help you today?`, zh: `很高興認識你，${name}！今天有什麼我可以幫你的嗎？` },
      ],
      turn
    );
  }

  // 3) Where from
  if (/\b(i'?m from|i am from|i come from|i live in|from)\b/.test(lower)) {
    return pick(
      [
        { en: `That sounds like a wonderful place! How long have you lived there?`, zh: `那聽起來是個很棒的地方！你在那裡住多久了？` },
        { en: `Nice! What do you like most about it?`, zh: `真好！你最喜歡那裡的什麼呢？` },
        { en: `Interesting! What's the weather like there?`, zh: `有趣！那裡的天氣如何呢？` },
        { en: `I'd love to visit someday! What's the best thing about living there?`, zh: `我很想去那裡看看！住在那裡最棒的是什麼？` },
      ],
      turn
    );
  }

  // 4) Hobbies / likes
  if (/\b(i like|i love|i enjoy|my hobby|hobbies|fun|free time)\b/.test(lower)) {
    return pick(
      [
        { en: `That's awesome! How often do you do that?`, zh: `太棒了！你多常做這件事呢？` },
        { en: `Cool! How did you get into it?`, zh: `很酷！你是怎麼開始接觸的？` },
        { en: `Sounds fun! Do you do it alone or with friends?`, zh: `聽起來很有趣！你是獨自做還是和朋友一起？` },
        { en: `Great choice! What's your favorite part about it?`, zh: `很棒的選擇！你覺得最有趣的部分是什麼？` },
      ],
      turn
    );
  }

  const sceneReply = sceneSpecificReply(ctx);
  if (sceneReply) return sceneReply;

  // 5) Ordering food/drink
  if (/\b(i'?d like|i want|can i have|i'?ll have|may i have|order|coffee|latte|tea|menu|burger|water)\b/.test(lower)) {
    return pick(
      [
        { en: `Great choice! Would you like anything else with that?`, zh: `好選擇！還需要搭配其他的嗎？` },
        { en: `Sure! For here or to go?`, zh: `沒問題！內用還是外帶呢？` },
        { en: `Coming right up! Hot or iced?`, zh: `馬上來！熱的還是冰的？` },
        { en: `Of course! What size would you like?`, zh: `當然！要什麼尺寸呢？` },
      ],
      turn
    );
  }

  // 6) Price
  if (/\b(how much|price|cost|total|pay)\b/.test(lower)) {
    return pick(
      [
        { en: `It comes to five dollars in total. Would you pay by card or cash?`, zh: `總共是五美元，您要刷卡還是付現呢？` },
        { en: `That'll be six dollars, please. Do you need a receipt?`, zh: `總共六美元。需要收據嗎？` },
        { en: `The total is four fifty. Anything else before I ring you up?`, zh: `總共四塊五。結帳前還需要什麼嗎？` },
      ],
      turn
    );
  }

  // 7) Thanks
  if (/\b(thank|thanks|appreciate)\b/.test(lower)) {
    return pick(
      [
        { en: `You're very welcome${who}! Is there anything else I can help with?`, zh: `不客氣${name ? `，${name}` : ""}！還有其他需要協助的嗎？` },
        { en: `My pleasure! Keep up the great work.`, zh: `我的榮幸！繼續保持喔。` },
        { en: `Happy to help${who}! You're doing great.`, zh: `很樂意幫忙${name ? `，${name}` : ""}！你做得很好。` },
        { en: `Anytime! Let me know if you need anything else.`, zh: `隨時為您服務！還有其他需要嗎？` },
      ],
      turn
    );
  }

  // 8) Bye
  if (/\b(bye|goodbye|see you|that's all|i'?m done)\b/.test(lower)) {
    return pick(
      [
        { en: `It was great talking with you${who}! See you next time. 👋`, zh: `很高興和你聊天${name ? `，${name}` : ""}！下次見。` },
        { en: `Take care${who}! Keep practicing!`, zh: `保重${name ? `，${name}` : ""}！繼續練習喔！` },
        { en: `Goodbye${who}! You did a great job today.`, zh: `再見${name ? `，${name}` : ""}！你今天表現得很棒。` },
      ],
      turn
    );
  }

  // 9) Yes / No
  if (/^(yes|yeah|yep|sure|of course|okay|ok)\b/.test(lower)) {
    return pick(
      [
        { en: `Perfect! Let's keep going. Tell me more.`, zh: `太好了！我們繼續，多說一點吧。` },
        { en: `Great! What else would you like to share?`, zh: `很棒！還想分享什麼呢？` },
        { en: `Excellent! You're doing really well.`, zh: `太好了！你做得非常好。` },
      ],
      turn
    );
  }
  if (/^(no|nope|not really|i don'?t)\b/.test(lower)) {
    return pick(
      [
        { en: `No worries at all. Take your time — what would you like to talk about?`, zh: `完全沒關係，慢慢來——你想聊些什麼呢？` },
        { en: `That's okay! What would you prefer to discuss?`, zh: `沒關係！你比較想聊什麼呢？` },
        { en: `No problem! Let's try a different topic.`, zh: `沒問題！我們換個話題吧。` },
      ],
      turn
    );
  }

  // 10) The user asks a question
  if (userInput.trim().endsWith("?") || /^(what|where|when|why|who|how|do|does|can|could|would|is|are)\b/.test(lower)) {
    return pick(
      [
        { en: `Good question! In this situation, you could say: "${scene.keyPatterns[0]?.en || "Sure, let me help you."}"`, zh: `好問題！在這個情境，你可以說：「${scene.keyPatterns[0]?.en || "Sure, let me help you."}」` },
        { en: `That's a great thing to ask. Let me explain — and you can try replying in English!`, zh: `這問得很好。我來說明——你可以試著用英文回覆看看！` },
      ],
      turn
    );
  }

  // Default: stay on-topic with a relevant open question (no repeating scripts).
  const kw = scene.keyWords[(turn + 1) % Math.max(1, scene.keyWords.length)];
  return pick(
    [
      { en: `I see! Could you tell me a little more about that?`, zh: `原來如此！可以多告訴我一點嗎？` },
      { en: `That's interesting${who}. How do you feel about it?`, zh: `這很有趣${name ? `，${name}` : ""}。你覺得如何呢？` },
      { en: `Nice! Try using the word "${kw}" in your next sentence.`, zh: `不錯！下一句試著用用看「${kw}」這個字。` },
    ],
    turn
  );
}

export const mockAiTutorService = {
  available: true,

  reply(scene: Scene, userInput: string, turn: number, history: string[] = []): { en: string; zh: string } {
    return generateReply({ scene, userInput, turn, history });
  },

  feedback(scene: Scene, userInput: string, turn: number, history: string[] = []): TutorFeedback {
    const words = countWords(userInput);
    const { corrected, fixes } = correctSentence(userInput);
    const polite = /\b(please|could you|would you|may i|thank)\b/i.test(userInput);

    // Naturalness: more words + fewer mistakes + politeness = higher.
    let naturalness = 78;
    naturalness += Math.min(12, Math.max(0, (words - 2) * 3));
    naturalness -= fixes.length * 7;
    if (polite) naturalness += 6;
    naturalness = Math.max(45, Math.min(99, naturalness));

    const native = nativeRewrite(scene, userInput, corrected, turn);
    const better = politeRequest(corrected);
    const betterWay = native || better || corrected;

    const grammarTip = fixes.length
      ? `修正建議：${fixes.join("、")}。`
      : native
      ? "意思清楚；下面提供更像真人現場會說的版本。"
      : "文法很自然，繼續保持！";

    const zhExplain = fixes.length
      ? `建議寫成：「${betterWay}」，這樣更道地正確。`
      : native
      ? `你的句子可溝通；在「${scene.name}」情境中，真人更常說：「${betterWay}」。`
      : `「${betterWay}」表達清楚自然，做得很好！`;

    const next = generateReply({ scene, userInput, turn, history });

    return {
      reply: next.en,
      replyZh: next.zh,
      naturalness,
      grammarTip,
      betterWay,
      zhExplain,
      encouragement: pick(encouragements, turn + words),
    };
  },
};
