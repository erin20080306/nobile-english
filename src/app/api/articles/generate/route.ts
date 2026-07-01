import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { articleGenerationService } from '@/services/articleGenerationService';
import type { LearningLanguageCode, CEFRLevel } from '@/types';

/**
 * 每日文章生成 API
 * 
 * POST /api/articles/generate
 * 
 * Body:
 * {
 *   publishDate: string (YYYY-MM-DD)
 *   topicKey: string
 *   topicTitleZhTw: string
 *   topicCategory: string
 *   difficultyLevel: "A1" | "A2" | "B1"
 *   languages?: LearningLanguageCode[] (預設全部五種語言)
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase environment variables not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json();
    const {
      publishDate,
      topicKey,
      topicTitleZhTw,
      topicCategory,
      difficultyLevel,
      languages = ['en', 'ja', 'ko', 'it', 'es'] as LearningLanguageCode[],
      newsSummary,
      newsSourceUrl,
    } = body;

    if (!publishDate || !topicKey || !topicTitleZhTw || !topicCategory || !difficultyLevel) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 1. 建立或取得 topic
    const { data: topic, error: topicError } = await supabase
      .from('reading_article_topics')
      .upsert({
        publish_date: publishDate,
        topic_key: topicKey,
        topic_title_zh_tw: topicTitleZhTw,
        topic_category: topicCategory,
        status: 'ready',
      })
      .select()
      .single();

    if (topicError || !topic) {
      return NextResponse.json(
        { error: 'Failed to create topic' },
        { status: 500 }
      );
    }

    // 2. 為每種語言生成文章
    const articles: any[] = [];
    const generationLogs: any[] = [];

    for (const languageCode of languages) {
      const articleResult = await generateArticleForLanguage(
        supabase,
        topic.id,
        publishDate,
        topicKey,
        topicTitleZhTw,
        topicCategory,
        languageCode,
        difficultyLevel,
        newsSummary,
        newsSourceUrl
      );

      if (articleResult.success) {
        articles.push(articleResult.article);
        generationLogs.push(articleResult.log);
      } else {
        console.error(`Failed to generate article for ${languageCode}:`, articleResult.error);
      }
    }

    // 3. 更新 topic 狀態為 ready
    await supabase
      .from('reading_article_topics')
      .update({ status: 'ready' })
      .eq('id', topic.id);

    return NextResponse.json({
      success: true,
      topic,
      articles,
      generationLogs,
    });
  } catch (error) {
    console.error('Article generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate articles' },
      { status: 500 }
    );
  }
}

async function generateArticleForLanguage(
  supabase: any,
  topicId: string,
  publishDate: string,
  topicKey: string,
  topicTitleZhTw: string,
  topicCategory: string,
  languageCode: LearningLanguageCode,
  difficultyLevel: CEFRLevel,
  newsSummary?: string,
  newsSourceUrl?: string
): Promise<{
  success: boolean;
  article?: any;
  log?: any;
  error?: string;
}> {
  try {
    // 1. 呼叫 Gemini 生成文章
    const geminiResponse = await articleGenerationService.generateArticle({
      topicKey,
      topicTitleZhTw,
      topicCategory,
      languageCode,
      difficultyLevel,
      newsSummary,
      newsSourceUrl,
    });

    // 2. 建立文章記錄
    const { data: article, error: articleError } = await supabase
      .from('reading_articles')
      .insert({
        topic_id: topicId,
        language_code: languageCode,
        title: geminiResponse.title,
        title_zh_tw: geminiResponse.titleZhTw,
        article_text: geminiResponse.articleText,
        difficulty_level: difficultyLevel,
        estimated_reading_seconds: estimateReadingTime(geminiResponse.articleText),
        source_type: 'original_ai',
        content_version: 1,
        status: 'draft',
      })
      .select()
      .single();

    if (articleError || !article) {
      return { success: false, error: 'Failed to create article' };
    }

    // 3. 建立句子記錄
    const sentences: any[] = [];
    for (const sentence of geminiResponse.sentences) {
      const { data: sentenceData, error: sentenceError } = await supabase
        .from('reading_article_sentences')
        .insert({
          article_id: article.id,
          sentence_order: sentence.order,
          sentence_text: sentence.text,
          sentence_zh_tw: sentence.zhTw,
          sentence_type: 'body',
          estimated_duration_ms: estimateSentenceDuration(sentence.text),
        })
        .select()
        .single();

      if (!sentenceError && sentenceData) {
        sentences.push(sentenceData);
      }
    }

    // 4. 建立問題記錄
    const questions: any[] = [];
    for (const question of geminiResponse.questions) {
      const { data: questionData, error: questionError } = await supabase
        .from('reading_article_questions')
        .insert({
          article_id: article.id,
          question_order: questions.length + 1,
          question_type: question.type,
          question_text: question.question,
          options_json: { options: question.options },
          correct_answer_json: { answer: question.answer },
          explanation_zh_tw: question.explanationZhTw,
        })
        .select()
        .single();

      if (!questionError && questionData) {
        questions.push(questionData);
      }
    }

    // 5. 建立成本記錄
    const { data: log, error: logError } = await supabase
      .from('daily_article_generation_log')
      .insert({
        publish_date: publishDate,
        language_code: languageCode,
        article_id: article.id,
        gemini_input_tokens: 0, // TODO: 從 Gemini API 取得
        gemini_output_tokens: 0, // TODO: 從 Gemini API 取得
        tts_character_count: geminiResponse.articleText.length,
        tts_cache_hit_count: 0,
        tts_cache_miss_count: 0,
        word_audio_cache_miss_count: 0,
        estimated_cost_usd: 0, // TODO: 計算實際成本
      })
      .select()
      .single();

    return {
      success: true,
      article: {
        ...article,
        sentences,
        questions,
      },
      log: log,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function estimateReadingTime(text: string): number {
  // 假設平均閱讀速度為每分鐘 200 字
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil((wordCount / wordsPerMinute) * 60);
}

function estimateSentenceDuration(text: string): number {
  // 假設平均說話速度為每分鐘 150 字
  const wordsPerMinute = 150;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil((wordCount / wordsPerMinute) * 60 * 1000);
}
