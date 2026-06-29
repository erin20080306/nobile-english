// Shared server-side TTS cache types. These mirror the Supabase schema in
// supabase/migrations and the production spec. No client code should import this module.

export type SupportedLanguage =
  | "en-US"
  | "en-GB"
  | "ja-JP"
  | "it-IT"
  | "ko-KR"
  | "es-ES"
  | "es-US";

export type VoiceGender = "female" | "male" | "neutral";

export type TtsAssetType =
  | "practice_sentence"
  | "tutor_reply"
  | "tutor_pass"
  | "tutor_minor_correction"
  | "tutor_retry"
  | "tutor_hint"
  | "tutor_complete"
  | "word_pronunciation"
  | "dynamic_tutor_reply";

export type TtsAssetStatus = "generating" | "ready" | "failed";

export type AudioFormat = "m4a" | "mp3";

export interface VoiceProfile {
  id: string;
  languageCode: string;
  voiceName: string;
  voiceGender: VoiceGender;
  isDefault: boolean;
  isActive: boolean;
}

export interface TtsAudioAsset {
  id: string;
  languageCode: string;
  voiceProfileId: string;
  provider: string;
  providerModel: string;
  normalizedText: string;
  textHash: string;
  audioFormat: AudioFormat;
  audioPath: string | null;
  durationMs: number | null;
  audioVersion: number;
  assetType: TtsAssetType;
  sceneId: string | null;
  sceneVersion: number | null;
  status: TtsAssetStatus;
  createdAt: string;
  updatedAt: string;
}

// Identity used for the unique index / text_hash composition.
export interface TtsAssetKey {
  provider: string;
  providerModel: string;
  languageCode: string;
  voiceProfileId: string;
  textHash: string;
  audioFormat: AudioFormat;
  audioVersion: number;
}

export interface GetOrCreateInput {
  text: string;
  // For tutor replies, pass both parts; they are combined into ONE audio file.
  textPart2?: string;
  languageCode: string;
  assetType: TtsAssetType;
  voiceGender?: VoiceGender;
  voiceProfileId?: string;
  audioFormat?: AudioFormat;
  audioVersion?: number;
  sceneId?: string;
  sceneVersion?: number;
}

export interface GetOrCreateResult {
  asset: TtsAudioAsset;
  cached: boolean;
  // Short-lived URL the client uses to play the audio (null while generating/failed).
  signedUrl: string | null;
}

// Output of a TTS provider after synthesis + post-processing.
export interface SynthesisOutput {
  audioPath: string;
  durationMs: number;
  audioFormat: AudioFormat;
}

export interface SynthesisRequest {
  text: string; // already normalized + combined
  languageCode: string;
  voiceName: string;
  audioFormat: AudioFormat;
  textHash: string;
}
