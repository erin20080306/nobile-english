import { getSupabaseServerClient } from "@/server/supabaseClient";
import type { AudioFormat } from "./types";

const DEFAULT_BUCKET = "tts-audio-assets";

function bucketName() {
  return process.env.TTS_AUDIO_BUCKET || DEFAULT_BUCKET;
}

function contentType(format: AudioFormat) {
  return format === "mp3" ? "audio/mpeg" : "audio/mp4";
}

export function isSupabaseStoragePath(path: string) {
  return path.startsWith("supabase://");
}

export async function storeGeneratedAudio({
  bytes,
  provider,
  providerModel,
  voiceProfileId,
  textHash,
  audioFormat,
}: {
  bytes: Uint8Array;
  provider: string;
  providerModel: string;
  voiceProfileId: string;
  textHash: string;
  audioFormat: AudioFormat;
}): Promise<string> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const base64 = Buffer.from(bytes).toString("base64");
    const mime = contentType(audioFormat);
    return `data:${mime};base64,${base64}`;
  }

  const bucket = bucketName();
  const cleanVoice = voiceProfileId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const cleanModel = providerModel.replace(/[^a-zA-Z0-9_-]/g, "-");
  const path = `${provider}/${cleanModel}/${cleanVoice}/${textHash}.${audioFormat}`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: contentType(audioFormat),
    upsert: true,
  });

  if (error) throw new Error(`Supabase TTS upload failed: ${error.message}`);
  return `supabase://${bucket}/${path}`;
}

export async function createSignedAudioUrl(path: string): Promise<string | null> {
  if (!isSupabaseStoragePath(path)) return path;

  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const withoutScheme = path.slice("supabase://".length);
  const slash = withoutScheme.indexOf("/");
  if (slash <= 0) return null;

  const bucket = withoutScheme.slice(0, slash);
  const objectPath = withoutScheme.slice(slash + 1);
  const expiresIn = Number(process.env.TTS_SIGNED_URL_EXPIRES_SECONDS || 60 * 60);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, Math.max(60, expiresIn));

  if (error) throw new Error(`Supabase TTS signed URL failed: ${error.message}`);
  return data.signedUrl;
}
