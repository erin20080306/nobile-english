import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAYLOAD_BYTES = 900_000;

function cleanString(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function payloadSize(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

async function loadSnapshot(userId: string, email: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      response: NextResponse.json(
        { error: "Missing Supabase server env", missing: missingSupabaseServerEnv() },
        { status: 503 }
      ),
    };
  }

  if (userId) {
    const { data, error } = await supabase
      .from("user_app_state_snapshots")
      .select("user_id,email,payload,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      return { response: NextResponse.json({ error: "Failed to load app state", message: error.message }, { status: 500 }) };
    }
    if (data) return { snapshot: data };
  }

  if (!email) return { snapshot: null };

  const { data, error } = await supabase
    .from("user_app_state_snapshots")
    .select("user_id,email,payload,updated_at")
    .eq("email", email.toLowerCase())
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { response: NextResponse.json({ error: "Failed to load app state", message: error.message }, { status: 500 }) };
  }

  return { snapshot: data || null };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = cleanString(url.searchParams.get("userId"), 160);
  const email = cleanString(url.searchParams.get("email"), 320).toLowerCase();
  if (!userId && !email) {
    return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
  }

  const result = await loadSnapshot(userId, email);
  if (result.response) return result.response;

  return NextResponse.json({ snapshot: result.snapshot });
}

export async function POST(req: NextRequest) {
  let body: { userId?: unknown; email?: unknown; payload?: unknown };
  try {
    body = (await req.json()) as { userId?: unknown; email?: unknown; payload?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = cleanString(body.userId, 160);
  const email = cleanString(body.email, 320).toLowerCase();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  if (!isPlainObject(body.payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (payloadSize(body.payload) > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase server env", missing: missingSupabaseServerEnv() },
      { status: 503 }
    );
  }

  const { error } = await supabase.from("user_app_state_snapshots").upsert(
    {
      user_id: userId,
      email: email || null,
      payload: body.payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Failed to save app state", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
