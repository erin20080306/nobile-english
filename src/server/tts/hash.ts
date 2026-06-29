import { createHash } from "crypto";
import type { AudioFormat, AudioVersionString } from "./types";

// text_hash = sha256(provider | providerModel | languageCode | voiceProfileId | audioVersionString | normalizedText)
// The fields are joined with a separator that cannot appear in ids to avoid collisions.
export function computeTextHash(params: {
  provider: string;
  providerModel: string;
  languageCode: string;
  voiceProfileId: string;
  audioVersionString: AudioVersionString;
  normalizedText: string;
}): string {
  const parts = [
    params.provider,
    params.providerModel,
    params.languageCode,
    params.voiceProfileId,
    params.audioVersionString,
    params.normalizedText,
  ];
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

// Stable cache key string for in-flight de-duplication and the unique index tuple.
export function assetCacheKey(params: {
  provider: string;
  providerModel: string;
  languageCode: string;
  voiceProfileId: string;
  textHash: string;
  audioFormat: AudioFormat;
  audioVersionString: AudioVersionString;
}): string {
  return [
    params.provider,
    params.providerModel,
    params.languageCode,
    params.voiceProfileId,
    params.textHash,
    params.audioFormat,
    params.audioVersionString,
  ].join("|");
}
