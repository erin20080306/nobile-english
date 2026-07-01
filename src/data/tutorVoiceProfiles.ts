import type { LearningLanguageCode } from "@/types";
import { TUTORS } from "./tutors";

export const TUTOR_TO_VOICE_PROFILE_ID: Record<string, string> = {
  jake: "vp-en-jake",
  william: "vp-en-william",
  emma: "vp-en-emma",
  amy: "vp-en-amy",
  sophie: "vp-en-sophie",
  lily: "vp-en-lily",
  haruto: "vp-ja-haruto",
  yui: "vp-ja-yui",
  minjun: "vp-ko-minjun",
  seoyeon: "vp-ko-seoyeon",
  marco: "vp-it-marco",
  giulia: "vp-it-giulia",
  carlos: "vp-es-carlos",
  sofia: "vp-es-sofia",
};

const BCP47_TO_APP_LANGUAGE: Record<string, LearningLanguageCode> = {
  "en-US": "en",
  "en-GB": "en",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "it-IT": "it",
  "es-ES": "es",
};

function toAppLanguage(languageCode: string): LearningLanguageCode {
  if (languageCode === "en" || languageCode === "ja" || languageCode === "ko" || languageCode === "it" || languageCode === "es") {
    return languageCode;
  }
  return BCP47_TO_APP_LANGUAGE[languageCode] || "en";
}

export function getTutorVoiceProfileId(tutorId: string): string | undefined {
  return TUTOR_TO_VOICE_PROFILE_ID[tutorId];
}

export function getTutorVoiceProfileIdsForLanguage(languageCode: string): string[] {
  const appLanguage = toAppLanguage(languageCode);
  return TUTORS
    .filter((tutor) => tutor.targetLanguage === appLanguage)
    .map((tutor) => TUTOR_TO_VOICE_PROFILE_ID[tutor.id])
    .filter((id): id is string => Boolean(id));
}
