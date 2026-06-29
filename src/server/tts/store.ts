import { randomUUID } from "crypto";
import { assetCacheKey } from "./hash";
import type {
  AudioFormat,
  SynthesisOutput,
  TtsAssetType,
  TtsAudioAsset,
} from "./types";

export interface ReserveInput {
  languageCode: string;
  voiceProfileId: string;
  provider: string;
  providerModel: string;
  normalizedText: string;
  textHash: string;
  audioFormat: AudioFormat;
  audioVersion: number;
  assetType: TtsAssetType;
  sceneId?: string;
  sceneVersion?: number;
}

// Persistence boundary for the site-wide TTS cache. The in-memory implementation
// is used by the offline skeleton; a Supabase-backed implementation should be
// added later (see createSupabaseStore note) using the schema in supabase/migrations.
export interface TtsAssetStore {
  getReadyByKey(params: {
    provider: string;
    providerModel: string;
    languageCode: string;
    voiceProfileId: string;
    textHash: string;
    audioFormat: AudioFormat;
    audioVersion: number;
  }): Promise<TtsAudioAsset | null>;

  // Atomically returns an existing row or creates one with status 'generating'.
  // `created` is true only for the caller that won the race (must do synthesis).
  reserve(input: ReserveInput): Promise<{ asset: TtsAudioAsset; created: boolean }>;

  markReady(id: string, output: SynthesisOutput): Promise<TtsAudioAsset>;
  markFailed(id: string): Promise<TtsAudioAsset>;
  getById(id: string): Promise<TtsAudioAsset | null>;
}

function nowIso() {
  return new Date().toISOString();
}

class InMemoryTtsAssetStore implements TtsAssetStore {
  private byId = new Map<string, TtsAudioAsset>();
  private byKey = new Map<string, string>(); // cacheKey -> id

  async getReadyByKey(params: {
    provider: string;
    providerModel: string;
    languageCode: string;
    voiceProfileId: string;
    textHash: string;
    audioFormat: AudioFormat;
    audioVersion: number;
  }): Promise<TtsAudioAsset | null> {
    const id = this.byKey.get(assetCacheKey(params));
    if (!id) return null;
    const asset = this.byId.get(id) || null;
    return asset && asset.status === "ready" ? asset : null;
  }

  async reserve(input: ReserveInput): Promise<{ asset: TtsAudioAsset; created: boolean }> {
    const key = assetCacheKey(input);
    const existingId = this.byKey.get(key);
    if (existingId) {
      const existing = this.byId.get(existingId)!;
      return { asset: existing, created: false };
    }
    const asset: TtsAudioAsset = {
      id: randomUUID(),
      languageCode: input.languageCode,
      voiceProfileId: input.voiceProfileId,
      provider: input.provider,
      providerModel: input.providerModel,
      normalizedText: input.normalizedText,
      textHash: input.textHash,
      audioFormat: input.audioFormat,
      audioPath: null,
      durationMs: null,
      audioVersion: input.audioVersion,
      assetType: input.assetType,
      sceneId: input.sceneId ?? null,
      sceneVersion: input.sceneVersion ?? null,
      status: "generating",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.byId.set(asset.id, asset);
    this.byKey.set(key, asset.id);
    return { asset, created: true };
  }

  async markReady(id: string, output: SynthesisOutput): Promise<TtsAudioAsset> {
    const asset = this.byId.get(id);
    if (!asset) throw new Error(`asset not found: ${id}`);
    const updated: TtsAudioAsset = {
      ...asset,
      status: "ready",
      audioPath: output.audioPath,
      durationMs: output.durationMs,
      audioFormat: output.audioFormat,
      updatedAt: nowIso(),
    };
    this.byId.set(id, updated);
    return updated;
  }

  async markFailed(id: string): Promise<TtsAudioAsset> {
    const asset = this.byId.get(id);
    if (!asset) throw new Error(`asset not found: ${id}`);
    const updated: TtsAudioAsset = { ...asset, status: "failed", updatedAt: nowIso() };
    this.byId.set(id, updated);
    return updated;
  }

  async getById(id: string): Promise<TtsAudioAsset | null> {
    return this.byId.get(id) || null;
  }
}

// Persist the in-memory store across hot reloads in dev.
const globalForStore = globalThis as unknown as { __ttsAssetStore?: TtsAssetStore };

export function getTtsAssetStore(): TtsAssetStore {
  // TODO(prod): when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are present and
  // @supabase/supabase-js is installed, return a Supabase-backed store that maps
  // to the tts_audio_assets table and relies on its unique index for de-dupe.
  if (!globalForStore.__ttsAssetStore) {
    globalForStore.__ttsAssetStore = new InMemoryTtsAssetStore();
  }
  return globalForStore.__ttsAssetStore;
}
