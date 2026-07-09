import { assetCacheKey, computeTextHash } from "./hash";
import { combineTutorText, normalizeText } from "./normalizeText";
import { getTtsProvider } from "./provider";
import { getTtsAssetStore } from "./store";
import { createSignedAudioUrl, storeGeneratedAudio } from "./storage";
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
export async function buildSignedUrl(asset: TtsAudioAsset): Promise<string | null> {
  if (asset.status !== "ready" || !asset.audioPath) return null;
  return createSignedAudioUrl(asset.audioPath);
}

export interface PeekResult {
  cached: boolean;
  billableChars: number;
  textHash: string;
  voiceProfileId: string;
  languageCode: string;
}

function normalizeForAsset(input: GetOrCreateInput): string {
  return input.assetType === "tutor_reply" || input.assetType === "dynamic_tutor_reply"
    ? combineTutorText(input.text, input.textPart2)
    : normalizeText(input.text);
}

// Check whether a text is already cached and how many characters it would bill,
// WITHOUT calling the provider. Used by prewarm dry-run cost estimation.
export async function peekTtsAsset(input: GetOrCreateInput): Promise<PeekResult> {
  const provider = await getTtsProvider(input.assetType);
  const store = getTtsAssetStore();

  const normalizedText = normalizeForAsset(input);

  const voice =
    (input.voiceProfileId ? getVoiceProfileById(input.voiceProfileId) : null) ||
    resolveVoiceProfile(input.languageCode, input.voiceGender);
  if (!voice) throw new Error(`no voice profile for language: ${input.languageCode}`);

  const audioFormat = provider.audioFormat || input.audioFormat || "mp3";
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

export async function getCachedTtsAsset(
  input: GetOrCreateInput
): Promise<GetOrCreateResult | null> {
  const provider = await getTtsProvider(input.assetType);
  const store = getTtsAssetStore();

  const normalizedText = normalizeForAsset(input);
  if (!normalizedText) throw new Error("empty text after normalization");

  const voice =
    (input.voiceProfileId ? getVoiceProfileById(input.voiceProfileId) : null) ||
    resolveVoiceProfile(input.languageCode, input.voiceGender);
  if (!voice) throw new Error(`no voice profile for language: ${input.languageCode}`);

  const audioFormat = provider.audioFormat || input.audioFormat || "mp3";
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

  return ready ? { asset: ready, cached: true, signedUrl: await buildSignedUrl(ready) } : null;
}

export async function getOrCreateTtsAsset(
  input: GetOrCreateInput
): Promise<GetOrCreateResult> {
  const provider = await getTtsProvider(input.assetType);
  const store = getTtsAssetStore();

  const normalizedText = normalizeForAsset(input);

  if (!normalizedText) throw new Error("empty text after normalization");

  const voice =
    (input.voiceProfileId ? getVoiceProfileById(input.voiceProfileId) : null) ||
    resolveVoiceProfile(input.languageCode, input.voiceGender);
  if (!voice) throw new Error(`no voice profile for language: ${input.languageCode}`);
  const voiceProfileId = voice.id;

  const audioFormat = provider.audioFormat || input.audioFormat || "mp3";
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
  if (ready) return { asset: ready, cached: true, signedUrl: await buildSignedUrl(ready) };

  // 2) Reserve a row (status = generating) or attach to an existing one.
  const reserved = await store.reserve({
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
  let asset = reserved.asset;
  let created = reserved.created;

  // reserve() matches on key regardless of status, so a row left permanently
  // 'failed' by an earlier broken attempt would otherwise be returned forever
  // without ever retrying synthesis. Try to resurrect it; only one concurrent
  // caller wins this race (atomic status guard in retryFailed).
  if (!created && asset.status === "failed") {
    const resurrected = await store.retryFailed(asset.id);
    if (resurrected) {
      asset = resurrected;
      created = true;
    }
  }

  if (!created) {
    // Another worker is generating (or already did). Await any in-flight promise.
    const key = assetCacheKey(keyParams);
    const pending = inflight().get(key);
    const finalAsset = pending ? await pending : asset;
    return { asset: finalAsset, cached: true, signedUrl: await buildSignedUrl(finalAsset) };
  }

  // 3) We won the race. Synthesize now (unavoidable), then return the audio INLINE
  //    (base64) immediately. The Supabase cache upload runs detached so the response
  //    is not blocked by cross-region storage latency. If the upload is interrupted,
  //    the row stays non-ready and the next identical request simply re-synthesizes.
  const key = assetCacheKey(keyParams);
  let synth;
  try {
    synth = await provider.synthesize({
      text: normalizedText,
      languageCode: voice.languageCode,
      voiceName: voice.voiceName,
      voiceProfileId,
      voiceGender: voice.voiceGender,
      assetType: input.assetType,
      audioFormat,
      textHash,
    });
  } catch (err) {
    await store.markFailed(asset.id);
    inflight().delete(key);
    throw err;
  }

  // Promise that resolves once the cache row is persisted; concurrent callers for
  // the same text_hash await this instead of paying for a second synthesis.
  let resolveReady!: (asset: TtsAudioAsset) => void;
  let rejectReady!: (error: unknown) => void;
  const readyPromise = new Promise<TtsAudioAsset>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  readyPromise.catch(() => {});
  inflight().set(key, readyPromise);

  const persist = async () => {
    try {
      let output = synth;
      if (synth.audioBytes && synth.audioBytes.byteLength) {
        const audioPath = await storeGeneratedAudio({
          bytes: synth.audioBytes,
          provider: provider.name,
          providerModel: provider.model,
          voiceProfileId,
          textHash,
          audioFormat: synth.audioFormat,
        });
        output = { audioPath, durationMs: synth.durationMs, audioFormat: synth.audioFormat };
      }
      resolveReady(await store.markReady(asset.id, output));
    } catch (err) {
      await store.markFailed(asset.id).catch(() => {});
      rejectReady(err);
    } finally {
      inflight().delete(key);
    }
  };

  // Fresh bytes -> return inline right away, persist to cache in the background.
  if (synth.audioBytes && synth.audioBytes.byteLength) {
    const audioBase64 = synth.audioBytes.toString("base64");
    void persist();
    return { asset, cached: false, signedUrl: null, audioBase64 };
  }

  // No inline bytes (stub provider): wait for persistence and return a signed URL.
  await persist();
  const finalAsset = await readyPromise;
  return { asset: finalAsset, cached: false, signedUrl: await buildSignedUrl(finalAsset) };
}
