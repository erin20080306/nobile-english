import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateTtsAsset } from "@/server/tts/service";
import type { LearningLanguageCode } from "@/types";

export const runtime = "nodejs";

type ArticleRow = { id: string; topic_id: string; language_code: LearningLanguageCode; status: string };
type SentenceRow = { id: string; sentence_text: string; estimated_duration_ms: number };
type AudioRow = { status: string };
type TopicArticleRow = { language_code: string; status: string };
type Token = { text: string; startIndex: number; endIndex: number };
type UntypedDatabase = { from: (table: string) => any };

function config() {
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    secret: process.env.CRON_SECRET,
  };
}

function authorized(request: NextRequest, secret?: string): boolean {
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-cron-secret") === secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

function tokenize(text: string, language: LearningLanguageCode): Token[] {
  const locale = ({ en: "en", ja: "ja", ko: "ko", it: "it", es: "es" } as const)[language];
  const segments = Array.from(new Intl.Segmenter(locale, { granularity: "word" }).segment(text));
  const seen = new Set<string>();
  const output: Token[] = [];

  for (const segment of segments) {
    if (!segment.isWordLike) continue;
    const value = segment.segment.trim();
    const key = `${segment.index}:${value}`;
    if (!value || seen.has(key)) continue;
    seen.add(key);
    output.push({ text: value, startIndex: segment.index, endIndex: segment.index + value.length });
  }
  return output;
}

async function rebuildLexemeLinks(db: UntypedDatabase, articleId: string, language: LearningLanguageCode, sentences: SentenceRow[]) {
  const links = sentences.flatMap((sentence) => tokenize(sentence.sentence_text, language).map((token) => ({
    article_id: articleId,
    sentence_id: sentence.id,
    language_code: language,
    start_index: token.startIndex,
    end_index: token.endIndex,
    display_text: token.text,
    dictionary_entry_id: null,
    phrase_priority: 0,
  })));

  const { error: deleteError } = await db.from("reading_article_lexeme_links").delete().eq("article_id", articleId);
  if (deleteError) throw new Error("Failed to refresh reading lexeme links");
  if (!links.length) return 0;

  const { error: insertError } = await db.from("reading_article_lexeme_links").insert(links);
  if (insertError) throw new Error("Failed to save reading lexeme links");
  return links.length;
}

async function prewarmSentenceAudio(db: UntypedDatabase, articleId: string, language: LearningLanguageCode, sentences: SentenceRow[]) {
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
      if (result.cached) cacheHits += 1;
      else cacheMisses += 1;

      const path = result.asset.status === "ready" && result.asset.audioPath && !result.asset.audioPath.startsWith("stub://")
        ? result.asset.audioPath
        : null;
      if (!path) failures += 1;

      const { error } = await db.from("reading_article_audio_assets").upsert({
        article_id: articleId,
        sentence_id: sentence.id,
        language_code: language,
        tts_asset_id: result.asset.id,
        // Only store a stable provider/storage path; never an expiring signed URL.
        audio_path: path,
        duration_ms: result.asset.durationMs || sentence.estimated_duration_ms,
        audio_version: 2,
        status: path ? "ready" : "failed",
      }, { onConflict: "article_id,sentence_id,language_code" });
      if (error) throw new Error("Failed to save article audio metadata");
    } catch (error) {
      failures += 1;
      await db.from("reading_article_audio_assets").upsert({
        article_id: articleId,
        sentence_id: sentence.id,
        language_code: language,
        audio_path: null,
        duration_ms: sentence.estimated_duration_ms,
        audio_version: 2,
        status: "failed",
      }, { onConflict: "article_id,sentence_id,language_code" });
      console.error("Reading sentence prewarm failed", error);
    }
  }

  return { cacheHits, cacheMisses, failures };
}

async function updateReadiness(db: UntypedDatabase, article: ArticleRow, sentenceCount: number) {
  const { data: rawAudio, error: audioError } = await db.from("reading_article_audio_assets").select("status").eq("article_id", article.id);
  if (audioError) throw new Error("Failed to verify article audio");
  const audio = (rawAudio || []) as AudioRow[];
  const articleReady = audio.length === sentenceCount && audio.every((row) => row.status === "ready");
  const { error: articleError } = await db.from("reading_articles").update({ status: articleReady ? "ready" : "draft" }).eq("id", article.id);
  if (articleError) throw new Error("Failed to update article status");

  const { data: rawArticles, error: topicArticlesError } = await db.from("reading_articles").select("language_code, status").eq("topic_id", article.topic_id);
  if (topicArticlesError) throw new Error("Failed to verify topic articles");
  const articles = (rawArticles || []) as TopicArticleRow[];
  const languageSet = new Set(["en", "ja", "ko", "it", "es"]);
  const topicReady = articles.length === 5 && articles.every((row) => languageSet.has(row.language_code) && row.status === "ready");
  const { error: topicError } = await db.from("reading_article_topics").update({ status: topicReady ? "ready" : "draft" }).eq("id", article.topic_id);
  if (topicError) throw new Error("Failed to update topic status");

  return { articleReady, topicReady };
}

export async function POST(request: NextRequest) {
  const env = config();
  if (!authorized(request, env.secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.url || !env.key) return NextResponse.json({ error: "Supabase service configuration is missing" }, { status: 500 });

  const body = await request.json().catch(() => ({})) as { articleId?: string };
  if (!body.articleId) return NextResponse.json({ error: "articleId is required" }, { status: 400 });

  const db = createClient(env.url, env.key, { auth: { persistSession: false } }) as unknown as UntypedDatabase;
  try {
    const { data: rawArticle, error: articleLookupError } = await db.from("reading_articles").select("id, topic_id, language_code, status").eq("id", body.articleId).single();
    const article = rawArticle as ArticleRow | null;
    if (articleLookupError || !article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    if (article.status === "published") return NextResponse.json({ error: "Published articles cannot be regenerated" }, { status: 409 });

    const { data: rawSentences, error: sentencesError } = await db.from("reading_article_sentences").select("id, sentence_text, estimated_duration_ms").eq("article_id", article.id).order("sentence_order");
    const sentences = (rawSentences || []) as SentenceRow[];
    if (sentencesError || sentences.length < 6 || sentences.length > 10) {
      return NextResponse.json({ error: "Article must contain 6 to 10 sentences before prewarm" }, { status: 400 });
    }

    const lexemeLinks = await rebuildLexemeLinks(db, article.id, article.language_code, sentences);
    const audio = await prewarmSentenceAudio(db, article.id, article.language_code, sentences);
    const state = await updateReadiness(db, article, sentences.length);
    return NextResponse.json({ success: true, articleId: article.id, lexemeLinks, audio, ...state });
  } catch (error) {
    console.error("Daily article prewarm error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to prewarm article" }, { status: 500 });
  }
}
