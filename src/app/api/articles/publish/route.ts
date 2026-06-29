import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 文章發布 API
 * 
 * POST /api/articles/publish
 * 
 * Body:
 * {
 *   topicId: string
 * }
 * 
 * 發布流程：
 * 1. 驗證所有語言版本都已 ready
 * 2. 驗證所有音檔都已 ready
 * 3. 更新 topic 狀態為 published
 * 4. 更新所有文章狀態為 published
 * 5. 設定 published_at
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
    const { topicId } = body;

    if (!topicId) {
      return NextResponse.json(
        { error: 'topicId is required' },
        { status: 400 }
      );
    }

    // 1. 取得 topic 資訊
    const { data: topic, error: topicError } = await supabase
      .from('reading_article_topics')
      .select('*')
      .eq('id', topicId)
      .single();

    if (topicError || !topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    if (topic.status !== 'ready') {
      return NextResponse.json(
        { error: 'Topic must be in ready status to publish' },
        { status: 400 }
      );
    }

    // 2. 取得所有文章
    const { data: articles, error: articlesError } = await supabase
      .from('reading_articles')
      .select('*')
      .eq('topic_id', topicId);

    if (articlesError || !articles || articles.length === 0) {
      return NextResponse.json(
        { error: 'No articles found for this topic' },
        { status: 400 }
      );
    }

    // 3. 驗證所有文章都已 ready
    const notReadyArticles = articles.filter(a => a.status !== 'ready');
    if (notReadyArticles.length > 0) {
      return NextResponse.json(
        { error: 'Some articles are not ready yet', notReadyArticles },
        { status: 400 }
      );
    }

    // 4. 驗證所有音檔都已 ready
    for (const article of articles) {
      const { data: audioAssets, error: audioError } = await supabase
        .from('reading_article_audio_assets')
        .select('*')
        .eq('article_id', article.id);

      if (audioError) {
        return NextResponse.json(
          { error: `Failed to check audio assets for article ${article.id}` },
          { status: 500 }
        );
      }

      const notReadyAudio = audioAssets?.filter(a => a.status !== 'ready') || [];
      if (notReadyAudio.length > 0) {
        return NextResponse.json(
          { error: `Some audio assets are not ready for article ${article.id}`, notReadyAudio },
          { status: 400 }
        );
      }
    }

    // 5. 更新 topic 狀態為 published
    const { error: topicUpdateError } = await supabase
      .from('reading_article_topics')
      .update({ status: 'published' })
      .eq('id', topicId);

    if (topicUpdateError) {
      return NextResponse.json(
        { error: 'Failed to update topic status' },
        { status: 500 }
      );
    }

    // 6. 更新所有文章狀態為 published
    const { error: articlesUpdateError } = await supabase
      .from('reading_articles')
      .update({ 
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('topic_id', topicId);

    if (articlesUpdateError) {
      return NextResponse.json(
        { error: 'Failed to update articles status' },
        { status: 500 }
      );
    }

    // 7. 建立獎勵記錄
    for (const article of articles) {
      await createArticleRewards(supabase, article.id, article.language_code);
    }

    return NextResponse.json({
      success: true,
      topicId,
      articlesPublished: articles.length,
    });
  } catch (error) {
    console.error('Article publish error:', error);
    return NextResponse.json(
      { error: 'Failed to publish articles' },
      { status: 500 }
    );
  }
}

async function createArticleRewards(
  supabase: any,
  articleId: string,
  languageCode: string
): Promise<void> {
  // 基礎獎勵：完成閱讀獲得金幣
  await supabase
    .from('reading_article_rewards')
    .insert({
      article_id: articleId,
      language_code: languageCode,
      reward_type: 'coins',
      reward_amount: 10,
    });

  // 語言專屬獎勵：種子
  const cropTypes: Record<string, string> = {
    en: 'english_crop',
    ja: 'japanese_crop',
    ko: 'korean_crop',
    it: 'italian_crop',
    es: 'spanish_crop',
  };

  await supabase
    .from('reading_article_rewards')
    .insert({
      article_id: articleId,
      language_code: languageCode,
      reward_type: 'seeds',
      reward_amount: 5,
      crop_type: cropTypes[languageCode] || 'generic_crop',
    });

  // 複習題額外獎勵：水滴
  await supabase
    .from('reading_article_rewards')
    .insert({
      article_id: articleId,
      language_code: languageCode,
      reward_type: 'water',
      reward_amount: 3,
    });
}
