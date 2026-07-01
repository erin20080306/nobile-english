import type {
  LearningLanguageCode,
  Scene,
  TutorConversationPhase,
  TutorConversationState,
} from "@/types";

const DEFAULT_MISSING_INFO: Record<string, string[]> = {
  cafe: ["order_item", "size", "temperature", "dining_option", "payment_method"],
  restaurant: ["party_size", "reservation_time", "order_item", "drink", "payment_method"],
  travel: ["destination", "transport_preference"],
  airport: ["passport_or_booking", "luggage", "seat_preference", "gate_or_boarding_time"],
  shopping: ["product", "size", "price_or_discount", "payment_method"],
  work: ["task", "deadline", "next_action"],
  interview: ["background", "experience", "strength", "motivation"],
  social: ["relationship", "interest", "next_plan"],
  phone: ["request_type", "name_or_number", "time"],
  exam: ["question_focus", "answer_choice", "reasoning"],
  default: ["main_need", "detail", "next_action"],
};

function normalizeLanguage(language?: string): LearningLanguageCode {
  return language === "ja" || language === "ko" || language === "it" || language === "es"
    ? language
    : "en";
}

function scenarioKey(scene: Scene): string {
  const title = `${scene.themeId} ${scene.name} ${scene.enName} ${scene.intro}`.toLowerCase();
  if (title.includes("restaurant") || title.includes("餐廳")) return "restaurant";
  if (title.includes("cafe") || title.includes("coffee") || title.includes("咖啡")) return "cafe";
  if (title.includes("direction") || title.includes("travel") || title.includes("問路")) return "travel";
  if (DEFAULT_MISSING_INFO[scene.themeId]) return scene.themeId;
  return "default";
}

function uniqueStrings(items: string[], max = 12): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const text = item.trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    result.push(text);
    if (result.length >= max) break;
  }
  return result;
}

function slotMissingInfo(scene: Scene, knownInfo: Record<string, string>): string[] {
  const required = DEFAULT_MISSING_INFO[scenarioKey(scene)] || DEFAULT_MISSING_INFO.default;
  return required.filter((slot) => !knownInfo[slot]);
}

function inferPhase(scene: Scene, turnCount: number, missingInfo: string[]): TutorConversationPhase {
  if (turnCount <= 0) return "opening";
  if (missingInfo.length === 0) return "confirming";
  const key = scenarioKey(scene);
  if ((key === "cafe" || key === "restaurant") && missingInfo.length <= 2) return "clarifying";
  if (turnCount >= 8 && missingInfo.length <= 2) return "closing";
  return "collecting_info";
}

function setIfMissing(slots: Record<string, string>, key: string, value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || slots[key]) return;
  slots[key] = cleaned.slice(0, 120);
}

function includesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function extractEnglishItem(text: string): string | null {
  const match =
    text.match(/\b(?:i'?d like|i want|i wanna|can i have|could i get|i'?ll have|give me|order)\s+(?:a|an|the|some)?\s*([^?.!,]+)/i)?.[1] ||
    text.match(/\b(latte|coffee|tea|cappuccino|americano|mocha|espresso|sandwich|cake|pasta|steak|salmon|ticket|shirt|room|table)\b[^?.!,]*/i)?.[0];
  return match ? match.trim() : null;
}

function extractSlots(scene: Scene, userInput: string): Record<string, string> {
  const slots: Record<string, string> = {};
  const raw = userInput.trim();
  const lower = raw.toLowerCase();
  const key = scenarioKey(scene);
  const item = extractEnglishItem(raw);

  if (key === "cafe" || key === "restaurant") {
    if (item) setIfMissing(slots, "order_item", item);
    if (includesAny(lower, ["small", "medium", "large", "grande", "venti", "中杯", "大杯", "小杯"])) {
      const size = lower.match(/\b(small|medium|large|grande|venti)\b/)?.[1] || "mentioned";
      setIfMissing(slots, "size", size);
    }
    if (includesAny(lower, ["hot", "iced", "ice", "warm", "冷", "冰", "熱", "caldo", "freddo", "frío"])) {
      const temperature = includesAny(lower, ["iced", "ice", "cold", "freddo", "frío", "冰", "冷"]) ? "iced/cold" : "hot";
      setIfMissing(slots, "temperature", temperature);
    }
    if (includesAny(lower, ["sugar", "sweet", "half", "less ice", "no ice", "半糖", "少冰", "無糖"])) {
      setIfMissing(slots, "sweetness_or_ice", raw);
    }
    if (includesAny(lower, ["to go", "takeout", "take away", "for here", "dine in", "內用", "外帶"])) {
      setIfMissing(slots, "dining_option", includesAny(lower, ["to go", "takeout", "take away", "外帶"]) ? "to go" : "for here");
    }
    if (includesAny(lower, ["card", "cash", "apple pay", "credit", "現金", "刷卡"])) {
      setIfMissing(slots, "payment_method", includesAny(lower, ["cash", "現金"]) ? "cash" : "card");
    }
    const partySize = raw.match(/\b(?:for|table for)\s+(\d+|one|two|three|four|five|six)\b/i)?.[1];
    if (partySize) setIfMissing(slots, "party_size", partySize);
    const time = raw.match(/\b(?:at|around)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i)?.[1];
    if (time) setIfMissing(slots, "reservation_time", time);
  }

  if (key === "travel") {
    const destination =
      raw.match(/\b(?:to|get to|go to|find|looking for)\s+(?:the)?\s*([^?.!,]+)/i)?.[1] ||
      raw.match(/\b(station|hotel|airport|market|museum|restaurant|old town|downtown)\b[^?.!,]*/i)?.[0];
    if (destination) setIfMissing(slots, "destination", destination);
    if (includesAny(lower, ["walk", "bus", "taxi", "train", "subway", "uber", "走路", "公車", "計程車"])) {
      setIfMissing(slots, "transport_preference", raw);
    }
  }

  if (key === "shopping") {
    if (item) setIfMissing(slots, "product", item);
    if (includesAny(lower, ["small", "medium", "large", "size", "尺寸", "中號", "大號"])) {
      setIfMissing(slots, "size", raw);
    }
    if (includesAny(lower, ["price", "discount", "sale", "cost", "expensive", "特價", "折扣"])) {
      setIfMissing(slots, "price_or_discount", raw);
    }
    if (includesAny(lower, ["card", "cash", "pay", "現金", "刷卡"])) {
      setIfMissing(slots, "payment_method", raw);
    }
  }

  if (key === "airport") {
    if (includesAny(lower, ["passport", "booking", "confirmation", "ticket", "護照"])) {
      setIfMissing(slots, "passport_or_booking", raw);
    }
    if (includesAny(lower, ["luggage", "suitcase", "bag", "行李"])) {
      setIfMissing(slots, "luggage", raw);
    }
    if (includesAny(lower, ["aisle", "window", "seat", "座位"])) {
      setIfMissing(slots, "seat_preference", raw);
    }
    if (includesAny(lower, ["gate", "boarding", "security", "登機", "登機門"])) {
      setIfMissing(slots, "gate_or_boarding_time", raw);
    }
  }

  if (Object.keys(slots).length === 0 && raw) {
    setIfMissing(slots, "main_need", raw);
  }

  return slots;
}

export function createInitialTutorState(scene: Scene, persona: string): TutorConversationState {
  const languageCode = normalizeLanguage(scene.targetLanguage);
  const knownInfo: Record<string, string> = {};
  const missingInfo = slotMissingInfo(scene, knownInfo);
  return {
    sceneId: scene.id,
    languageCode,
    persona,
    phase: "opening",
    turnCount: 0,
    knownInfo,
    askedQuestions: [],
    missingInfo,
    readyToClose: false,
  };
}

export function normalizeTutorState(
  scene: Scene,
  persona: string,
  value?: Partial<TutorConversationState> | null
): TutorConversationState {
  const initial = createInitialTutorState(scene, persona);
  const knownInfo =
    value?.knownInfo && typeof value.knownInfo === "object"
      ? Object.fromEntries(
          Object.entries(value.knownInfo)
            .filter((entry): entry is [string, string] => typeof entry[1] === "string")
            .map(([key, text]) => [key, text.trim().slice(0, 120)])
        )
      : {};
  const askedQuestions = Array.isArray(value?.askedQuestions)
    ? uniqueStrings(value.askedQuestions.filter((item): item is string => typeof item === "string"))
    : [];
  const turnCount = Number.isFinite(Number(value?.turnCount))
    ? Math.max(0, Math.min(50, Number(value?.turnCount)))
    : initial.turnCount;
  const missingInfo = slotMissingInfo(scene, knownInfo);
  const phase = (value?.phase || inferPhase(scene, turnCount, missingInfo)) as TutorConversationPhase;

  return {
    ...initial,
    ...value,
    sceneId: scene.id,
    languageCode: normalizeLanguage(scene.targetLanguage),
    persona,
    phase,
    turnCount,
    knownInfo,
    askedQuestions,
    missingInfo,
    lastUserIntent: typeof value?.lastUserIntent === "string" ? value.lastUserIntent.slice(0, 120) : undefined,
    lastTutorAction: typeof value?.lastTutorAction === "string" ? value.lastTutorAction.slice(0, 120) : undefined,
    summary: typeof value?.summary === "string" ? value.summary.slice(0, 500) : undefined,
    readyToClose: Boolean(value?.readyToClose),
  };
}

export function advanceTutorStateFromUser(
  scene: Scene,
  persona: string,
  previous: Partial<TutorConversationState> | null | undefined,
  userInput: string,
  turn: number
): TutorConversationState {
  const base = normalizeTutorState(scene, persona, previous);
  const extracted = extractSlots(scene, userInput);
  const knownInfo = { ...base.knownInfo, ...extracted };
  const missingInfo = slotMissingInfo(scene, knownInfo);
  const turnCount = Math.max(base.turnCount + 1, turn);
  const phase = inferPhase(scene, turnCount, missingInfo);

  return {
    ...base,
    turnCount,
    phase,
    knownInfo,
    missingInfo,
    lastUserIntent: userInput.trim().slice(0, 120),
    readyToClose: missingInfo.length === 0 && turnCount >= 4,
  };
}

export function mergeTutorState(
  scene: Scene,
  persona: string,
  localState: TutorConversationState,
  modelState: Partial<TutorConversationState>
): TutorConversationState {
  const normalizedModel = normalizeTutorState(scene, persona, modelState);
  const knownInfo = {
    ...localState.knownInfo,
    ...normalizedModel.knownInfo,
  };
  const askedQuestions = uniqueStrings([
    ...localState.askedQuestions,
    ...normalizedModel.askedQuestions,
  ]);
  const missingInfo = slotMissingInfo(scene, knownInfo);
  const phase = normalizedModel.phase || inferPhase(scene, localState.turnCount, missingInfo);

  return {
    ...localState,
    ...normalizedModel,
    sceneId: scene.id,
    languageCode: normalizeLanguage(scene.targetLanguage),
    persona,
    phase,
    turnCount: Math.max(localState.turnCount, normalizedModel.turnCount || 0),
    knownInfo,
    askedQuestions,
    missingInfo,
    readyToClose: Boolean(normalizedModel.readyToClose) || (missingInfo.length === 0 && localState.turnCount >= 4),
  };
}

export function stateForPrompt(state: TutorConversationState): string {
  return JSON.stringify({
    phase: state.phase,
    turnCount: state.turnCount,
    knownInfo: state.knownInfo,
    missingInfo: state.missingInfo,
    askedQuestions: state.askedQuestions.slice(-8),
    lastUserIntent: state.lastUserIntent,
    lastTutorAction: state.lastTutorAction,
    summary: state.summary,
    readyToClose: state.readyToClose,
  });
}
