import { NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const runtime = "nodejs";

type GoalKind = "wordReview" | "scene" | "dialogue";

const KIND_COUNT_COLUMN: Record<GoalKind, string> = {
  wordReview: "word_review_count",
  scene: "scene_count",
  dialogue: "dialogue_count",
};

interface DailyGoalRow {
  user_id: string;
  date: string;
  word_review_target: number;
  scene_target: number;
  dialogue_target: number;
  word_review_count: number;
  scene_count: number;
  dialogue_count: number;
}

function cleanString(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = cleanString(searchParams.get("userId"));
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase environment variables not configured", missing: missingSupabaseServerEnv() },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("daily_goals")
    .select("*")
    .eq("user_id", userId)
    .in("date", [todayStr(), yesterdayStr()]);

  if (error) {
    return NextResponse.json({ error: "Failed to load daily goals", message: error.message }, { status: 500 });
  }

  const rows = (data || []) as DailyGoalRow[];
  const today = rows.find((row) => row.date === todayStr()) || null;
  const yesterday = rows.find((row) => row.date === yesterdayStr()) || null;

  return NextResponse.json({ today, yesterday });
}

interface PostBody {
  userId?: string;
  action?: "setTargets" | "increment";
  targets?: { wordReview?: number; scene?: number; dialogue?: number };
  kind?: GoalKind;
}

function clampTarget(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(50, Math.round(n)));
}

export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = cleanString(body.userId);
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase environment variables not configured", missing: missingSupabaseServerEnv() },
      { status: 503 }
    );
  }

  const date = todayStr();

  if (body.action === "setTargets") {
    const targets = body.targets || {};
    const { data: existing } = await supabase
      .from("daily_goals")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    const row = {
      user_id: userId,
      date,
      word_review_target: clampTarget(targets.wordReview ?? (existing as DailyGoalRow | null)?.word_review_target ?? 0),
      scene_target: clampTarget(targets.scene ?? (existing as DailyGoalRow | null)?.scene_target ?? 0),
      dialogue_target: clampTarget(targets.dialogue ?? (existing as DailyGoalRow | null)?.dialogue_target ?? 0),
      word_review_count: (existing as DailyGoalRow | null)?.word_review_count ?? 0,
      scene_count: (existing as DailyGoalRow | null)?.scene_count ?? 0,
      dialogue_count: (existing as DailyGoalRow | null)?.dialogue_count ?? 0,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("daily_goals")
      .upsert(row, { onConflict: "user_id,date" })
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Failed to save targets", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ today: data });
  }

  if (body.action === "increment") {
    const kind = body.kind;
    if (!kind || !KIND_COUNT_COLUMN[kind]) {
      return NextResponse.json({ error: "Missing or invalid kind" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("daily_goals")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    const current = existing as DailyGoalRow | null;
    const row = {
      user_id: userId,
      date,
      word_review_target: current?.word_review_target ?? 0,
      scene_target: current?.scene_target ?? 0,
      dialogue_target: current?.dialogue_target ?? 0,
      word_review_count: current?.word_review_count ?? 0,
      scene_count: current?.scene_count ?? 0,
      dialogue_count: current?.dialogue_count ?? 0,
      updated_at: new Date().toISOString(),
    };
    (row as Record<string, number | string>)[KIND_COUNT_COLUMN[kind]] =
      (current?.[KIND_COUNT_COLUMN[kind] as keyof DailyGoalRow] as number || 0) + 1;

    const { data, error } = await supabase
      .from("daily_goals")
      .upsert(row, { onConflict: "user_id,date" })
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Failed to update progress", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ today: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
