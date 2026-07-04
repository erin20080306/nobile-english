import { NextResponse } from "next/server";
import type { DialogueTranscriptLine, LearningRecord } from "@/types";
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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, 400))
    .filter(Boolean)
    .slice(0, 80);
}

function normalizeTranscript(value: unknown): LearningRecord["transcript"] {
  if (!Array.isArray(value)) return [];
  const lines: DialogueTranscriptLine[] = [];
  value.slice(0, 80).forEach((line) => {
    if (!line || typeof line !== "object") return;
    const item = line as Record<string, unknown>;
    const en = cleanString(item.en, 4000);
    if (!en) return;
    lines.push({
      role: item.role === "user" ? "user" : "tutor",
      en,
      zh: cleanString(item.zh, 4000) || undefined,
      naturalness: Number.isFinite(item.naturalness) ? Number(item.naturalness) : undefined,
      betterWay: cleanString(item.betterWay, 4000) || undefined,
      grammarTip: cleanString(item.grammarTip, 4000) || undefined,
      zhExplain: cleanString(item.zhExplain, 4000) || undefined,
    });
  });
  return lines;
}

function rowToRecord(row: Record<string, unknown>): LearningRecord | null {
  const id = cleanString(row.id, 120);
  const type = row.type as LearningRecord["type"];
  if (!id || !type || !RECORD_TYPES.has(type)) return null;

  const targetLanguage = cleanString(row.target_language, 16);

  return {
    id,
    type,
    targetLanguage: targetLanguage ? (targetLanguage as LearningRecord["targetLanguage"]) : undefined,
    title: cleanString(row.title, 500) || "Learning record",
    sceneName: cleanString(row.scene_name, 500) || undefined,
    enContent: cleanString(row.en_content, 8000) || undefined,
    zhContent: cleanString(row.zh_content, 8000) || undefined,
    userAnswer: cleanString(row.user_answer, 8000) || undefined,
    suggestion: cleanString(row.suggestion, 8000) || undefined,
    conversationWords: normalizeStringArray(row.conversation_words),
    transcript: normalizeTranscript(row.transcript),
    score: Number.isFinite(row.score) ? Number(row.score) : 0,
    completed: Boolean(row.completed),
    minutes: Number.isFinite(row.minutes) ? Number(row.minutes) : 0,
    date: cleanString(row.date, 80) || new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const userId = cleanString(new URL(req.url).searchParams.get("userId"), 160);
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase environment variables not configured", missing: missingSupabaseServerEnv() },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("learning_records")
    .select(
      "id,type,target_language,title,scene_name,en_content,zh_content,user_answer,suggestion,conversation_words,transcript,score,completed,minutes,date"
    )
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(800);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load learning records", message: error.message },
      { status: 500 }
    );
  }

  const records = (data || [])
    .map((row) => rowToRecord(row as Record<string, unknown>))
    .filter((record): record is LearningRecord => Boolean(record));

  return NextResponse.json({ records });
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
