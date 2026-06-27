import type { LearningLanguageCode } from "@/types";
import type { SpeakOptions } from "@/services/speechService";

export interface LearningLanguage {
  code: LearningLanguageCode;
  label: string;
  zhName: string;
  nativeName: string;
  flag: string;
  speechLang: string;
  recordLabel: string;
  freeOpening: { target: string; zh: string };
  ttsInstructions: string;
}

export const LEARNING_LANGUAGES: LearningLanguage[] = [
  {
    code: "en",
    label: "English",
    zhName: "英文",
    nativeName: "English",
    flag: "🇺🇸",
    speechLang: "en-US",
    recordLabel: "英文",
    freeOpening: {
      target: "Hi! What would you like to talk about today?",
      zh: "嗨！今天想聊什麼呢？",
    },
    ttsInstructions: "Speak clear natural English for a language learner. Use a warm, crisp, non-raspy voice with strong volume.",
  },
  {
    code: "ja",
    label: "Japanese",
    zhName: "日文",
    nativeName: "日本語",
    flag: "🇯🇵",
    speechLang: "ja-JP",
    recordLabel: "日文",
    freeOpening: {
      target: "こんにちは。今日はどんなことを話したいですか？",
      zh: "你好。今天想聊什麼呢？",
    },
    ttsInstructions: "Speak natural Japanese for a learner. Use clear standard Japanese pronunciation, friendly classroom energy, and strong clean volume.",
  },
  {
    code: "ko",
    label: "Korean",
    zhName: "韓文",
    nativeName: "한국어",
    flag: "🇰🇷",
    speechLang: "ko-KR",
    recordLabel: "韓文",
    freeOpening: {
      target: "안녕하세요. 오늘은 어떤 이야기를 해 볼까요?",
      zh: "你好。今天想聊什麼呢？",
    },
    ttsInstructions: "Speak natural Korean for a learner. Use clear Seoul-style pronunciation, friendly classroom energy, and strong clean volume.",
  },
  {
    code: "it",
    label: "Italian",
    zhName: "義大利文",
    nativeName: "Italiano",
    flag: "🇮🇹",
    speechLang: "it-IT",
    recordLabel: "義大利文",
    freeOpening: {
      target: "Ciao! Di cosa vuoi parlare oggi?",
      zh: "你好！今天想聊什麼呢？",
    },
    ttsInstructions: "Speak natural Italian for a learner. Use clear standard Italian pronunciation, warm teacher energy, and strong clean volume.",
  },
];

export function getLearningLanguage(code?: string | null): LearningLanguage {
  return LEARNING_LANGUAGES.find((lang) => lang.code === code) ?? LEARNING_LANGUAGES[0];
}

export function languageFromLabel(label?: string | null): LearningLanguageCode {
  const raw = (label || "").toLowerCase();
  if (raw.includes("japanese") || raw.includes("日文") || raw.includes("日本")) return "ja";
  if (raw.includes("korean") || raw.includes("韓文") || raw.includes("韓")) return "ko";
  if (raw.includes("italian") || raw.includes("義大利")) return "it";
  return "en";
}

export function voiceForLanguage(code?: LearningLanguageCode): SpeakOptions {
  const lang = getLearningLanguage(code);
  return {
    lang: lang.speechLang,
    voiceKeywords: [lang.speechLang.toLowerCase()],
    ttsVoice: "nova",
    ttsInstructions: lang.ttsInstructions,
    volumeGain: 1.55,
  };
}
