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
  ttsVoice?: SpeakOptions["ttsVoice"];
  ttsInstructions: string;
  voiceKeywords: string[];
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
    ttsVoice: "shimmer",
    ttsInstructions: "Speak clear natural English for a language learner. Use a warm, gentle, pleasant voice with crisp pronunciation and strong clean volume.",
    voiceKeywords: ["samantha", "ava", "google us english", "microsoft aria", "microsoft jenny", "alex", "zira"],
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
    ttsVoice: "shimmer",
    ttsInstructions: "Speak natural Japanese for a learner. Use clear standard Japanese pronunciation, gentle friendly classroom energy, and strong clean volume.",
    voiceKeywords: ["kyoko", "otoya", "google 日本語", "microsoft nanami", "microsoft keita"],
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
    ttsVoice: "shimmer",
    ttsInstructions: "Speak natural Korean for a learner. Use clear Seoul-style pronunciation, gentle friendly classroom energy, and strong clean volume.",
    voiceKeywords: ["yuna", "google 한국", "microsoft sunhi", "microsoft injoon"],
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
    ttsVoice: "shimmer",
    ttsInstructions: "Speak natural Italian for a learner. Use clear standard Italian pronunciation, warm gentle teacher energy, and strong clean volume.",
    voiceKeywords: ["alice", "luca", "google italiano", "microsoft elsa", "microsoft isabella"],
  },
  {
    code: "es",
    label: "Spanish",
    zhName: "西班牙文",
    nativeName: "Español",
    flag: "🇪🇸",
    speechLang: "es-ES",
    recordLabel: "西班牙文",
    freeOpening: {
      target: "¡Hola! ¿De qué quieres hablar hoy?",
      zh: "你好！今天想聊什麼呢？",
    },
    ttsVoice: "shimmer",
    ttsInstructions: "Speak natural Spanish from Spain for a learner. Use clear standard pronunciation, warm gentle teacher energy, expressive Spanish rhythm, and strong clean volume.",
    voiceKeywords: ["monica", "paulina", "google español", "microsoft elvira", "microsoft alvaro"],
  },
];

// Traditional Chinese speech recognition language code, used as the
// secondary/alternative language for Google Cloud Speech-to-Text in the
// "free chat with AI tutor" mode (learners may ask questions in Chinese).
export const ZH_TW_SPEECH_LANG = "zh-TW";

export function getLearningLanguage(code?: string | null): LearningLanguage {
  return LEARNING_LANGUAGES.find((lang) => lang.code === code) ?? LEARNING_LANGUAGES[0];
}

export function languageFromLabel(label?: string | null): LearningLanguageCode {
  const raw = (label || "").toLowerCase();
  if (raw.includes("japanese") || raw.includes("日文") || raw.includes("日本")) return "ja";
  if (raw.includes("korean") || raw.includes("韓文") || raw.includes("韓")) return "ko";
  if (raw.includes("italian") || raw.includes("義大利")) return "it";
  if (raw.includes("spanish") || raw.includes("西班牙") || raw.includes("español") || raw.includes("espanol")) return "es";
  return "en";
}

export function voiceForLanguage(code?: LearningLanguageCode, rate = 1, voiceGender?: "male" | "female"): SpeakOptions {
  const lang = getLearningLanguage(code);
  return {
    lang: lang.speechLang,
    voiceKeywords: [...lang.voiceKeywords, lang.speechLang.toLowerCase()],
    ttsVoice: lang.ttsVoice || "shimmer",
    ttsInstructions: lang.ttsInstructions,
    rate,
    volumeGain: 1.45,
    voiceGender,
  };
}
