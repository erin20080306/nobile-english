import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LearningLanguageCode } from "@/types";

export const ARTICLE_LANGUAGES = ["en", "ja", "ko", "it", "es"] as const satisfies readonly LearningLanguageCode[];
export const MIN_ARTICLE_SENTENCES = 6;
export const MAX_ARTICLE_SENTENCES = 10;
export const MIN_ARTICLE_QUESTIONS = 3;
export const MAX_ARTICLE_QUESTIONS = 5;
export const MIN_READING_QUIZ_PERCENT = 60;

export function taipeiDate(offsetDays = 0): string {
  const now = new Date();
  const taipei = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  taipei.setDate(taipei.getDate() + offsetDays);
  const year = taipei.getFullYear();
  const month = String(taipei.getMonth() + 1).padStart(2, "0");
  const day = String(taipei.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function assertServiceConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase service environment variables are not configured");
  }
  return { supabaseUrl, serviceKey };
}

export function serviceSupabase(): SupabaseClient {
  const { supabaseUrl, serviceKey } = assertServiceConfig();
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function requireCronOrAdmin(request: Request): Response | null {
  const cronSecret = process.env.CRON_SECRET || process.env.ARTICLE_CRON_SECRET;
  const adminSecret = process.env.ADMIN_API_SECRET;
  const authorization = request.headers.get("authorization") || "";
  const cronHeader = request.headers.get("x-cron-secret") || "";
  const adminHeader = request.headers.get("x-admin-secret") || "";

  if (cronSecret && (authorization === `Bearer ${cronSecret}` || cronHeader === cronSecret)) return null;
  if (adminSecret && adminHeader === adminSecret) return null;

  return Response.json({ error: "Unauthorized article admin request" }, { status: 401 });
}

export async function signedAudioUrlForPath(
  supabase: SupabaseClient,
  audioPath?: string | null
): Promise<string | null> {
  if (!audioPath) return null;
  if (/^(blob:|data:|https?:|stub:)/.test(audioPath)) return null;

  const bucket = process.env.TTS_AUDIO_BUCKET || process.env.SUPABASE_TTS_BUCKET || "tts-audio";
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(audioPath, 60 * 30);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function normalizeLanguage(input?: string | null): LearningLanguageCode {
  return ARTICLE_LANGUAGES.includes(input as LearningLanguageCode) ? input as LearningLanguageCode : "en";
}

export function isStableAudioPath(path?: string | null) {
  return Boolean(path && !/^(blob:|data:|https?:|stub:)/.test(path));
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
