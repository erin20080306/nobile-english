import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateTtsAsset } from "@/server/tts/service";
import type { LearningLanguageCode } from "@/types";

export const runtime = "nodejs";

interface Token {
  text: string;
  lemma: string;
  startIndex: number;
  endIndex: number;
}

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

function localeFor(language: LearningLanguageCode): string {
  return ({ en: "en", ja: "ja", ko: "ko", it: "it", es: "es" } as const)[language];
}

function tokenize(text: string, language: LearningLanguageCode): Token[] {
  const segmenter = new Intl.Segmenter(localeFor(language), { granularity: "word" });
  const seen = new Set<string>();
  const tokens: Token[] = [];

  for (const item of segmenter.segment(text)) {
    if (!item.isWordLike) continue;
    const value = item.segment.trim();
    const key = `${item.index}:${value}`;
    if (!value || seen.has(key)) continue;
    seen.add(key);
    tokens.push({
      text: value,
      lemma: language === "en" || language === "it" || language === "es" ? value.toLocaleLowerCase(localeFor(language)) : value,
      startIndex: item.index,
      endIndex: item.index + value.length,
    });
  }
  return tokens;
}

async function buildLexemeLinks(supabase: ReturnType<typeof createClient>, articleId: string, language: LearningLanguageCode, sentences: Array<{ id: string; sentence_text: string }>) {
  const tokenRows = sentences.flatMap((sentence) => tokenize(sentence.sentence_text, language).map((token) => ({ ...token, sentenceId: sentence.id })));
  const lemmas = Array.from(new Set(tokenRows.map((token) => token.lemma))).slice(0, 500);
  const { data: entries, error: entriesError } = lemmas.length
    ? await supabase
        .from("dictionary_entries")
        .select("id, lemma")
        .eq("language_code", language)
        .in("lemma", lemmas)
    : { data: [], error: null };
  if (entriesError) throw new Error("Failed to find dictionary entries for reading article");

  const entryByLemma = new Map((entries || []).map((entry) => [String(entry.lemma), entry.id]));
  const rows = tokenRows.map((token) => ({
    article_id: articleId,
    sentence_id: token.sentenceId,
    language_code: language,
    start_index: token.startIndex,
    end_index: token.endIndex,
    display_text: token.text,
    dictionary_entry_id: entryByLemma.get(token.lemma) || null,
    phrase_priority: 0,
  }));

  const { error: removeError } = await supabase.from("reading_article_lexeme_links").delete().eq("article_id", articleId);
  if (removeError) throw new Error("Failed to refresh reading lexeme links");
  if (rows.length === 0) return 0;

  const { error: insertError } = await supabase.from("reading_article_lexeme_links").insert(rows);
  if (insertError) throw new Error("Failed to save reading lexeme links");
  return rows.length;
}

async function prewarmAudio(
  supabase: ReturnType<typeof createClient>,
  articleId: string,
  language: LearningLanguageCode,
  sentences: Array<{ id: string; sentence_text: string; estimated_duration_ms: number }>
) {
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

      const usablePath = result.asset.status === "ready" && result.asset.audioPath && !result.asset.audioPath.startsWith("stub://")
        ? result.asset.audioPath
        : null;
      const status = usablePath ? "ready" : "failed";
      if (!usablePath) failures += 1;

      const { error } = await supabase.from("reading_article_audio_assets").upsert({
        article_id: articleId,
        sentence_id: sentence.id,
        language_code: language,
        tts_asset_id: result.asset.id,
        // Stable provider/storage path only. Signed URLs are generated at read time.
        audio_path: usablePath,
        duration_ms: result.asset.durationMs || sentence.estimated_duration_ms,
        audio_version: 2,
        status,
      }, { onConflict: "article_id,sentence_id,language_code" });
      if (error) throw new Error("Failed to save article audio metadata");
    } catch (error) {
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
      console.error("Reading sentence prewarm failed", error);
    }
  }

  return { cacheHits, cacheMisses, failures };
}

async function refreshReadyState(supabase: ReturnType<typeof createClient>, articleId: string, topicId: string, sentenceCount: number) {
  const { data: audioRows, error: audioError } = await supabase
    .from("reading_article_audio_assets")
    .select("status")
    .eq("article_id", articleId);
  if (audioError) throw new Error("Failed to validate article audio state");
  const audioReady = (audioRows || []).length === sentenceCount && (audioRows || []).every((asset) => asset.status === "ready");
  const { error: articleUpdateError } = await supabase
    .from("reading_articles")
    .update({ status: audioReady ? "ready" : "draft" })
    .eq("id", articleId);
  if (articleUpdateError) throw new Error("Failed to update article ready state");

  const { data: articles, error: articlesError } = await supabase
    .from("reading_articles")
    .select("language_code, status")
    .eq("topic_id", topicId);
  if (articlesError) throw new Error("Failed to validate topic ready state");
  const expected = new Set(["en", "ja", "ko", "it", "es"]);
  const topicReady = (articles || []).length === expected.size &&
    (articles || []).every((article) => expected.has(article.language_code) && article.status === "ready");
  const { error: topicUpdateError } = await supabase
    .from("reading_article_topics")
    .update({ status: topicReady ? "ready" : "draft" })
    .eq("id", topicId);
  if (topicUpdateError) throw new Error("Failed to update topic ready state");

  return { articleReady: audioReady, topicReady };
}

export async function POST(request: NextRequest) {
  const env = environment();
  if (!authorized(request, env.cronSecret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.supabaseUrl || !env.serviceRoleKey) return NextResponse.json({ error: "Supabase service configuration is missing" }, { status: 500 });

  let body: { articleId?: string };
  try {
    body = (await request.json()) as { articleId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.articleId) return NextResponse.json({ error: "articleId is required" }, { status: 400 });

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } });
  try {
    const { data: article, error: articleError } = await supabase
      .from("reading_articles")
      .select("id, topic_id, language_code, status")
      .eq("id", body.articleId)
      .single();
    if (articleError || !article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    if (article.status === "published") return NextResponse.json({ error: "Published articles cannot be regenerated" }, { status: 409 });

    const { data: sentences, error: sentencesError } = await supabase
      .from("reading_article_sentences")
      .select("id, sentence_text, estimated_duration_ms")
      .eq("article_id", article.id)
      .order("sentence_order");
    if (sentencesError || !sentences || sentences.length < 6 || sentences.length > 10) {
      return NextResponse.json({ error: "Article must contain 6 to 10 sentences before prewarm" }, { status: 400 });
    }

    const language = article.language_code as LearningLanguageCode;
    const lexemeLinks = await buildLexemeLinks(supabase, article.id, language, sentences);
    const audio = await prewarmAudio(supabase, article.id, language, sentences);
    const state = await refreshReadyState(supabase, article.id, article.topic_id, sentences.length);

    return NextResponse.json({
      success: true,
      articleId: article.id,
      lexemeLinks,
      audio,
      ...state,
    });
  } catch (error) {
    console.error("Daily article prewarm error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to prewarm article" }, { status: 500 });
  }
}
