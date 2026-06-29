import type { VoiceGender, VoiceProfile } from "./types";

// In-memory mirror of the `voice_profiles` seed (see supabase/migrations/0001).
// Used by the offline skeleton until a Supabase-backed store is wired up.
// Voice ids are NOT hard-coded in the frontend; they are resolved here on the server.
export const SEED_VOICE_PROFILES: VoiceProfile[] = [
  { id: "vp-en-aoede", languageCode: "en-US", voiceName: "en-US-Chirp3-HD-Aoede", voiceGender: "female", isDefault: true, isActive: true },
  { id: "vp-en-charon", languageCode: "en-US", voiceName: "en-US-Chirp3-HD-Charon", voiceGender: "male", isDefault: true, isActive: true },
  { id: "vp-ja-aoede", languageCode: "ja-JP", voiceName: "ja-JP-Chirp3-HD-Aoede", voiceGender: "female", isDefault: true, isActive: true },
  { id: "vp-ja-charon", languageCode: "ja-JP", voiceName: "ja-JP-Chirp3-HD-Charon", voiceGender: "male", isDefault: true, isActive: true },
  { id: "vp-it-aoede", languageCode: "it-IT", voiceName: "it-IT-Chirp3-HD-Aoede", voiceGender: "female", isDefault: true, isActive: true },
  { id: "vp-it-charon", languageCode: "it-IT", voiceName: "it-IT-Chirp3-HD-Charon", voiceGender: "male", isDefault: true, isActive: true },
  { id: "vp-ko-aoede", languageCode: "ko-KR", voiceName: "ko-KR-Chirp3-HD-Aoede", voiceGender: "female", isDefault: true, isActive: true },
  { id: "vp-ko-charon", languageCode: "ko-KR", voiceName: "ko-KR-Chirp3-HD-Charon", voiceGender: "male", isDefault: true, isActive: true },
  { id: "vp-es-aoede", languageCode: "es-ES", voiceName: "es-ES-Chirp3-HD-Aoede", voiceGender: "female", isDefault: true, isActive: true },
  { id: "vp-es-charon", languageCode: "es-ES", voiceName: "es-ES-Chirp3-HD-Charon", voiceGender: "male", isDefault: true, isActive: true },
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
