export interface TutorProfile {
  id: string;
  name: string;
  gender: "male" | "female";
  accent: "american" | "british" | "chinese";
  accentLabel: string;
  flag: string;
  lang: string;
  voiceKeywords: string[];
  ttsVoice: "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable" | "nova" | "onyx" | "sage" | "shimmer" | "verse" | "marin" | "cedar";
  ttsInstructions: string;
  description: string;
  avatarSeed: string;
  avatarBg: string;
  photoUrl: string;
  sampleLine: string;
}

export const TUTORS: TutorProfile[] = [
  {
    id: "jake",
    name: "Jake",
    gender: "male",
    accent: "american",
    accentLabel: "美式英語",
    flag: "🇺🇸",
    lang: "en-US",
    voiceKeywords: ["alex", "tom", "fred", "en-us"],
    ttsVoice: "echo",
    ttsInstructions: "Speak like a friendly Californian English tutor. Warm, clear, natural, and not robotic. Keep a relaxed conversational pace.",
    description: "來自加州，語速適中，發音標準清晰",
    avatarSeed: "Jake",
    avatarBg: "#DBEAFE",
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&q=80",
    sampleLine: "Hi, I'm Jake. Let's make your English sound natural today.",
  },
  {
    id: "william",
    name: "William",
    gender: "male",
    accent: "british",
    accentLabel: "英式英語",
    flag: "🇬🇧",
    lang: "en-GB",
    voiceKeywords: ["daniel", "oliver", "en-gb"],
    ttsVoice: "onyx",
    ttsInstructions: "Speak with a polished British tutor style. Calm, confident, articulate, and natural for English learners.",
    description: "來自倫敦，口音優雅，用詞正式道地",
    avatarSeed: "William",
    avatarBg: "#EDE9FE",
    photoUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=320&q=80",
    sampleLine: "Hello, I'm William. We'll practise clear, natural British English.",
  },
  {
    id: "emma",
    name: "Emma",
    gender: "female",
    accent: "american",
    accentLabel: "美式英語",
    flag: "🇺🇸",
    lang: "en-US",
    voiceKeywords: ["samantha", "victoria", "en-us"],
    ttsVoice: "nova",
    ttsInstructions: "Speak like a kind New York English tutor. Bright, encouraging, expressive, and very natural.",
    description: "來自紐約，親切活潑，適合日常對話練習",
    avatarSeed: "Emma",
    avatarBg: "#FCE7F3",
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=80",
    sampleLine: "Hi, I'm Emma. Let's practise real-life English together.",
  },
  {
    id: "amy",
    name: "Amy",
    gender: "female",
    accent: "american",
    accentLabel: "美式英語",
    flag: "🇺🇸",
    lang: "en-US",
    voiceKeywords: ["samantha", "ava", "en-us"],
    ttsVoice: "coral",
    ttsInstructions: "Speak slowly and gently as a patient beginner-friendly English tutor. Friendly, soft, and clear.",
    description: "來自波士頓，語速較慢，非常適合初學者",
    avatarSeed: "Amy",
    avatarBg: "#D1FAE5",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=320&q=80",
    sampleLine: "Hi, I'm Amy. Don't worry, we'll go step by step.",
  },
  {
    id: "sophie",
    name: "Sophie",
    gender: "female",
    accent: "british",
    accentLabel: "英式英語",
    flag: "🇬🇧",
    lang: "en-GB",
    voiceKeywords: ["kate", "serena", "en-gb"],
    ttsVoice: "shimmer",
    ttsInstructions: "Speak like a gentle British pronunciation coach. Warm, patient, elegant, and easy to follow.",
    description: "來自曼徹斯特，溫柔耐心，擅長發音糾正",
    avatarSeed: "Sophie",
    avatarBg: "#FEF3C7",
    photoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=320&q=80",
    sampleLine: "Hello, I'm Sophie. Let's make your pronunciation smoother.",
  },
  {
    id: "lily",
    name: "Lily",
    gender: "female",
    accent: "chinese",
    accentLabel: "中式英語",
    flag: "🇨🇳",
    lang: "en-US",
    voiceKeywords: ["meijia", "samantha", "en-us"],
    ttsVoice: "nova",
    ttsInstructions: "Speak like a bilingual English tutor who understands Traditional Chinese learners. Clear, supportive, and natural.",
    description: "來自北京，了解中文學習者常見問題，中英切換自然",
    avatarSeed: "Lily",
    avatarBg: "#FFE4E6",
    photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=320&q=80",
    sampleLine: "Hi, I'm Lily. I can help you say it in a more natural way.",
  },
];

export const DEFAULT_TUTOR_ID = "emma";

export function getTutorById(id: string): TutorProfile {
  return TUTORS.find((t) => t.id === id) ?? TUTORS.find((t) => t.id === DEFAULT_TUTOR_ID)!;
}
