import { randomUUID } from "crypto";
import { getSupabaseServerClient } from "@/server/supabaseClient";
import { assetCacheKey } from "./hash";
import type {
  AudioFormat,
  AudioVersionString,
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
  audioVersionString: AudioVersionString;
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
    audioVersionString: AudioVersionString;
  }): Promise<TtsAudioAsset | null>;

  // Atomically returns an existing row or creates one with status 'generating'.
  // `created` is true only for the caller that won the race (must do synthesis).
  reserve(input: ReserveInput): Promise<{ asset: TtsAudioAsset; created: boolean }>;

  markReady(id: string, output: SynthesisOutput): Promise<TtsAudioAsset>;
  markFailed(id: string): Promise<TtsAudioAsset>;
  getById(id: string): Promise<TtsAudioAsset | null>;

  // Atomically flips a 'failed' row back to 'generating' so a new synthesis
  // attempt can run. Returns null if the row is no longer 'failed' (another
  // caller already retried it, or it since became ready).
  retryFailed(id: string): Promise<TtsAudioAsset | null>;
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
    audioVersionString: AudioVersionString;
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
      audioVersion: 1, // Keep for backward compatibility
      assetType: input.assetType,
      sceneId: input.sceneId ?? null,
      sceneVersion: input.sceneVersion ?? null,
      status: "generating",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      // v2_loud fields
      rawAudioPath: null,
      processedAudioPath: null,
      audioVersionString: input.audioVersionString,
      integratedLufs: null,
      truePeakDbtp: null,
      loudnessRangeLu: null,
      processingStatus: "none",
      processingError: null,
      processedAt: null,
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

  async retryFailed(id: string): Promise<TtsAudioAsset | null> {
    const asset = this.byId.get(id);
    if (!asset || asset.status !== "failed") return null;
    const updated: TtsAudioAsset = { ...asset, status: "generating", updatedAt: nowIso() };
    this.byId.set(id, updated);
    return updated;
  }
}

type TtsAudioAssetRow = {
  id: string;
  language_code: string;
  voice_profile_id: string | null;
  voice_profile_key?: string | null;
  provider: string;
  provider_model: string;
  normalized_text: string;
  text_hash: string;
  audio_format: AudioFormat;
  audio_path: string | null;
  duration_ms: number | null;
  audio_version: number;
  asset_type: TtsAssetType;
  scene_id: string | null;
  scene_version: number | null;
  status: "generating" | "ready" | "failed";
  created_at: string;
  updated_at: string;
  raw_audio_path: string | null;
  processed_audio_path: string | null;
  audio_version_string: AudioVersionString;
  integrated_lufs: number | null;
  true_peak_dbtp: number | null;
  loudness_range_lu: number | null;
  processing_status: "none" | "pending" | "processing" | "ready" | "failed";
  processing_error: string | null;
  processed_at: string | null;
};

function rowToAsset(row: TtsAudioAssetRow): TtsAudioAsset {
  return {
    id: row.id,
    languageCode: row.language_code,
    voiceProfileId: row.voice_profile_key || row.voice_profile_id || "",
    provider: row.provider,
    providerModel: row.provider_model,
    normalizedText: row.normalized_text,
    textHash: row.text_hash,
    audioFormat: row.audio_format,
    audioPath: row.audio_path,
    durationMs: row.duration_ms,
    audioVersion: row.audio_version,
    assetType: row.asset_type,
    sceneId: row.scene_id,
    sceneVersion: row.scene_version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rawAudioPath: row.raw_audio_path,
    processedAudioPath: row.processed_audio_path,
    audioVersionString: row.audio_version_string,
    integratedLufs: row.integrated_lufs,
    truePeakDbtp: row.true_peak_dbtp,
    loudnessRangeLu: row.loudness_range_lu,
    processingStatus: row.processing_status,
    processingError: row.processing_error,
    processedAt: row.processed_at,
  };
}

class SupabaseTtsAssetStore implements TtsAssetStore {
  private readonly supabase = getSupabaseServerClient();

  private requireClient() {
    if (!this.supabase) throw new Error("Supabase TTS store is not configured");
    return this.supabase;
  }

  private async findByKey(params: {
    provider: string;
    providerModel: string;
    languageCode: string;
    voiceProfileId: string;
    textHash: string;
    audioFormat: AudioFormat;
    audioVersionString: AudioVersionString;
  }) {
    const { data, error } = await this.requireClient()
      .from("tts_audio_assets")
      .select("*")
      .eq("provider", params.provider)
      .eq("provider_model", params.providerModel)
      .eq("language_code", params.languageCode)
      .eq("voice_profile_key", params.voiceProfileId)
      .eq("text_hash", params.textHash)
      .eq("audio_format", params.audioFormat)
      .eq("audio_version_string", params.audioVersionString)
      .maybeSingle();

    if (error) throw new Error(`TTS cache lookup failed: ${error.message}`);
    return data ? rowToAsset(data as TtsAudioAssetRow) : null;
  }

  async getReadyByKey(params: {
    provider: string;
    providerModel: string;
    languageCode: string;
    voiceProfileId: string;
    textHash: string;
    audioFormat: AudioFormat;
    audioVersionString: AudioVersionString;
  }): Promise<TtsAudioAsset | null> {
    const asset = await this.findByKey(params);
    return asset?.status === "ready" ? asset : null;
  }

  async reserve(input: ReserveInput): Promise<{ asset: TtsAudioAsset; created: boolean }> {
    const existing = await this.findByKey(input);
    if (existing) return { asset: existing, created: false };

    const row = {
      language_code: input.languageCode,
      voice_profile_id: null,
      voice_profile_key: input.voiceProfileId,
      provider: input.provider,
      provider_model: input.providerModel,
      normalized_text: input.normalizedText,
      text_hash: input.textHash,
      audio_format: input.audioFormat,
      audio_version: 1,
      audio_version_string: input.audioVersionString,
      asset_type: input.assetType,
      scene_id: input.sceneId ?? null,
      scene_version: input.sceneVersion ?? null,
      status: "generating",
      processing_status: "none",
    };

    const { data, error } = await this.requireClient()
      .from("tts_audio_assets")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      const raced = await this.findByKey(input);
      if (raced) return { asset: raced, created: false };
      throw new Error(`TTS cache reserve failed: ${error.message}`);
    }

    return { asset: rowToAsset(data as TtsAudioAssetRow), created: true };
  }

  async markReady(id: string, output: SynthesisOutput): Promise<TtsAudioAsset> {
    const { data, error } = await this.requireClient()
      .from("tts_audio_assets")
      .update({
        status: "ready",
        audio_path: output.audioPath,
        duration_ms: output.durationMs,
        audio_format: output.audioFormat,
        processed_audio_path: output.audioPath,
        processing_status: "ready",
        processed_at: nowIso(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(`TTS cache markReady failed: ${error.message}`);
    return rowToAsset(data as TtsAudioAssetRow);
  }

  async markFailed(id: string): Promise<TtsAudioAsset> {
    const { data, error } = await this.requireClient()
      .from("tts_audio_assets")
      .update({
        status: "failed",
        processing_status: "failed",
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(`TTS cache markFailed failed: ${error.message}`);
    return rowToAsset(data as TtsAudioAssetRow);
  }

  async getById(id: string): Promise<TtsAudioAsset | null> {
    const { data, error } = await this.requireClient()
      .from("tts_audio_assets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`TTS cache getById failed: ${error.message}`);
    return data ? rowToAsset(data as TtsAudioAssetRow) : null;
  }

  async retryFailed(id: string): Promise<TtsAudioAsset | null> {
    // The `.eq("status", "failed")` guard makes this atomic: only the caller
    // that actually flips the row wins the retry; concurrent callers get 0
    // rows updated and this returns null for them.
    const { data, error } = await this.requireClient()
      .from("tts_audio_assets")
      .update({ status: "generating", processing_status: "none" })
      .eq("id", id)
      .eq("status", "failed")
      .select("*")
      .maybeSingle();

    if (error || !data) return null;
    return rowToAsset(data as TtsAudioAssetRow);
  }
}

// Persist the store across hot reloads in dev.
const globalForStore = globalThis as unknown as { __ttsAssetStore?: TtsAssetStore };

export function getTtsAssetStore(): TtsAssetStore {
  if (!globalForStore.__ttsAssetStore) {
    globalForStore.__ttsAssetStore = getSupabaseServerClient()
      ? new SupabaseTtsAssetStore()
      : new InMemoryTtsAssetStore();
  }
  return globalForStore.__ttsAssetStore;
}
