import { getSupabaseServerClient } from "./supabaseClient";

// Small generic key-value settings store backed by the `app_settings` table.
// Lets admins flip runtime configuration (e.g. preferred TTS provider) from
// the admin UI without needing a Vercel env var change + redeploy. Falls back
// to null (caller should use its own default) when Supabase is not
// configured or the table has not been migrated yet.

interface CacheEntry {
  value: string | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const globalForSettings = globalThis as unknown as {
  __appSettingsCache?: Map<string, CacheEntry>;
};

function cache(): Map<string, CacheEntry> {
  if (!globalForSettings.__appSettingsCache) globalForSettings.__appSettingsCache = new Map();
  return globalForSettings.__appSettingsCache;
}

export async function getAppSetting(key: string): Promise<string | null> {
  const cached = cache().get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    const value = (data?.value as string | undefined) ?? null;
    cache().set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch {
    // Table may not exist yet, or Supabase may be briefly unavailable; treat
    // as "no override" so callers fall back to env-var/auto detection.
    return null;
  }
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase 尚未設定，無法儲存設定");

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;

  cache().set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}
