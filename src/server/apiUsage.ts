import { getSupabaseServerClient } from "./supabaseClient";

/**
 * Lightweight per-day API call counters, backed by the `api_usage_counters`
 * table + `increment_api_usage` Postgres function (see
 * supabase/migrations/20260703_api_usage_counters.sql). Used to show the
 * admin panel how many times each external API (Gemini models, TTS
 * providers, etc.) has been called recently, so an admin can proactively
 * switch to a cheaper/fallback model before hitting a paid quota limit.
 *
 * Best-effort only: counting failures are swallowed so they never block or
 * fail the real request that triggered the count.
 */

export async function incrementApiUsage(apiName: string, amount = 1): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  try {
    await supabase.rpc("increment_api_usage", { p_api_name: apiName, p_amount: amount });
  } catch {
    // Table/function may not be migrated yet, or Supabase may be briefly
    // unavailable. Never let usage counting break the caller's real request.
  }
}

export interface ApiUsageSummary {
  apiName: string;
  today: number;
  last7Days: number;
  last30Days: number;
}

const TRACKED_API_NAMES = [
  "gemini:gemini-3.1-flash-lite",
  "gemini:gemini-3.5-flash-lite",
  "gemini:gemini-3.5-flash",
  "gemini:gemini-2.5-flash-lite",
  "gemini:gemini-2.5-flash",
  "tts:google-standard",
  "tts:google-premium",
  "tts:polly-standard",
  "tts:polly-neural",
  "tts:openai-gpt-4o-mini-tts",
  "tts:openai-tts-1",
  "stt:google",
  "gnews:search",
  "gnews:top-headlines",
  "dictionary:free-dictionary",
  "dictionary:wiktionary",
  "dictionary:urimal-saem",
  "dictionary:openai",
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getApiUsageSummary(): Promise<ApiUsageSummary[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const now = new Date();
  const todayStr = isoDate(now);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 29);

  try {
    const { data, error } = await supabase
      .from("api_usage_counters")
      .select("api_name, usage_date, count")
      .gte("usage_date", isoDate(thirtyDaysAgo))
      .order("usage_date", { ascending: false });
    if (error) throw error;

    const sevenDaysAgoStr = isoDate(sevenDaysAgo);
    const map = new Map<string, ApiUsageSummary>(
      TRACKED_API_NAMES.map((apiName) => [apiName, { apiName, today: 0, last7Days: 0, last30Days: 0 }])
    );
    for (const row of (data || []) as Array<{ api_name: string; usage_date: string; count: number }>) {
      const name = row.api_name;
      if (!map.has(name)) map.set(name, { apiName: name, today: 0, last7Days: 0, last30Days: 0 });
      const entry = map.get(name)!;
      entry.last30Days += row.count;
      if (row.usage_date >= sevenDaysAgoStr) entry.last7Days += row.count;
      if (row.usage_date === todayStr) entry.today += row.count;
    }
    return Array.from(map.values()).sort((a, b) => b.last30Days - a.last30Days);
  } catch {
    // Table may not exist yet (migration not applied) or Supabase briefly
    // unavailable; show an empty list rather than failing the admin page.
    return [];
  }
}
