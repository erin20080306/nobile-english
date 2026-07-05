import type { LearningLanguageCode, Word, SavedSentence } from "@/types";
import { dictionaryEntries } from "@/data/dictionary";
import { learnerDictionaryEntries } from "@/data/learnerDictionary";
import { multilingualDictionaryEntries } from "@/data/multilingualDictionary";
import { expandedMultilingualDictionaryEntries } from "@/data/expandedMultilingualDictionary";
import { getLearningLanguage } from "@/data/learningLanguages";
import { scenes } from "@/data/scenes";
import { vocabularyService } from "./vocabularyService";

import { storageService, KEYS } from "./storageService";

const allMultilingualEntries: Word[] = [...multilingualDictionaryEntries, ...expandedMultilingualDictionaryEntries];

// Dictionary lookup. Tries the rich local dictionary first, then the larger
// learner/core word bank and vocabulary list as fallbacks. A future free
// dictionary API can be added in `lookupRemote` (see .env.example
// DICTIONARY_API_BASE_URL) with this local data kept as offline fallback.

const contractionAliases: Record<string, string[]> = {
  "i'd": ["i'd", "would"],
  "i'll": ["i'll", "will"],
  "i'm": ["i'm", "am"],
  "it'll": ["it'll", "will"],
  "it's": ["it's", "is"],
  "that's": ["that's", "that"],
  "there's": ["there's", "there"],
  "here's": ["here's", "here"],
  "what's": ["what's", "what"],
  "how's": ["how's", "how"],
  "let's": ["let's", "let"],
  "won't": ["won't", "will"],
  "can't": ["can't", "can"],
  "you're": ["you", "are"],
  "we're": ["we", "are"],
  "they're": ["they", "are"],
  "don't": ["do"],
  "doesn't": ["does"],
  "didn't": ["do"],
};

const irregularForms: Record<string, string[]> = {
  bought: ["buy"],
  brought: ["bring"],
  came: ["come"],
  found: ["find"],
  gone: ["go"],
  got: ["get"],
  made: ["make"],
  paid: ["pay"],
  said: ["say"],
  sent: ["send"],
  took: ["take"],
  went: ["go"],
};

const preciseEnglishFallbacks: Record<string, Omit<Word, "word">> = {
  different: {
    phonetic: "/ˈdɪfərənt/",
    pos: "adj.",
    enDef: "not the same; unlike another person or thing",
    zh: "不同的；不一樣的。常用來比較兩件事、人或想法，例如 different from/to something。",
    example: "This answer is different from mine.",
    exampleZh: "這個答案跟我的不一樣。",
    synonyms: ["another", "distinct"],
    antonyms: ["same", "similar"],
    related: ["difference", "differently"],
  },
  busiest: {
    phonetic: "/ˈbɪziɪst/",
    pos: "adj.",
    enDef: "the superlative form of busy; having the most activity",
    zh: "最忙的；最繁忙的。busy 的最高級，常用在 busiest time / busiest street。",
    example: "This is the busiest street in the area.",
    exampleZh: "這是這一帶最繁忙的街道。",
    related: ["busy", "busier"],
  },
  available: {
    phonetic: "/əˈveɪləbəl/",
    pos: "adj.",
    enDef: "able to be used, bought, or reached",
    zh: "可取得的；有空的；可用的。點餐或訂位時可問某物是否 available。",
    example: "Do you have seafood available?",
    exampleZh: "你們有海鮮嗎？",
    related: ["availability"],
  },
  seafood: {
    phonetic: "/ˈsiːfuːd/",
    pos: "n.",
    enDef: "food from the sea, such as fish, shrimp, or shellfish",
    zh: "海鮮；例如魚、蝦、貝類等海產食物。",
    example: "Do you have seafood available?",
    exampleZh: "你們有海鮮嗎？",
    related: ["fish", "shrimp"],
  },
  rushed: {
    phonetic: "/rʌʃt/",
    pos: "adj.",
    enDef: "hurried; not having enough time",
    zh: "匆忙的；趕時間的。You look rushed 表示「你看起來有點趕」。",
    example: "You look a little rushed.",
    exampleZh: "你看起來有點趕。",
    related: ["rush", "hurry"],
  },
  iced: {
    phonetic: "/aɪst/",
    pos: "adj.",
    enDef: "served cold with ice",
    zh: "冰的；冰鎮的。點飲料時常說 iced tea / iced coffee。",
    example: "I'd like an iced tea, please.",
    exampleZh: "我想要一杯冰茶，謝謝。",
    related: ["ice", "cold", "drink"],
  },
};

const multilingualAliases: Partial<Record<Exclude<LearningLanguageCode, "en">, Record<string, string[]>>> = {
  ja: {
    "どうでしたか": ["どうですか"],
    "でした": ["です"],
    "ありますか": ["あります"],
    "見せてください": ["ください"],
    "教えてください": ["ください"],
    "話してください": ["ください", "話す"],
    "行ってください": ["ください", "行く"],
  },
  ko: {
    "어땠어요": ["어때요"],
    "어땠어": ["어때요"],
    "어때": ["어때요"],
    "좋았어요": ["좋아요"],
    "괜찮았어요": ["괜찮아요"],
    "갔어요": ["가다"],
    "가세요": ["가다"],
    "오세요": ["오다"],
    "말해 주세요": ["말하다", "주세요"],
    "보여 주세요": ["보다", "주세요"],
    "알려 주세요": ["알리다", "주세요"],
  },
  it: {
    informazioni: ["informazione"],
    indicazioni: ["indicazione"],
    prenotazioni: ["prenotazione"],
    grazie: ["grazie"],
  },
  es: {
    informaciones: ["información"],
    indicaciones: ["indicación"],
    reservaciones: ["reservación"],
    tienes: ["tener"],
    quieres: ["querer"],
  },
};

export interface ClickableToken {
  text: string;
  lookup?: string;
}

function normalizeToken(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^a-z']+|[^a-z']+$/g, "");
}

function normalizeMultilingualToken(word: string, language: LearningLanguageCode): string {
  const clean = word
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/^[\s"'`.,!?;:()[\]{}<>「」『』（）。，、！？；：]+|[\s"'`.,!?;:()[\]{}<>「」『』（）。，、！？；：]+$/g, "");
  if (language === "it" || language === "es") {
    return clean
      .toLowerCase()
      .normalize("NFC")
      .replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ']+|[^A-Za-zÀ-ÖØ-öø-ÿ']+$/g, "");
  }
  return clean;
}

function candidatesFor(word: string): string[] {
  const q = normalizeToken(word);
  if (!q) return [];

  const candidates = new Set<string>([q]);
  contractionAliases[q]?.forEach((w) => candidates.add(w));
  irregularForms[q]?.forEach((w) => candidates.add(w));

  if (q.endsWith("'s")) candidates.add(q.slice(0, -2));
  if (q.endsWith("iest") && q.length > 5) candidates.add(q.slice(0, -4) + "y");
  if (q.endsWith("ies") && q.length > 4) candidates.add(q.slice(0, -3) + "y");
  if (q.endsWith("es") && q.length > 3) candidates.add(q.slice(0, -2));
  if (q.endsWith("s") && q.length > 3) candidates.add(q.slice(0, -1));
  if (q.endsWith("ing") && q.length > 5) {
    const base = q.slice(0, -3);
    candidates.add(base);
    candidates.add(base + "e");
    if (base.length > 2 && base.at(-1) === base.at(-2)) candidates.add(base.slice(0, -1));
  }
  if (q.endsWith("ed") && q.length > 4) {
    const base = q.slice(0, -2);
    candidates.add(base);
    candidates.add(base + "e");
    if (base.length > 2 && base.at(-1) === base.at(-2)) candidates.add(base.slice(0, -1));
  }

  return Array.from(candidates);
}

function findLocalEntry(word: string): { entry: Word | null; fromFallback: boolean } {
  const rich = dictionaryEntries.find((w) => w.word.toLowerCase() === word);
  if (rich) return { entry: rich, fromFallback: false };

  const learner = learnerDictionaryEntries.find((w) => w.word.toLowerCase() === word);
  if (learner) return { entry: learner, fromFallback: true };

  const basic = vocabularyService.find(word);
  if (basic) return { entry: basic, fromFallback: true };

  return { entry: null, fromFallback: false };
}

function findMultilingualEntry(word: string, language: Exclude<LearningLanguageCode, "en">): Word | null {
  const normalized = normalizeMultilingualToken(word, language);
  if (!normalized) return null;
  const candidates = multilingualCandidatesFor(normalized, language);
  return allMultilingualEntries.find((entry) => {
    if (entry.language !== language) return false;
    const entryWord = normalizeMultilingualToken(entry.word, language);
    if (candidates.has(entryWord)) return true;
    return entry.related?.some((rel) => candidates.has(normalizeMultilingualToken(rel, language)));
  }) ?? null;
}

function multilingualCandidatesFor(word: string, language: Exclude<LearningLanguageCode, "en">): Set<string> {
  const normalized = normalizeMultilingualToken(word, language);
  const candidates = new Set<string>(normalized ? [normalized] : []);
  multilingualAliases[language]?.[normalized]?.forEach((alias) => {
    const clean = normalizeMultilingualToken(alias, language);
    if (clean) candidates.add(clean);
  });
  if (language === "it" || language === "es") {
    if (normalized.endsWith("s") && normalized.length > 3) candidates.add(normalized.slice(0, -1));
    if (normalized.endsWith("es") && normalized.length > 4) candidates.add(normalized.slice(0, -2));
  }
  if (language === "ko") {
    if (normalized.endsWith("주세요")) candidates.add("주세요");
    if (normalized.endsWith("세요")) candidates.add(normalized.replace(/세요$/, "다"));
  }
  if (language === "ja" && normalized.endsWith("ください")) {
    candidates.add("ください");
  }
  return candidates;
}

function inferPartOfSpeech(word: string): Word["pos"] {
  if (/^(and|but|or|because|if|so)$/.test(word)) return "conj.";
  if (/^(i|you|he|she|it|we|they|me|him|her|us|them|my|your|our|their|who|which|what)$/.test(word)) return "pron.";
  if (/^(at|in|on|to|for|from|with|about|above|behind|before|after|over|under|through|toward)$/.test(word)) return "prep.";
  if (/ly$/.test(word) || /^(now|then|here|there|too|also|already|usually|soon)$/.test(word)) return "adv.";
  if (/(ing|ed)$/.test(word)) return "v.";
  if (/(ful|ous|ive|al|able|ible|ent|ant|ic|y)$/.test(word)) return "adj.";
  return "n.";
}

function sceneExampleFor(word: string) {
  const q = normalizeToken(word);
  if (!q || /\s/.test(q)) return null;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = new RegExp(`\\b${escaped}\\b`, "i");
  for (const scene of scenes) {
    for (const pattern of scene.keyPatterns) {
      if (exact.test(pattern.en)) return pattern;
    }
    for (const line of scene.dialogue) {
      if (exact.test(line.en)) return { en: line.en, zh: line.zh };
    }
  }
  return null;
}

function genericEnglishExample(word: string, pos: Word["pos"], zh: string) {
  const q = normalizeToken(word);
  const meaning = (zh.split(/[；;,，、]/)[0] || "這個字").replace(/[。.]$/, "");
  if (pos === "adj.") return { en: `It is ${q}.`, zh: `它是${meaning}的。` };
  if (pos === "adv.") return { en: `Please speak ${q}.`, zh: `請用${meaning}的方式說話。` };
  if (pos === "v.") {
    if (/ing$/i.test(q)) return { en: `I am ${q} now.`, zh: `我現在正在${meaning}。` };
    if (/ed$/i.test(q)) return { en: `I ${q} today.`, zh: `我今天${meaning}。` };
    return { en: `I can ${q}.`, zh: `我可以${meaning}。` };
  }
  const article = /^[aeiou]/i.test(q) ? "an" : "a";
  return { en: `This is ${article} ${q}.`, zh: `這是一個${meaning}。` };
}

function learnerFallback(word: string): Word | null {
  const q = normalizeToken(word);
  if (!/^[a-z][a-z'-]*$/.test(q) || q.length < 2) return null;
  const precise = preciseEnglishFallbacks[q];
  if (precise) return { word: q, ...precise };
  const pos = inferPartOfSpeech(q);
  const zhByPos: Record<Word["pos"], string> = {
    "n.": "情境對話常見名詞或名稱，請搭配原句理解。",
    "v.": "情境對話常見動詞或動詞變化，表示動作或狀態。",
    "adj.": "情境對話常見形容詞，用來描述人、事、物。",
    "adv.": "情境對話常見副詞，用來補充時間、程度或方式。",
    "prep.": "常見介系詞，用來表示位置、時間、方向或關係。",
    "conj.": "常見連接詞，用來連接句子或想法。",
    "interj.": "常見感嘆詞或招呼語。",
    "pron.": "常見代名詞，用來代替人、事、物。",
  };
  const fallbackExample = sceneExampleFor(q) || genericEnglishExample(q, pos, zhByPos[pos]);

  return {
    word: q,
    phonetic: "/-/",
    pos,
    enDef: "A common conversation word or word form used in real-life English scenes.",
    zh: zhByPos[pos],
    example: fallbackExample.en,
    exampleZh: fallbackExample.zh,
    related: candidatesFor(q).filter((candidate) => candidate !== q).slice(0, 4),
  };
}

function multilingualFallback(word: string, language: Exclude<LearningLanguageCode, "en">): Word | null {
  const q = normalizeMultilingualToken(word, language);
  if (!q) return null;
  if (language === "ja" && !/[\u3040-\u30ff\u3400-\u9fff]/.test(q)) return null;
  if (language === "ko" && !/[\uac00-\ud7af]/.test(q)) return null;
  if ((language === "it" || language === "es") && !/^[A-Za-zÀ-ÖØ-öø-ÿ']{2,}$/.test(q)) return null;

  const lang = getLearningLanguage(language);
  const specific = multilingualPatternFallback(q, language);
  if (specific) return specific;
  const examples: Record<Exclude<LearningLanguageCode, "en">, { example: string; zh: string }> = {
    ja: { example: `${q}を使って短い文を作りましょう。`, zh: `試著用「${q}」造一個短句。` },
    ko: { example: `${q}을/를 넣어서 짧은 문장을 만들어 보세요.`, zh: `試著把「${q}」放進短句裡。` },
    it: { example: `Prova a usare "${q}" in una frase breve.`, zh: `試著用「${q}」造一個短句。` },
    es: { example: `Prueba a usar "${q}" en una frase corta.`, zh: `試著用「${q}」造一個短句。` },
    zh: { example: `試著用「${q}」造一個短句。`, zh: `試著用「${q}」造一個短句。` },
  };

  const nativeDef: Record<Exclude<LearningLanguageCode, "en">, string> = {
    ja: `「${q}」は日本語の会話でよく使われる言葉です。前後の文脈で意味を確認してください。`,
    ko: `'${q}'은(는) 한국어 대화에서 자주 쓰이는 표현입니다. 문맥으로 의미를 확인해 주세요.`,
    it: `"${q}" è un'espressione comune nelle conversazioni italiane. Controlla il significato nel contesto.`,
    es: `"${q}" es una palabra o expresión común en conversaciones en español. Revisa el significado según el contexto.`,
    zh: `「${q}」是中文對話中常用的詞語，請根據上下文確認意思。`,
  };

  return {
    language,
    word: q,
    phonetic: "/-/",
    pos: "n.",
    enDef: nativeDef[language],
    zh: `${lang.zhName}情境對話詞，請搭配原句理解意思與用法。`,
    example: examples[language].example,
    exampleZh: examples[language].zh,
  };
}

function multilingualPatternFallback(q: string, language: Exclude<LearningLanguageCode, "en">): Word | null {
  if (language === "ko") {
    if (/어땠/.test(q)) {
      return {
        language,
        word: q,
        phonetic: "/eottaesseoyo/",
        pos: "interj.",
        enDef: "A polite Korean question meaning how was it or how did it go.",
        zh: "韓文禮貌問句，意思是「剛剛/那件事怎麼樣？」或「過得如何？」不是「他怎麼樣」。",
        example: "오늘 하루는 어땠어요?",
        exampleZh: "今天過得怎麼樣？",
        related: ["어때요", "어떻게"],
      };
    }
    if (q.endsWith("주세요")) {
      return {
        language,
        word: q,
        phonetic: "/juseyo/",
        pos: "interj.",
        enDef: "A polite Korean request ending meaning please give me or please do something.",
        zh: "韓文禮貌請求句，意思接近「請給我／請幫我……」。",
        example: `${q}라고 말하면 정중한 부탁이 됩니다.`,
        exampleZh: `用「${q}」可以表達有禮貌的請求。`,
        related: ["주세요"],
      };
    }
    if (q.endsWith("어요") || q.endsWith("예요") || q.endsWith("이에요")) {
      return {
        language,
        word: q,
        phonetic: "/-/",
        pos: "v.",
        enDef: "A polite Korean sentence form used in everyday conversation.",
        zh: "韓文日常禮貌句尾，通常表示動作、狀態或提問；完整意思需看前面的詞幹與原句。",
        example: `${q}를 원래 문장 안에서 다시 읽어 보세요.`,
        exampleZh: `請把「${q}」放回原句理解，通常是禮貌口語表達。`,
      };
    }
  }
  if (language === "ja") {
    if (q.endsWith("ください")) {
      return {
        language,
        word: q,
        phonetic: "/kudasai/",
        pos: "interj.",
        enDef: "A polite Japanese request form meaning please do something.",
        zh: "日文禮貌請求句，意思接近「請……」。",
        example: `${q}を使うと丁寧にお願いできます。`,
        exampleZh: `用「${q}」可以有禮貌地請對方做某件事。`,
        related: ["ください"],
      };
    }
  }
  if (language === "it") {
    if (q.endsWith("zione")) {
      return {
        language,
        word: q,
        phonetic: "/-/",
        pos: "n.",
        enDef: "An Italian noun ending in -zione, often similar to English nouns ending in -tion.",
        zh: "義大利文名詞，常見字尾 -zione，很多意思接近英文 -tion 的抽象名詞。",
        example: `Puoi usare "${q}" in una frase breve.`,
        exampleZh: `可以把「${q}」放進短句中練習。`,
      };
    }
    if (q.endsWith("mente")) {
      return {
        language,
        word: q,
        phonetic: "/-/",
        pos: "adv.",
        enDef: "An Italian adverb ending in -mente, similar to English -ly.",
        zh: "義大利文副詞，字尾 -mente 常接近英文 -ly，表示方式或程度。",
        example: `Parla ${q} quando fai pratica.`,
        exampleZh: `練習時可以用「${q}」描述說話方式。`,
      };
    }
  }
  if (language === "es") {
    if (q.endsWith("ción")) {
      return {
        language,
        word: q,
        phonetic: "/-/",
        pos: "n.",
        enDef: "A Spanish noun ending in -ción, often similar to English nouns ending in -tion.",
        zh: "西班牙文名詞，常見字尾 -ción，很多意思接近英文 -tion 的抽象名詞。",
        example: `Usa "${q}" en una frase corta.`,
        exampleZh: `可以把「${q}」放進短句中練習。`,
      };
    }
    if (q.endsWith("mente")) {
      return {
        language,
        word: q,
        phonetic: "/-/",
        pos: "adv.",
        enDef: "A Spanish adverb ending in -mente, similar to English -ly.",
        zh: "西班牙文副詞，字尾 -mente 常接近英文 -ly，表示方式或程度。",
        example: `Habla ${q} cuando practicas.`,
        exampleZh: `練習時可以用「${q}」描述說話方式。`,
      };
    }
  }
  return null;
}

function tokenizeWithRegex(text: string, language: LearningLanguageCode): ClickableToken[] {
  const pattern = language === "it" || language === "es"
    ? /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[’'][A-Za-zÀ-ÖØ-öø-ÿ]+)?/g
    : /[A-Za-z]+(?:[’'][A-Za-z]+)?/g;
  const tokens: ClickableToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const word = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) tokens.push({ text: text.slice(lastIndex, index) });
    tokens.push({ text: word, lookup: normalizeMultilingualToken(word, language) || word });
    lastIndex = index + word.length;
  }
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex) });
  return tokens.length ? tokens : [{ text }];
}

type SegmenterSegment = {
  segment: string;
  index: number;
  isWordLike?: boolean;
};

type SegmenterCtor = new (
  locale?: string,
  options?: { granularity?: "grapheme" | "word" | "sentence" }
) => { segment(input: string): Iterable<SegmenterSegment> };

function tokenizeWithSegmenter(text: string, language: Exclude<LearningLanguageCode, "en">): ClickableToken[] | null {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterCtor }).Segmenter;
  if (!Segmenter) return null;
  const locale = language === "ja" ? "ja-JP" : language === "ko" ? "ko-KR" : language === "es" ? "es-ES" : "it-IT";
  const segmenter = new Segmenter(locale, { granularity: "word" });
  const tokens: ClickableToken[] = [];
  let lastIndex = 0;

  Array.from(segmenter.segment(text)).forEach((part) => {
    if (part.index > lastIndex) tokens.push({ text: text.slice(lastIndex, part.index) });
    const lookup = normalizeMultilingualToken(part.segment, language);
    const isKnown = language === "it" || language === "es" ? Boolean(lookup) : Boolean(findMultilingualEntry(lookup, language) || multilingualFallback(lookup, language));
    tokens.push({
      text: part.segment,
      lookup: (part.isWordLike || isKnown) && lookup ? lookup : undefined,
    });
    lastIndex = part.index + part.segment.length;
  });
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex) });
  return tokens.length ? tokens : null;
}

function isTargetScript(char: string, language: Exclude<LearningLanguageCode, "en">) {
  if (language === "ja") return /[\u3040-\u30ff\u3400-\u9fff]/.test(char);
  if (language === "ko") return /[\uac00-\ud7af]/.test(char);
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(char);
}

function tokenizeWithDictionary(text: string, language: Exclude<LearningLanguageCode, "en">): ClickableToken[] {
  if (language === "it" || language === "es") return tokenizeWithRegex(text, language);
  const entries = allMultilingualEntries
    .filter((entry) => entry.language === language)
    .map((entry) => entry.word)
    .sort((a, b) => b.length - a.length);
  const tokens: ClickableToken[] = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (!isTargetScript(char, language)) {
      tokens.push({ text: char });
      i += char.length;
      continue;
    }
    const matched = entries.find((word) => text.startsWith(word, i));
    if (matched) {
      tokens.push({ text: matched, lookup: matched });
      i += matched.length;
      continue;
    }
    let j = i + char.length;
    while (j < text.length && isTargetScript(text[j], language) && !entries.some((word) => text.startsWith(word, j))) {
      j += text[j].length;
    }
    const chunk = text.slice(i, j);
    tokens.push({ text: chunk, lookup: chunk });
    i = j;
  }
  return tokens;
}

export const dictionaryService = {
  lookup(word: string, language: LearningLanguageCode = "en"): { entry: Word | null; fromFallback: boolean } {
    if (language !== "en") {
      const entry = findMultilingualEntry(word, language);
      if (entry) return { entry, fromFallback: false };
      const fallback = multilingualFallback(word, language);
      if (fallback) return { entry: fallback, fromFallback: true };
      return { entry: null, fromFallback: false };
    }
    for (const candidate of candidatesFor(word)) {
      const result = findLocalEntry(candidate);
      if (result.entry) return result;
    }
    const fallback = learnerFallback(word);
    if (fallback) return { entry: fallback, fromFallback: true };
    return { entry: null, fromFallback: false };
  },

  tokenize(text: string, language: LearningLanguageCode = "en"): ClickableToken[] {
    if (!text) return [];
    if (language === "en") return tokenizeWithRegex(text, language);
    return tokenizeWithSegmenter(text, language) ?? tokenizeWithDictionary(text, language);
  },

  suggest(query: string, language: LearningLanguageCode = "en"): string[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (language !== "en") {
      return allMultilingualEntries
        .filter((w) => w.language === language && normalizeMultilingualToken(w.word, language).startsWith(q))
        .slice(0, 8)
        .map((w) => w.word);
    }
    return vocabularyService
      .all()
      .filter((w) => w.word.toLowerCase().startsWith(q))
      .slice(0, 8)
      .map((w) => w.word);
  },

  // Placeholder for future remote API integration (kept server-side via route).
  async lookupRemote(_word: string): Promise<Word | null> {
    return null;
  },

  // ---- Saved sentences ----
  getSavedSentences(): SavedSentence[] {
    return storageService.get<SavedSentence[]>(KEYS.savedSentences, []);
  },
  toggleSentence(en: string, zh: string, source?: string): boolean {
    const list = this.getSavedSentences();
    const idx = list.findIndex((s) => s.en === en);
    if (idx >= 0) {
      list.splice(idx, 1);
      storageService.set(KEYS.savedSentences, list);
      return false;
    }
    list.unshift({ id: Math.random().toString(36).slice(2), en, zh, savedAt: new Date().toISOString(), source });
    storageService.set(KEYS.savedSentences, list);
    return true;
  },
  isSentenceSaved(en: string): boolean {
    return this.getSavedSentences().some((s) => s.en === en);
  },
};
