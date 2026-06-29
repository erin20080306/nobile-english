import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 管理者成本記錄 API
 * 
 * GET /api/admin/costs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * 
 * 取得每日文章生成成本記錄
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 建立查詢
    let query = supabase
      .from('daily_article_generation_log')
      .select('*')
      .order('publish_date', { ascending: false });

    if (startDate) {
      query = query.gte('publish_date', startDate);
    }

    if (endDate) {
      query = query.lte('publish_date', endDate);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      return NextResponse.json(
        { error: 'Failed to fetch cost logs' },
        { status: 500 }
      );
    }

    // 計算統計資料
    const stats = {
      totalArticles: logs?.length || 0,
      totalGeminiInputTokens: logs?.reduce((sum, log) => sum + log.gemini_input_tokens, 0) || 0,
      totalGeminiOutputTokens: logs?.reduce((sum, log) => sum + log.gemini_output_tokens, 0) || 0,
      totalTtsCharacters: logs?.reduce((sum, log) => sum + log.tts_character_count, 0) || 0,
      totalTtsCacheHits: logs?.reduce((sum, log) => sum + log.tts_cache_hit_count, 0) || 0,
      totalTtsCacheMisses: logs?.reduce((sum, log) => sum + log.tts_cache_miss_count, 0) || 0,
      totalWordAudioCacheMisses: logs?.reduce((sum, log) => sum + log.word_audio_cache_miss_count, 0) || 0,
      totalEstimatedCost: logs?.reduce((sum, log) => sum + parseFloat(log.estimated_cost_usd), 0) || 0,
    };

    // 按語言分組統計
    const byLanguage: Record<string, any> = {};
    logs?.forEach(log => {
      if (!byLanguage[log.language_code]) {
        byLanguage[log.language_code] = {
          count: 0,
          totalCost: 0,
          totalTtsCharacters: 0,
        };
      }
      byLanguage[log.language_code].count++;
      byLanguage[log.language_code].totalCost += parseFloat(log.estimated_cost_usd);
      byLanguage[log.language_code].totalTtsCharacters += log.tts_character_count;
    });

    return NextResponse.json({
      logs,
      stats,
      byLanguage,
    });
  } catch (error) {
    console.error('Failed to fetch cost data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost data' },
      { status: 500 }
    );
  }
}
