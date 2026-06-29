import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * 文章完成獎勵 API
 * 
 * POST /api/articles/complete
 * 
 * Body:
 * {
 *   articleId: string
 *   languageCode: string
 *   quizScore?: number
 * }
 * 
 * 處理：
 * 1. 記錄閱讀進度
 * 2. 發放農場獎勵（金幣、種子、水滴）
 * 3. 防止重複領取
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

    // 從 Authorization header 取得 token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 驗證使用者
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { articleId, languageCode, quizScore } = body;

    if (!articleId || !languageCode) {
      return NextResponse.json(
        { error: 'articleId and languageCode are required' },
        { status: 400 }
      );
    }

    // 1. 檢查是否已經領取過獎勵
    const { data: existingProgress, error: progressError } = await supabase
      .from('reading_article_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('article_id', articleId)
      .eq('language_code', languageCode)
      .maybeSingle();

    if (progressError) {
      return NextResponse.json(
        { error: 'Failed to check progress' },
        { status: 500 }
      );
    }

    if (existingProgress && existingProgress.is_reward_claimed) {
      return NextResponse.json(
        { error: 'Reward already claimed' },
        { status: 400 }
      );
    }

    // 2. 建立或更新閱讀進度
    const now = new Date().toISOString();
    const progressData = {
      user_id: user.id,
      article_id: articleId,
      language_code: languageCode,
      started_at: existingProgress?.started_at || now,
      completed_at: now,
      last_sentence_order: 999, // 假設全部完成
      reading_speed: null, // TODO: 計算實際閱讀速度
      quiz_score: quizScore || null,
      is_reward_claimed: true,
      updated_at: now,
    };

    let progress;
    if (existingProgress) {
      const { data: updatedProgress, error: updateError } = await supabase
        .from('reading_article_progress')
        .update(progressData)
        .eq('id', existingProgress.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update progress' },
          { status: 500 }
        );
      }
      progress = updatedProgress;
    } else {
      const { data: newProgress, error: insertError } = await supabase
        .from('reading_article_progress')
        .insert(progressData)
        .select()
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to create progress' },
          { status: 500 }
        );
      }
      progress = newProgress;
    }

    // 3. 取得文章獎勵
    const { data: rewards, error: rewardsError } = await supabase
      .from('reading_article_rewards')
      .select('*')
      .eq('article_id', articleId)
      .eq('language_code', languageCode);

    if (rewardsError) {
      return NextResponse.json(
        { error: 'Failed to fetch rewards' },
        { status: 500 }
      );
    }

    // 4. 發放獎勵到農場系統
    const rewardResults: any[] = [];
    for (const reward of rewards || []) {
      const result = await grantFarmReward(
        supabase,
        user.id,
        reward.reward_type,
        reward.reward_amount,
        reward.crop_type
      );
      rewardResults.push(result);
    }

    // 5. 記錄學習紀錄
    await recordLearningActivity(
      supabase,
      user.id,
      articleId,
      languageCode,
      'reading_article'
    );

    return NextResponse.json({
      success: true,
      progress,
      rewards: rewardResults,
    });
  } catch (error) {
    console.error('Article completion error:', error);
    return NextResponse.json(
      { error: 'Failed to complete article' },
      { status: 500 }
    );
  }
}

async function grantFarmReward(
  supabase: any,
  userId: string,
  rewardType: string,
  rewardAmount: number,
  cropType?: string
): Promise<any> {
  try {
    // 根據獎勵類型發放到農場系統
    switch (rewardType) {
      case 'coins':
        // 加金幣
        const { error: coinsError } = await supabase
          .from('garden_state')
          .update({ coins: supabase.raw(`coins + ${rewardAmount}`) })
          .eq('user_id', userId);

        if (coinsError) throw coinsError;
        return { type: 'coins', amount: rewardAmount, success: true };

      case 'seeds':
        // 加種子
        const { error: seedsError } = await supabase
          .from('garden_state')
          .update({ seeds: supabase.raw(`seeds + ${rewardAmount}`) })
          .eq('user_id', userId);

        if (seedsError) throw seedsError;
        return { type: 'seeds', amount: rewardAmount, success: true };

      case 'water':
        // 加水滴
        const { error: waterError } = await supabase
          .from('garden_state')
          .update({ water: supabase.raw(`water + ${rewardAmount}`) })
          .eq('user_id', userId);

        if (waterError) throw waterError;
        return { type: 'water', amount: rewardAmount, success: true };

      case 'crop':
        // 加農作物（需要實作）
        if (cropType) {
          // TODO: 實作農作物獎勵邏輯
          return { type: 'crop', cropType, amount: rewardAmount, success: true };
        }
        return { type: 'crop', success: false, error: 'No crop type specified' };

      default:
        return { type: rewardType, success: false, error: 'Unknown reward type' };
    }
  } catch (error) {
    console.error('Failed to grant farm reward:', error);
    return { type: rewardType, success: false, error: String(error) };
  }
}

async function recordLearningActivity(
  supabase: any,
  userId: string,
  articleId: string,
  languageCode: string,
  activityType: string
): Promise<void> {
  try {
    // 記錄到 learning_records
    const { data: article } = await supabase
      .from('reading_articles')
      .select('title')
      .eq('id', articleId)
      .single();

    await supabase
      .from('learning_records')
      .insert({
        user_id: userId,
        type: activityType,
        target_language: languageCode,
        title: article?.title || 'Daily Reading',
        en_content: article?.title || '',
        zh_content: article?.title_zh_tw || '',
        score: 10, // 基礎分數
        completed: true,
        minutes: 5, // 預估閱讀時間
        date: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Failed to record learning activity:', error);
  }
}
