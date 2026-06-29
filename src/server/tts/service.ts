import { assetCacheKey, computeTextHash } from "./hash";
import { combineTutorText, normalizeText } from "./normalizeText";
import { getTtsProvider } from "./provider";
import { getTtsAssetStore } from "./store";
import type {
  GetOrCreateInput,
  GetOrCreateResult,
  TtsAudioAsset,
} from "./types";
import { getVoiceProfileById, resolveVoiceProfile } from "./voiceProfiles";

// In-process de-dup: while one request synthesizes a text_hash, concurrent
// requests for the same key await the same promise instead of paying twice.
const globalForLock = globalThis as unknown as {
  __ttsInflight?: Map<string, Promise<TtsAudioAsset>>;
};
function inflight(): Map<string, Promise<TtsAudioAsset>> {
  if (!globalForLock.__ttsInflight) globalForLock.__ttsInflight = new Map();
  return globalForLock.__ttsInflight;
}

// A signed, short-lived URL for the client to play. For the stub provider this
// is just the placeholder path; the production storage adapter returns a real one.
export function buildSignedUrl(asset: TtsAudioAsset): string | null {
  if (asset.status !== "ready" || !asset.audioPath) return null;
  return asset.audioPath;
}

export interface PeekResult {
  cached: boolean;
  billableChars: number;
  textHash: string;
  voiceProfileId: string;
  languageCode: string;
}

// Check whether a text is already cached and how many characters it would bill,
// WITHOUT calling the provider. Used by prewarm dry-run cost estimation.
export async function peekTtsAsset(input: GetOrCreateInput): Promise<PeekResult> {
  const provider = getTtsProvider();
  const store = getTtsAssetStore();

  const normalizedText =
    input.assetType === "tutor_reply" || input.assetType === "dynamic_tutor_reply"
      ? combineTutorText(input.text, input.textPart2)
      : normalizeText(input.text);

  const voice =
    (input.voiceProfileId ? getVoiceProfileById(input.voiceProfileId) : null) ||
    resolveVoiceProfile(input.languageCode, input.voiceGender);
  if (!voice) throw new Error(`no voice profile for language: ${input.languageCode}`);

  const audioFormat = input.audioFormat || "m4a";
  const audioVersionString = input.audioVersionString ?? "v2_loud";
  const textHash = computeTextHash({
    provider: provider.name,
    providerModel: provider.model,
    languageCode: voice.languageCode,
    voiceProfileId: voice.id,
    audioVersionString,
    normalizedText,
  });

  const ready = await store.getReadyByKey({
    provider: provider.name,
    providerModel: provider.model,
    languageCode: voice.languageCode,
    voiceProfileId: voice.id,
    textHash,
    audioFormat,
    audioVersionString,
  });

  return {
    cached: Boolean(ready),
    billableChars: Array.from(normalizedText).length,
    textHash,
    voiceProfileId: voice.id,
    languageCode: voice.languageCode,
  };
}

export async function getOrCreateTtsAsset(
  input: GetOrCreateInput
): Promise<GetOrCreateResult> {
  const provider = getTtsProvider();
  const store = getTtsAssetStore();

  const normalizedText =
    input.assetType === "tutor_reply" || input.assetType === "dynamic_tutor_reply"
      ? combineTutorText(input.text, input.textPart2)
      : normalizeText(input.text);

  if (!normalizedText) throw new Error("empty text after normalization");

  const voice =
    (input.voiceProfileId ? getVoiceProfileById(input.voiceProfileId) : null) ||
    resolveVoiceProfile(input.languageCode, input.voiceGender);
  if (!voice) throw new Error(`no voice profile for language: ${input.languageCode}`);
  const voiceProfileId = voice.id;

  const audioFormat = input.audioFormat || "m4a";
  const audioVersionString = input.audioVersionString ?? "v2_loud";

  const textHash = computeTextHash({
    provider: provider.name,
    providerModel: provider.model,
    languageCode: voice.languageCode,
    voiceProfileId,
    audioVersionString,
    normalizedText,
  });

  const keyParams = {
    provider: provider.name,
    providerModel: provider.model,
    languageCode: voice.languageCode,
    voiceProfileId,
    textHash,
    audioFormat,
    audioVersionString,
  };

  // 1) Fast path: already cached and ready -> never call the provider.
  const ready = await store.getReadyByKey(keyParams);
  if (ready) return { asset: ready, cached: true, signedUrl: buildSignedUrl(ready) };

  // 2) Reserve a row (status = generating) or attach to an existing one.
  const { asset, created } = await store.reserve({
    languageCode: voice.languageCode,
    voiceProfileId,
    provider: provider.name,
    providerModel: provider.model,
    normalizedText,
    textHash,
    audioFormat,
    audioVersionString,
    assetType: input.assetType,
    sceneId: input.sceneId,
    sceneVersion: input.sceneVersion,
  });

  if (!created) {
    // Another worker is generating (or already did). Await any in-flight promise.
    const key = assetCacheKey(keyParams);
    const pending = inflight().get(key);
    const finalAsset = pending ? await pending : asset;
    return { asset: finalAsset, cached: true, signedUrl: buildSignedUrl(finalAsset) };
  }

  // 3) We won the race: synthesize, post-process, persist.
  const key = assetCacheKey(keyParams);
  const job = (async () => {
    try {
      const output = await provider.synthesize({
        text: normalizedText,
        languageCode: voice.languageCode,
        voiceName: voice.voiceName,
        audioFormat,
        textHash,
      });
      return await store.markReady(asset.id, output);
    } catch (err) {
      await store.markFailed(asset.id);
      throw err;
    } finally {
      inflight().delete(key);
    }
  })();
  inflight().set(key, job);

  const finalAsset = await job;
  return { asset: finalAsset, cached: false, signedUrl: buildSignedUrl(finalAsset) };
}
