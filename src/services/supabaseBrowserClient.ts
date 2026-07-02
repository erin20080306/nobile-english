import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser-side Supabase client used for real account auth (Google OAuth) and
// per-user cloud sync of learning data. Falls back to null when the public
// env vars are missing so the app keeps working with local-only accounts.

const globalForSupabase = globalThis as unknown as {
  __browserSupabaseClient?: SupabaseClient;
};

function createBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  if (!globalForSupabase.__browserSupabaseClient) {
    globalForSupabase.__browserSupabaseClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return globalForSupabase.__browserSupabaseClient;
}

export const supabaseBrowserClient = createBrowserClient();
