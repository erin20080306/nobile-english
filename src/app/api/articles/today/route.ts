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
    const { data: audioAssets } = await supabase
      .from('reading_article_audio_assets')
      .select('sentence_id, audio_path')
      .eq('article_id', article.id)
      .eq('status', 'ready');

    // 建立音檔 URL 映射：stable storage paths → fresh signed URLs (30 min)
    const audioMap = new Map<string, string>();
    if (audioAssets && audioAssets.length > 0) {
      const bucket = process.env.TTS_AUDIO_BUCKET || process.env.SUPABASE_TTS_BUCKET || 'tts-audio';

      // Stable paths are relative storage keys (no http/blob/stub/data prefix).
      const stableAssets = audioAssets.filter(
        (a) => a.sentence_id && a.audio_path && !/^(https?:|stub:|blob:|data:)/.test(a.audio_path)
      );
      // Legacy rows stored a signed https URL directly — use as-is (may be expired).
      const legacyAssets = audioAssets.filter(
        (a) => a.sentence_id && a.audio_path && /^https:\/\//.test(a.audio_path)
      );

      if (stableAssets.length > 0) {
        const paths = stableAssets.map((a) => a.audio_path as string);
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrls(paths, 60 * 30);
        if (signed) {
          for (let i = 0; i < stableAssets.length; i++) {
            const url = signed[i]?.signedUrl;
            if (url) audioMap.set(stableAssets[i].sentence_id as string, url);
          }
        }
      }

      for (const asset of legacyAssets) {
        if (!audioMap.has(asset.sentence_id as string)) {
          audioMap.set(asset.sentence_id as string, asset.audio_path as string);
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
