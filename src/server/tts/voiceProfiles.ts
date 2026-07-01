import type { VoiceGender, VoiceProfile } from "./types";

// In-memory mirror of tutor-level voice profiles. English has six visual tutors;
// Japanese/Korean/Italian/Spanish each have one male and one female tutor.
// Production providers can map these logical profiles to their chosen voices.
export const SEED_VOICE_PROFILES: VoiceProfile[] = [
  { id: "vp-en-jake", languageCode: "en-US", voiceName: "en-US-Chirp3-HD-Charon", voiceGender: "male", isDefault: true, isActive: true },
  { id: "vp-en-william", languageCode: "en-GB", voiceName: "en-GB-Chirp3-HD-Charon", voiceGender: "male", isDefault: false, isActive: true },
  { id: "vp-en-emma", languageCode: "en-US", voiceName: "en-US-Chirp3-HD-Aoede", voiceGender: "female", isDefault: true, isActive: true },
  { id: "vp-en-amy", languageCode: "en-US", voiceName: "en-US-Chirp3-HD-Aoede", voiceGender: "female", isDefault: false, isActive: true },
  { id: "vp-en-sophie", languageCode: "en-GB", voiceName: "en-GB-Chirp3-HD-Aoede", voiceGender: "female", isDefault: false, isActive: true },
  { id: "vp-en-lily", languageCode: "en-US", voiceName: "en-US-Chirp3-HD-Aoede", voiceGender: "female", isDefault: false, isActive: true },
  { id: "vp-ja-haruto", languageCode: "ja-JP", voiceName: "ja-JP-Chirp3-HD-Charon", voiceGender: "male", isDefault: true, isActive: true },
  { id: "vp-ja-yui", languageCode: "ja-JP", voiceName: "ja-JP-Chirp3-HD-Aoede", voiceGender: "female", isDefault: true, isActive: true },
  { id: "vp-ko-minjun", languageCode: "ko-KR", voiceName: "ko-KR-Chirp3-HD-Charon", voiceGender: "male", isDefault: true, isActive: true },
  { id: "vp-ko-seoyeon", languageCode: "ko-KR", voiceName: "ko-KR-Chirp3-HD-Aoede", voiceGender: "female", isDefault: true, isActive: true },
  { id: "vp-it-marco", languageCode: "it-IT", voiceName: "it-IT-Chirp3-HD-Charon", voiceGender: "male", isDefault: true, isActive: true },
  { id: "vp-it-giulia", languageCode: "it-IT", voiceName: "it-IT-Chirp3-HD-Aoede", voiceGender: "female", isDefault: true, isActive: true },
  { id: "vp-es-carlos", languageCode: "es-ES", voiceName: "es-ES-Chirp3-HD-Charon", voiceGender: "male", isDefault: true, isActive: true },
  { id: "vp-es-sofia", languageCode: "es-ES", voiceName: "es-ES-Chirp3-HD-Aoede", voiceGender: "female", isDefault: true, isActive: true },
];

// Map app learning-language codes (en/ja/ko/it/es) to BCP-47 languageCode used by voices.
const APP_TO_BCP47: Record<string, string> = {
  en: "en-US",
  ja: "ja-JP",
  ko: "ko-KR",
  it: "it-IT",
  es: "es-ES",
};

export function toVoiceLanguageCode(languageCode: string): string {
  return APP_TO_BCP47[languageCode] || languageCode;
}

export function resolveVoiceProfile(
  languageCode: string,
  gender: VoiceGender = "female",
  profiles: VoiceProfile[] = SEED_VOICE_PROFILES
): VoiceProfile | null {
  const bcp47 = toVoiceLanguageCode(languageCode);
  const active = profiles.filter((p) => p.isActive && p.languageCode === bcp47);
  return (
    active.find((p) => p.voiceGender === gender && p.isDefault) ||
    active.find((p) => p.voiceGender === gender) ||
    active.find((p) => p.isDefault) ||
    active[0] ||
    null
  );
}

export function getVoiceProfileById(
  id: string,
  profiles: VoiceProfile[] = SEED_VOICE_PROFILES
): VoiceProfile | null {
  return profiles.find((p) => p.id === id) || null;
}
