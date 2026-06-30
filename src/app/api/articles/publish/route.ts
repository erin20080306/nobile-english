import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const REQUIRED_LANGUAGES = ["en", "ja", "ko", "it", "es"];

function environment() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    cronSecret: process.env.CRON_SECRET,
  };
}

function authorized(request: NextRequest, secret?: string): boolean {
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-cron-secret") === secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

async function ensureRewards(supabase: ReturnType<typeof createClient>, articleId: string, languageCode: string) {
  const cropTypes: Record<string, string> = {
    en: "english_crop", ja: "japanese_crop", ko: "korean_crop", it: "italian_crop", es: "spanish_crop",
  };
  const rewards = [
    { article_id: articleId, language_code: languageCode, reward_type: "coins", reward_amount: 10, crop_type: null },
    { article_id: articleId, language_code: languageCode, reward_type: "seeds", reward_amount: 5, crop_type: cropTypes[languageCode] || "generic_crop" },
    { article_id: articleId, language_code: languageCode, reward_type: "water", reward_amount: 3, crop_type: null },
  ];
  const { error } = await supabase.from("reading_article_rewards").upsert(rewards, {
    onConflict: "article_id,language_code,reward_type",
  });
  if (error) throw new Error(`Failed to prepare ${languageCode} rewards`);
}

export async function POST(request: NextRequest) {
  const env = environment();
  if (!authorized(request, env.cronSecret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.supabaseUrl || !env.serviceRoleKey) return NextResponse.json({ error: "Supabase service configuration is missing" }, { status: 500 });

  let body: { topicId?: string };
  try {
    body = (await request.json()) as { topicId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.topicId) return NextResponse.json({ error: "topicId is required" }, { status: 400 });

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } });
  try {
    const { data: topic, error: topicError } = await supabase
      .from("reading_article_topics")
      .select("id, status")
      .eq("id", body.topicId)
      .single();
    if (topicError || !topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    if (topic.status !== "ready") return NextResponse.json({ error: "Topic must be ready before publish" }, { status: 409 });

    const { data: articles, error: articlesError } = await supabase
      .from("reading_articles")
      .select("id, language_code, status")
      .eq("topic_id", topic.id);
    if (articlesError || !articles) return NextResponse.json({ error: "Failed to read topic articles" }, { status: 500 });

    const languages = articles.map((article) => article.language_code);
    const missingLanguages = REQUIRED_LANGUAGES.filter((language) => !languages.includes(language));
    if (articles.length !== REQUIRED_LANGUAGES.length || missingLanguages.length > 0) {
      return NextResponse.json({ error: "Five language articles are required", missingLanguages }, { status: 400 });
    }
    const notReady = articles.filter((article) => article.status !== "ready");
    if (notReady.length) return NextResponse.json({ error: "Some articles are not ready", articles: notReady }, { status: 409 });

    for (const article of articles) {
      const [{ count: sentenceCount, error: sentenceError }, { count: questionCount, error: questionError }, { data: audioRows, error: audioError }, { count: lexemeCount, error: lexemeError }] = await Promise.all([
        supabase.from("reading_article_sentences").select("id", { count: "exact", head: true }).eq("article_id", article.id),
        supabase.from("reading_article_questions").select("id", { count: "exact", head: true }).eq("article_id", article.id),
        supabase.from("reading_article_audio_assets").select("sentence_id, status").eq("article_id", article.id),
        supabase.from("reading_article_lexeme_links").select("id", { count: "exact", head: true }).eq("article_id", article.id),
      ]);
      if (sentenceError || questionError || audioError || lexemeError) {
        return NextResponse.json({ error: `Failed to validate ${article.language_code} article` }, { status: 500 });
      }
      const audiosReady = (audioRows || []).length === sentenceCount && (audioRows || []).every((row) => row.status === "ready");
      if (!sentenceCount || sentenceCount < 6 || sentenceCount > 10 || !questionCount || questionCount < 3 || questionCount > 5 || !lexemeCount || !audiosReady) {
        return NextResponse.json({
          error: `${article.language_code} article is incomplete`,
          language: article.language_code,
          sentenceCount,
          questionCount,
          lexemeCount,
          audioCount: (audioRows || []).length,
          audiosReady,
        }, { status: 409 });
      }
    }

    const publishedAt = new Date().toISOString();
    const { error: articleUpdateError } = await supabase
      .from("reading_articles")
      .update({ status: "published", published_at: publishedAt })
      .eq("topic_id", topic.id);
    if (articleUpdateError) throw new Error("Failed to publish articles");

    for (const article of articles) await ensureRewards(supabase, article.id, article.language_code);

    const { error: topicUpdateError } = await supabase
      .from("reading_article_topics")
      .update({ status: "published" })
      .eq("id", topic.id);
    if (topicUpdateError) throw new Error("Failed to publish topic");

    return NextResponse.json({ success: true, topicId: topic.id, articlesPublished: articles.length });
  } catch (error) {
    console.error("Daily article publish error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to publish daily articles" }, { status: 500 });
  }
}
