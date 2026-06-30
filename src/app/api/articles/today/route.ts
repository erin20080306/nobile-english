import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTaipeiDateString } from '@/server/articles/dates';

/**
 * 今日文章 API
 * 
 * GET /api/articles/today?language=en
 * 
 * 取得今日已發布的文章
 */

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const language = searchParams.get('language') || 'en';

    // 1. 取得今日日期
    const today = getTaipeiDateString();

    // 2. 取得今日已發布的 topic
    const { data: topic, error: topicError } = await supabase
      .from('reading_article_topics')
      .select('*')
      .eq('publish_date', today)
      .eq('status', 'published')
      .single();

    if (topicError || !topic) {
      return NextResponse.json(
        { error: 'No published article found for today' },
        { status: 404 }
      );
    }

    // 3. 取得指定語言的文章
    const { data: article, error: articleError } = await supabase
      .from('reading_articles')
      .select('*')
      .eq('topic_id', topic.id)
      .eq('language_code', language)
      .eq('status', 'published')
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: 'No article found for this language' },
        { status: 404 }
      );
    }

    // 4. 取得文章句子
    const { data: sentences, error: sentencesError } = await supabase
      .from('reading_article_sentences')
      .select('*')
      .eq('article_id', article.id)
      .order('sentence_order');

    if (sentencesError || !sentences) {
      return NextResponse.json(
        { error: 'Failed to fetch sentences' },
        { status: 500 }
      );
    }

    // 5. 取得句子音檔
    const { data: audioAssets, error: audioError } = await supabase
      .from('reading_article_audio_assets')
      .select('*')
      .eq('article_id', article.id)
      .eq('status', 'ready');

    // 建立音檔 URL 映射
    const audioMap = new Map();
    if (audioAssets) {
      for (const asset of audioAssets) {
        if (asset.sentence_id && asset.audio_path) {
          audioMap.set(asset.sentence_id, asset.audio_path);
        }
      }
    }

    // 6. 取得文章單字連結
    const { data: lexemeLinks } = await supabase
      .from('reading_article_lexeme_links')
      .select(`
        *,
        dictionary_entries (
          id,
          display_word,
          lemma,
          part_of_speech,
          definitions_zh_tw_json,
          examples_json,
          cefr_level
        )
      `)
      .eq('article_id', article.id)
      .order('sentence_id');

    // 7. 取得文章測驗題目
    const { data: questions } = await supabase
      .from('reading_article_questions')
      .select('*')
      .eq('article_id', article.id)
      .order('question_order');

    // 8. 組合回應
    const sentencesWithAudio = sentences.map(sentence => ({
      ...sentence,
      audio_url: audioMap.get(sentence.id) || null,
    }));

    return NextResponse.json({
      ...article,
      sentences: sentencesWithAudio,
      lexeme_links: lexemeLinks || [],
      questions: questions || [],
    });
  } catch (error) {
    console.error('Failed to fetch today article:', error);
    return NextResponse.json(
      { error: 'Failed to fetch today article' },
      { status: 500 }
    );
  }
}
