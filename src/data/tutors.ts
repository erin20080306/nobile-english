export interface TutorProfile {
  id: string;
  name: string;
  gender: "male" | "female";
  accent: "american" | "british" | "chinese";
  accentLabel: string;
  flag: string;
  lang: string;
  voiceKeywords: string[];
  description: string;
  avatarSeed: string;
  avatarBg: string;
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
    description: "來自加州，語速適中，發音標準清晰",
    avatarSeed: "Jake",
    avatarBg: "#DBEAFE",
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
    description: "來自倫敦，口音優雅，用詞正式道地",
    avatarSeed: "William",
    avatarBg: "#EDE9FE",
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
    description: "來自紐約，親切活潑，適合日常對話練習",
    avatarSeed: "Emma",
    avatarBg: "#FCE7F3",
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
    description: "來自波士頓，語速較慢，非常適合初學者",
    avatarSeed: "Amy",
    avatarBg: "#D1FAE5",
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
    description: "來自曼徹斯特，溫柔耐心，擅長發音糾正",
    avatarSeed: "Sophie",
    avatarBg: "#FEF3C7",
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
    description: "來自北京，了解中文學習者常見問題，中英切換自然",
    avatarSeed: "Lily",
    avatarBg: "#FFE4E6",
  },
];

export const DEFAULT_TUTOR_ID = "emma";

export function getTutorById(id: string): TutorProfile {
  return TUTORS.find((t) => t.id === id) ?? TUTORS.find((t) => t.id === DEFAULT_TUTOR_ID)!;
}
