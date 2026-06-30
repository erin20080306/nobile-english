import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { articleGenerationService } from "@/services/articleGenerationService";
import type { CEFRLevel, LearningLanguageCode } from "@/types";

export const runtime = "nodejs";

const ALL_LANGUAGES: LearningLanguageCode[] = ["en", "ja", "ko", "it", "es"];

interface GenerateBody {
  publishDate?: string;
  topicKey?: string;
  topicTitleZhTw?: string;
  topicCategory?: string;
  difficultyLevel?: CEFRLevel;
  languages?: LearningLanguageCode[];
}

function configured() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    cronSecret: process.env.CRON_SECRET,
  };
}

function isAuthorized(request: NextRequest, secret?: string): boolean {
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-cron-secret") === secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

function validDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function allowedLanguages(input: LearningLanguageCode[] | undefined): LearningLanguageCode[] | null {
  const selected = Array.from(new Set(input || ALL_LANGUAGES));
  if (selected.length !== ALL_LANGUAGES.length) return null;
  return selected.every((language) => ALL_LANGUAGES.includes(language)) ? selected : null;
}

function estimateDurationMs(text: string, language: LearningLanguageCode): number {
  const charsPerSecond = language === "ja" || language === "ko" ? 7 : 12;
  return Math.max(900, Math.round((Array.from(text).length / charsPerSecond) * 1000));
}

export async function POST(request: NextRequest) {
  const env = configured();
  if (!isAuthorized(request, env.cronSecret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return NextResponse.json({ error: "Supabase service configuration is missing" }, { status: 500 });
  }

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!validDate(body.publishDate) || !body.topicKey || !body.topicTitleZhTw || !body.topicCategory) {
    return NextResponse.json({ error: "publishDate, topicKey, topicTitleZhTw, and topicCategory are required" }, { status: 400 });
  }
  if (body.difficultyLevel !== "A1" && body.difficultyLevel !== "A2" && body.difficultyLevel !== "B1") {
    return NextResponse.json({ error: "difficultyLevel must be A1, A2, or B1" }, { status: 400 });
  }
  const languages = allowedLanguages(body.languages);
  if (!languages) return NextResponse.json({ error: "All five languages are required" }, { status: 400 });

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } });
  const { data: existingTopic, error: existingError } = await supabase
    .from("reading_article_topics")
    .select("id, publish_date, status, reading_articles(id, language_code, status)")
    .eq("publish_date", body.publishDate)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: "Failed to inspect daily article" }, { status: 500 });
  if (existingTopic) {
    return NextResponse.json({ success: true, existing: true, topic: existingTopic, articles: existingTopic.reading_articles || [] });
  }

  const { data: topic, error: topicError } = await supabase
    .from("reading_article_topics")
    .insert({
      publish_date: body.publishDate,
      topic_key: body.topicKey,
      topic_title_zh_tw: body.topicTitleZhTw,
      topic_category: body.topicCategory,
      status: "draft",
    })
    .select()
    .single();
  if (topicError || !topic) return NextResponse.json({ error: "Failed to create article topic" }, { status: 500 });

  try {
    const articles: Array<{ id: string; language_code: LearningLanguageCode }> = [];
    for (const languageCode of languages) {
      const generated = await articleGenerationService.generateArticle({
        topicKey: body.topicKey,
        topicTitleZhTw: body.topicTitleZhTw,
        topicCategory: body.topicCategory,
        languageCode,
        difficultyLevel: body.difficultyLevel,
      });

      const { data: article, error: articleError } = await supabase
        .from("reading_articles")
        .insert({
          topic_id: topic.id,
          language_code: languageCode,
          title: generated.title,
          title_zh_tw: generated.titleZhTw,
          article_text: generated.articleText,
          difficulty_level: generated.difficultyLevel,
          estimated_reading_seconds: Math.max(20, Math.round(generated.sentences.reduce(
            (total, sentence) => total + estimateDurationMs(sentence.text, languageCode), 0
          ) / 1000)),
          source_type: "original_ai",
          source_name: "Gemini",
          content_version: 1,
          status: "draft",
        })
        .select("id, language_code")
        .single();
      if (articleError || !article) throw new Error(`Failed to save ${languageCode} article`);

      const sentenceRows = generated.sentences.map((sentence) => ({
        article_id: article.id,
        sentence_order: sentence.order,
        sentence_text: sentence.text,
        sentence_zh_tw: sentence.zhTw,
        sentence_type: "body",
        estimated_duration_ms: estimateDurationMs(sentence.text, languageCode),
      }));
      const { error: sentenceError } = await supabase.from("reading_article_sentences").insert(sentenceRows);
      if (sentenceError) throw new Error(`Failed to save ${languageCode} sentences`);

      const questionRows = generated.questions.map((question, index) => ({
        article_id: article.id,
        question_order: index + 1,
        question_type: question.type,
        question_text: question.question,
        options_json: question.options,
        correct_answer_json: {
          answer: question.answer,
          index: question.options.indexOf(question.answer),
        },
        explanation_zh_tw: question.explanationZhTw,
      }));
      const { error: questionError } = await supabase.from("reading_article_questions").insert(questionRows);
      if (questionError) throw new Error(`Failed to save ${languageCode} questions`);

      const { error: logError } = await supabase.from("daily_article_generation_log").upsert({
        publish_date: body.publishDate,
        language_code: languageCode,
        article_id: article.id,
        gemini_input_tokens: 0,
        gemini_output_tokens: 0,
        tts_character_count: Array.from(generated.articleText).length,
        tts_cache_hit_count: 0,
        tts_cache_miss_count: 0,
        word_audio_cache_miss_count: 0,
        estimated_cost_usd: 0,
      }, { onConflict: "publish_date,language_code" });
      if (logError) throw new Error(`Failed to create ${languageCode} generation log`);

      articles.push(article);
    }

    return NextResponse.json({ success: true, existing: false, topic, articles }, { status: 201 });
  } catch (error) {
    // A publish date must be retriable. Cascade delete prevents a half-created topic
    // from blocking the next cron run.
    await supabase.from("reading_article_topics").delete().eq("id", topic.id);
    console.error("Daily article generation error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to generate daily articles" }, { status: 502 });
  }
}
