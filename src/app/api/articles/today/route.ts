import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSignedUrl } from "@/server/tts/service";
import { getTtsAssetStore } from "@/server/tts/store";
import { taipeiCalendarDate } from "@/server/reading/date";

export const runtime = "nodejs";

const LANGUAGES = new Set(["en", "ja", "ko", "it", "es"]);

async function playbackUrl(assetId: string | null, stablePath: string | null): Promise<string | null> {
  if (assetId) {
    const asset = await getTtsAssetStore().getById(assetId);
    const url = asset ? buildSignedUrl(asset) : null;
    if (url && !url.startsWith("stub://")) return url;
  }
  // A real storage adapter can return a signed HTTPS URL here. Do not return a
  // provider path such as stub:// or a private object key to the browser.
  if (stablePath && /^https:\/\//.test(stablePath)) return stablePath;
  return null;
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase service configuration is missing" }, { status: 500 });
  }

  const language = request.nextUrl.searchParams.get("language") || "en";
  if (!LANGUAGES.has(language)) return NextResponse.json({ error: "Invalid language" }, { status: 400 });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const today = taipeiCalendarDate();
  try {
    const { data: topic, error: topicError } = await supabase
      .from("reading_article_topics")
      .select("id, publish_date, status")
      .eq("publish_date", today)
      .maybeSingle();
    if (topicError) throw new Error("Failed to load daily topic");
    if (!topic) return NextResponse.json({ state: "unavailable", date: today, error: "No daily article exists yet" }, { status: 404 });
    if (topic.status !== "published") {
      return NextResponse.json({ state: "preparing", date: today, topicStatus: topic.status }, { status: 202 });
    }

    const { data: article, error: articleError } = await supabase
      .from("reading_articles")
      .select("*")
      .eq("topic_id", topic.id)
      .eq("language_code", language)
      .eq("status", "published")
      .maybeSingle();
    if (articleError) throw new Error("Failed to load article");
    if (!article) return NextResponse.json({ state: "unavailable", date: today, error: "Language article is not ready" }, { status: 404 });

    const [{ data: sentences, error: sentencesError }, { data: audioRows, error: audioError }, { data: lexemeLinks, error: lexemeError }, { data: questions, error: questionsError }] = await Promise.all([
      supabase.from("reading_article_sentences").select("*").eq("article_id", article.id).order("sentence_order"),
      supabase.from("reading_article_audio_assets").select("sentence_id, tts_asset_id, audio_path, status").eq("article_id", article.id).eq("status", "ready"),
      supabase.from("reading_article_lexeme_links").select("*").eq("article_id", article.id).order("sentence_id").order("start_index"),
      supabase.from("reading_article_questions").select("*").eq("article_id", article.id).order("question_order"),
    ]);
    if (sentencesError || audioError || lexemeError || questionsError || !sentences) {
      throw new Error("Failed to load article content");
    }

    const audioBySentence = new Map((audioRows || []).map((row) => [row.sentence_id, row]));
    const sentencesWithAudio = await Promise.all(sentences.map(async (sentence) => {
      const asset = audioBySentence.get(sentence.id);
      return {
        ...sentence,
        audio_url: await playbackUrl(asset?.tts_asset_id || null, asset?.audio_path || null),
      };
    }));

    return NextResponse.json({
      state: "published",
      date: today,
      ...article,
      sentences: sentencesWithAudio,
      lexemeLinks: lexemeLinks || [],
      questions: questions || [],
      progress: null,
      isRewardClaimed: false,
    });
  } catch (error) {
    console.error("Failed to fetch today article", error);
    return NextResponse.json({ error: "Failed to fetch today article" }, { status: 500 });
  }
}
