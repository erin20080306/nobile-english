import { NextResponse } from "next/server";
import type { LearningRecord } from "@/types";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const runtime = "nodejs";

const RECORD_TYPES = new Set<LearningRecord["type"]>([
  "scene",
  "dialogue",
  "exam",
  "custom",
  "word",
  "reading_article",
]);

interface SyncRequest {
  userId?: string;
  records?: Partial<LearningRecord>[];
}

function cleanString(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeRecord(record: Partial<LearningRecord>, userId: string) {
  const id = cleanString(record.id, 120);
  const type = record.type;
  const date = cleanString(record.date, 80) || new Date().toISOString();

  if (!id || !type || !RECORD_TYPES.has(type)) return null;

  return {
    user_id: userId,
    id,
    type,
    target_language: cleanString(record.targetLanguage, 16) || null,
    title: cleanString(record.title, 500) || "Learning record",
    scene_name: cleanString(record.sceneName, 500) || null,
    en_content: cleanString(record.enContent, 8000) || null,
    zh_content: cleanString(record.zhContent, 8000) || null,
    user_answer: cleanString(record.userAnswer, 8000) || null,
    suggestion: cleanString(record.suggestion, 8000) || null,
    conversation_words: Array.isArray(record.conversationWords) ? record.conversationWords.slice(0, 80) : [],
    transcript: Array.isArray(record.transcript) ? record.transcript.slice(0, 80) : [],
    score: Number.isFinite(record.score) ? Number(record.score) : 0,
    completed: Boolean(record.completed),
    minutes: Number.isFinite(record.minutes) ? Number(record.minutes) : 0,
    date,
    updated_at: new Date().toISOString(),
  };
}

export async function POST(req: Request) {
  let body: SyncRequest;
  try {
    body = (await req.json()) as SyncRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = cleanString(body.userId, 160);
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  if (!Array.isArray(body.records)) {
    return NextResponse.json({ error: "Missing records" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase environment variables not configured", missing: missingSupabaseServerEnv() },
      { status: 503 }
    );
  }

  const rows = body.records
    .slice(0, 100)
    .map((record) => normalizeRecord(record, userId))
    .filter((record): record is NonNullable<ReturnType<typeof normalizeRecord>> => Boolean(record));

  if (!rows.length) return NextResponse.json({ syncedIds: [] });

  const { error } = await supabase
    .from("learning_records")
    .upsert(rows, { onConflict: "user_id,id" });

  if (error) {
    return NextResponse.json(
      { error: "Failed to sync learning records", message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ syncedIds: rows.map((row) => row.id) });
}
