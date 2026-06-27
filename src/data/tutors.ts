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
  ttsVolumeGain: number;
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
    ttsInstructions: "Speak like a friendly Californian English tutor. Warm, crisp, natural, and not robotic. Project your voice clearly with bright energy and a strong microphone presence.",
    ttsVolumeGain: 1.58,
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
    ttsInstructions: "Speak with a polished British tutor style. Calm, confident, articulate, and natural for English learners. Keep the voice crisp, clean, and easy to hear.",
    ttsVolumeGain: 1.55,
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
    ttsInstructions: "Speak like a kind New York English tutor. Bright, encouraging, expressive, and very natural. Keep the voice clear, full, crisp, and easy to hear.",
    ttsVolumeGain: 1.58,
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
    ttsInstructions: "Speak slowly and gently as a patient beginner-friendly English tutor. Use a clean, sweet, non-raspy voice with clear pronunciation and stronger volume.",
    ttsVolumeGain: 1.58,
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
    ttsVoice: "coral",
    ttsInstructions: "Speak like a gentle British pronunciation coach. Warm, patient, elegant, easy to follow, crisp, and clearly projected.",
    ttsVolumeGain: 1.55,
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
    accentLabel: "中式英文",
    flag: "🇨🇳",
    lang: "en-US",
    voiceKeywords: ["meijia", "ting-ting", "sin-ji", "mei-jia"],
    ttsVoice: "shimmer",
    ttsInstructions: "Speak English like a sweet, warm Asian woman English teacher whose first language is Mandarin Chinese. Use Mandarin-influenced English pronunciation, clear syllables, gentle rhythm, bright friendly energy, and strong volume. Keep it understandable for learners. Do not sound American, raspy, muffled, flat, or robotic.",
    ttsVolumeGain: 1.62,
    description: "中式英文聲音，甜美清楚，也了解中文學習者問題",
    avatarSeed: "Lily",
    avatarBg: "#FFE4E6",
    photoUrl: "/assets/tutors/lily-asian-tutor.jpg",
    sampleLine: "Hi, I'm Lily. I'll help you speak English clearly and confidently.",
  },
];

export const DEFAULT_TUTOR_ID = "emma";

export function getTutorById(id: string): TutorProfile {
  return TUTORS.find((t) => t.id === id) ?? TUTORS.find((t) => t.id === DEFAULT_TUTOR_ID)!;
}
