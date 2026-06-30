import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateTtsAsset } from "@/server/tts/service";
import type { LearningLanguageCode } from "@/types";

export const runtime = "nodejs";

type ArticleRow = { id: string; topic_id: string; language_code: LearningLanguageCode; status: string };
type SentenceRow = { id: string; sentence_text: string; estimated_duration_ms: number };
type AudioRow = { status: string };
type TopicArticleRow = { language_code: string; status: string };
type Token = { text: string; lemma: string; startIndex: number; endIndex: number };

function config() {
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    secret: process.env.CRON_SECRET,
  };
}

function allowed(request: NextRequest, secret?: string) {
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-cron-secret") === secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

function tokenize(text: string, language: LearningLanguageCode): Token[] {
  const locale = ({ en: "en", ja: "ja", ko: "ko", it: "it", es: "es" } as const)[language];
  const parts = Array.from(new Intl.Segmenter(locale, { granularity: "word" }).segment(text));
  return parts
    .filter((part) => part.isWordLike && part.segment.trim())
    .map((part) => {
      const value = part.segment.trim();
      return {
        text: value,
        lemma: language === "en" || language === "it" || language === "es" ? value.toLocaleLowerCase(locale) : value,
        startIndex: part.index,
        endIndex: part.index + value.length,
      };
    });
}

async function createLinks(supabase: ReturnType<typeof createClient>, articleId: string, language: LearningLanguageCode, sentences: SentenceRow[]) {
  const rows = sentences.flatMap((sentence) => tokenize(sentence.sentence_text, language).map((token) => ({
    article_id: articleId,
    sentence_id: sentence.id,
    language_code: language,
    start_index: token.startIndex,
    end_index: token.endIndex,
    display_text: token.text,
    dictionary_entry_id: null,
    phrase_priority: 0,
  })));
  const { error: deleteError } = await supabase.from("reading_article_lexeme_links").delete().eq("article_id", articleId);
  if (deleteError) throw new Error("Failed to refresh reading lexeme links");
  if (!rows.length) return 0;
  const { error: insertError } = await supabase.from("reading_article_lexeme_links").insert(rows);
  if (insertError) throw new Error("Failed to save reading lexeme links");
  return rows.length;
}

async function createAudio(supabase: ReturnType<typeof createClient>, articleId: string, language: LearningLanguageCode, sentences: SentenceRow[]) {
  let cacheHits = 0;
  let cacheMisses = 0;
  let failures = 0;
  for (const sentence of sentences) {
    try {
      const result = await getOrCreateTtsAsset({
        text: sentence.sentence_text,
        languageCode: language,
        assetType: "reading_sentence",
        audioVersionString: "v2_loud",
      });
      if (result.cached) cacheHits += 1; else cacheMisses += 1;
      const stablePath = result.asset.status === "ready" && result.asset.audioPath && !result.asset.audioPath.startsWith("stub://") ? result.asset.audioPath : null;
      if (!stablePath) failures += 1;
      const { error } = await supabase.from("reading_article_audio_assets").upsert({
        article_id: articleId,
        sentence_id: sentence.id,
        language_code: language,
        tts_asset_id: result.asset.id,
        audio_path: stablePath,
        duration_ms: result.asset.durationMs || sentence.estimated_duration_ms,
        audio_version: 2,
        status: stablePath ? "ready" : "failed",
      }, { onConflict: "article_id,sentence_id,language_code" });
      if (error) throw new Error("Failed to save article audio metadata");
    } catch {
      failures += 1;
      await supabase.from("reading_article_audio_assets").upsert({
        article_id: articleId,
        sentence_id: sentence.id,
        language_code: language,
        audio_path: null,
        duration_ms: sentence.estimated_duration_ms,
        audio_version: 2,
        status: "failed",
      }, { onConflict: "article_id,sentence_id,language_code" });
    }
  }
  return { cacheHits, cacheMisses, failures };
}

async function updateReadyState(supabase: ReturnType<typeof createClient>, article: ArticleRow, sentenceCount: number) {
  const { data: rawAudio } = await supabase.from("reading_article_audio_assets").select("status").eq("article_id", article.id);
  const audioRows = (rawAudio || []) as AudioRow[];
  const articleReady = audioRows.length === sentenceCount && audioRows.every((row) => row.status === "ready");
  await supabase.from("reading_articles").update({ status: articleReady ? "ready" : "draft" }).eq("id", article.id);

  const { data: rawArticles } = await supabase.from("reading_articles").select("language_code, status").eq("topic_id", article.topic_id);
  const allArticles = (rawArticles || []) as TopicArticleRow[];
  const expected = new Set(["en", "ja", "ko", "it", "es"]);
  const topicReady = allArticles.length === 5 && allArticles.every((row) => expected.has(row.language_code) && row.status === "ready");
  await supabase.from("reading_article_topics").update({ status: topicReady ? "ready" : "draft" }).eq("id", article.topic_id);
  return { articleReady, topicReady };
}

export async function POST(request: NextRequest) {
  const env = config();
  if (!allowed(request, env.secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.url || !env.key) return NextResponse.json({ error: "Supabase service configuration is missing" }, { status: 500 });

  const body = await request.json().catch(() => ({})) as { articleId?: string };
  if (!body.articleId) return NextResponse.json({ error: "articleId is required" }, { status: 400 });
  const supabase = createClient(env.url, env.key, { auth: { persistSession: false } });

  try {
    const { data: rawArticle, error: articleError } = await supabase.from("reading_articles").select("id, topic_id, language_code, status").eq("id", body.articleId).single();
    const article = rawArticle as ArticleRow | null;
    if (articleError || !article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    if (article.status === "published") return NextResponse.json({ error: "Published articles cannot be regenerated" }, { status: 409 });

    const { data: rawSentences, error: sentencesError } = await supabase.from("reading_article_sentences").select("id, sentence_text, estimated_duration_ms").eq("article_id", article.id).order("sentence_order");
    const sentences = (rawSentences || []) as SentenceRow[];
    if (sentencesError || sentences.length < 6 || sentences.length > 10) return NextResponse.json({ error: "Article must contain 6 to 10 sentences before prewarm" }, { status: 400 });

    const lexemeLinks = await createLinks(supabase, article.id, article.language_code, sentences);
    const audio = await createAudio(supabase, article.id, article.language_code, sentences);
    const state = await updateReadyState(supabase, article, sentences.length);
    return NextResponse.json({ success: true, articleId: article.id, lexemeLinks, audio, ...state });
  } catch (error) {
    console.error("Daily article prewarm error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to prewarm article" }, { status: 500 });
  }
}
