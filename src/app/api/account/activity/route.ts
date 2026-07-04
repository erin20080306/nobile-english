import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const dynamic = "force-dynamic";

function normalizePath(value: unknown): string {
  const path = String(value || "/").trim() || "/";
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean.slice(0, 160);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase server env", missing: missingSupabaseServerEnv() },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const provider = String(body.provider || "local").trim().toLowerCase();
    const path = normalizePath(body.path);
    const title = String(body.title || "").trim().slice(0, 120);

    if (!userId || !email) {
      return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: sessionError } = await supabase.from("app_user_sessions").upsert(
      {
        user_id: userId,
        email,
        name: name || null,
        provider: provider || null,
        last_seen_at: now,
        raw_user: {
          userId,
          email,
          name,
          provider,
          lastPath: path,
          lastTitle: title,
        },
      },
      { onConflict: "user_id" }
    );
    if (sessionError) throw sessionError;

    if (provider !== "google") {
      return NextResponse.json({ success: true, tracked: false });
    }

    const { data: existing, error: existingError } = await supabase
      .from("app_user_page_activity")
      .select("visit_count, first_seen_at")
      .eq("user_id", userId)
      .eq("path", path)
      .maybeSingle();
    if (existingError) throw existingError;

    const visitCount = Math.max(0, Number(existing?.visit_count || 0)) + 1;
    const { error } = await supabase.from("app_user_page_activity").upsert(
      {
        user_id: userId,
        email,
        name: name || null,
        provider: "google",
        path,
        title: title || null,
        visit_count: visitCount,
        first_seen_at: existing?.first_seen_at || now,
        last_seen_at: now,
        user_agent: (req.headers.get("user-agent") || "").slice(0, 240),
      },
      { onConflict: "user_id,path" }
    );
    if (error) throw error;

    return NextResponse.json({ success: true, tracked: true });
  } catch (error) {
    console.error("App activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
