import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const dynamic = "force-dynamic";

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
    const provider = String(body.provider || "local").trim();

    if (!userId || !email) {
      return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("app_user_sessions").upsert(
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
        },
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("App heartbeat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
